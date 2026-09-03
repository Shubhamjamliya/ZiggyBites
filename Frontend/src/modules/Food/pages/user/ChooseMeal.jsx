import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  Coffee,
  Soup,
  UserCircle2,
  Utensils,
  CheckCircle2,
  Plus,
  Minus,
} from "lucide-react";
import api, { restaurantAPI } from "@food/api";
import { loadAppCustomization, DEFAULT_APP_CUSTOMIZATION } from "@food/utils/appCustomization";

const getImageUrl = (value) => {
  const candidate =
    typeof value === "string"
      ? value
      : value?.url || value?.secure_url || value?.imageUrl || value?.image || "";
  if (!candidate) return "";
  if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;

  const apiOrigin = String(api.defaults?.baseURL || "")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/$/, "");
  return `${apiOrigin}/${String(candidate).replace(/^\/+/, "")}`;
};

const getMenuSections = (response) => {
  const payload = response?.data?.data ?? response?.data ?? {};
  const menu = payload?.menu ?? payload;
  return menu?.sections || payload?.sections || [];
};

const fallbackMealSlots = [
  {
    id: "breakfast",
    title: "Breakfast",
    timeLabel: "7:00 AM - 10:00 AM",
    icon: Utensils,
    accentColor: "#f59e0b",
    backgroundColor: "#fff7e6",
  },
  {
    id: "lunch",
    title: "Lunch",
    timeLabel: "1:00 PM - 3:00 PM",
    icon: ChefHat,
    accentColor: "#ef4444",
    backgroundColor: "#fff1f2",
  },
  {
    id: "snacks",
    title: "Evening Snacks",
    timeLabel: "5:00 PM - 7:00 PM",
    icon: Coffee,
    accentColor: "#7c3aed",
    backgroundColor: "#f5f3ff",
  },
  {
    id: "dinner",
    title: "Dinner",
    timeLabel: "8:00 PM - 10:00 PM",
    icon: Soup,
    accentColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
];

const iconMap = {
  breakfast: Utensils,
  lunch: ChefHat,
  snacks: Coffee,
  dinner: Soup,
  meal: Utensils,
};

export default function ChooseMeal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [selectedSlots, setSelectedSlots] = useState(["lunch"]);
  const [mealSlots, setMealSlots] = useState(fallbackMealSlots);
  const [availableDishes, setAvailableDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Multi-selection state: Map<itemId, { dish, quantity }>
  const [selectedDishMap, setSelectedDishMap] = useState({});

  // Config loaded from admin
  const [mealConfig, setMealConfig] = useState(DEFAULT_APP_CUSTOMIZATION.mealSelection);

  // ── Load app customization ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (!mounted) return;
        const enabled = settings.subscriptionFlowEnabled !== false;
        if (!enabled) {
          navigate("/food/user", { replace: true });
          return;
        }
        setMealConfig({
          maxDishesPerMeal: settings.mealSelection?.maxDishesPerMeal ?? 3,
          allowQuantityPerDish: settings.mealSelection?.allowQuantityPerDish ?? false,
        });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [navigate]);

  // ── Seed initial dish selection from navigation state / search params ───────
  useEffect(() => {
    const stateDish = location.state?.dish;
    if (stateDish && (stateDish.price || stateDish.id || stateDish.itemId)) {
      const id = String(stateDish.itemId || stateDish.id || searchParams.get("dishId") || "seed-0");
      setSelectedDishMap({
        [id]: {
          dish: {
            id,
            itemId: id,
            name: stateDish.name || searchParams.get("dish") || "Selected meal",
            restaurantName: stateDish.restaurantName || searchParams.get("restaurant") || "",
            restaurantId: stateDish.restaurantId || searchParams.get("restaurantId") || "",
            categoryName: stateDish.categoryName || searchParams.get("category") || "",
            price: stateDish.price || searchParams.get("price") || "0",
            image: stateDish.image || "",
            foodType: stateDish.foodType || "",
          },
          quantity: 1,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch available dishes ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchDishes = async () => {
      setLoadingDishes(true);
      try {
        const response = await restaurantAPI.getPublicDishes({ limit: 30 });
        const dishes = response?.data?.data?.dishes || response?.data?.dishes || [];
        if (!cancelled && Array.isArray(dishes) && dishes.length > 0) {
          setAvailableDishes(dishes);
        }
      } catch {
        if (!cancelled) setAvailableDishes([]);
      } finally {
        if (!cancelled) setLoadingDishes(false);
      }
    };
    fetchDishes();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch meal slots ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadMealSlots = async () => {
      setLoadingSlots(true);
      try {
        const response = await api.get("/food/meal-slots/public");
        const slots = response?.data?.data?.slots || response?.data?.slots || [];
        const mapped = slots
          .filter((slot) => slot?.title && slot?.timeLabel)
          .map((slot, index) => ({
            id: slot._id || slot.id || `meal-slot-${index}`,
            title: slot.title,
            timeLabel: slot.timeLabel,
            description: slot.description || "",
            imageUrl: getImageUrl(
              slot.imageUrl || slot.image || slot.photoUrl || slot.thumbnail || slot.images?.[0],
            ),
            icon: iconMap[slot.icon] || Utensils,
            accentColor: slot.accentColor || "#ef2b24",
            backgroundColor: slot.backgroundColor || "#fff7ed",
          }));
        if (!cancelled && mapped.length > 0) setMealSlots(mapped);
      } catch {
        if (!cancelled) setMealSlots(fallbackMealSlots);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    loadMealSlots();
    return () => { cancelled = true; };
  }, []);

  // ── Dish selection helpers ──────────────────────────────────────────────────
  const selectedCount = Object.keys(selectedDishMap).length;
  const maxReached = selectedCount >= mealConfig.maxDishesPerMeal;

  const toggleDish = useCallback((item) => {
    const id = String(item._id || item.id);
    setSelectedDishMap((prev) => {
      if (prev[id]) {
        // Deselect — but keep at least 1 if something was pre-seeded
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (Object.keys(prev).length >= mealConfig.maxDishesPerMeal) {
        // Max reached — do nothing (user sees the visual lock)
        return prev;
      }
      return {
        ...prev,
        [id]: {
          dish: {
            id,
            itemId: id,
            name: item.name,
            restaurantName: item.restaurantName || item.restaurant?.name || "Kitchen",
            restaurantId: item.restaurantId || item.restaurant?._id || "",
            categoryName: item.categoryName || "",
            price: String(item.price || 0),
            image: item.image || "",
            foodType: item.foodType || "Veg",
          },
          quantity: 1,
        },
      };
    });
  }, [mealConfig.maxDishesPerMeal]);

  const setDishQuantity = useCallback((id, qty) => {
    if (qty < 1) {
      setSelectedDishMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setSelectedDishMap((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], quantity: qty } } : prev
    );
  }, []);

  // ── Computed totals ─────────────────────────────────────────────────────────
  const { totalPrice, totalItems } = useMemo(() => {
    let price = 0;
    let items = 0;
    for (const { dish, quantity } of Object.values(selectedDishMap)) {
      const qty = mealConfig.allowQuantityPerDish ? quantity : 1;
      price += Number(dish.price || 0) * qty;
      items += qty;
    }
    return { totalPrice: price, totalItems: items };
  }, [selectedDishMap, mealConfig.allowQuantityPerDish]);

  // ── Slot toggle ─────────────────────────────────────────────────────────────
  const toggleSlot = (slotId) => {
    setSelectedSlots((current) =>
      current.includes(slotId)
        ? current.length > 1
          ? current.filter((id) => id !== slotId)
          : current
        : [...current, slotId],
    );
  };

  // ── Continue ────────────────────────────────────────────────────────────────
  const canContinue = selectedCount > 0 && selectedSlots.length > 0;

  const continueToPlans = () => {
    if (!canContinue) return;
    const passedPlan = location.state?.subscriptionPlan;
    const mealsToPass = mealSlots
      .filter((slot) => selectedSlots.includes(slot.id))
      .map(({ icon, ...rest }) => rest);

    const selectedDishesArray = Object.values(selectedDishMap).map(({ dish, quantity }) => ({
      ...dish,
      quantity: mealConfig.allowQuantityPerDish ? quantity : 1,
    }));

    // For backwards compatibility: keep single `dish` field pointing to first selection
    const primaryDish = selectedDishesArray[0] || null;

    const navState = {
      dish: primaryDish,
      selectedDishes: selectedDishesArray,
      selectedMeals: mealsToPass,
    };

    if (passedPlan && primaryDish?.price) {
      navigate("/food/user/checkout", { state: { ...navState, subscriptionPlan: passedPlan } });
    } else {
      navigate("/food/user/subscription-plans", { state: navState });
    }
  };

  const darkSlotClasses = {
    breakfast: "dark:!bg-[#241c10] dark:border-amber-900/40",
    lunch: "dark:!bg-[#261315] dark:border-rose-900/40",
    snacks: "dark:!bg-[#1d162b] dark:border-purple-900/40",
    dinner: "dark:!bg-[#121b2b] dark:border-blue-900/40",
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-[#171724] dark:text-white font-['Poppins',sans-serif] transition-colors duration-200">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-36 pt-3">
        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#171724] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <h1 className="flex-1 text-left text-xl font-black tracking-tight text-gray-900 dark:text-white">
            Choose your meal
          </h1>
          <button
            type="button"
            onClick={() => navigate("/food/user/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
            aria-label="Profile"
          >
            <UserCircle2 className="h-6 w-6" strokeWidth={2} />
          </button>
        </header>

        <p className="mt-4 pl-10 pr-6 text-[12px] font-semibold leading-5 text-[#6d6a7d] dark:text-gray-400">
          Pick your preferred meal dishes and delivery slots to get started.
        </p>

        {/* Dish Selector */}
        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Select Meal Dishes
            </h2>
            <div className="flex items-center gap-2">
              {totalPrice > 0 && (
                <span className="text-[11px] font-bold text-[#e32c31] dark:text-[#ff5257]">
                  ₹{totalPrice.toFixed(0)}/meal
                </span>
              )}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  maxReached
                    ? "bg-[#e32c31]/10 text-[#e32c31] dark:bg-[#ff5257]/10 dark:text-[#ff5257]"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                }`}
              >
                {selectedCount}/{mealConfig.maxDishesPerMeal}
              </span>
            </div>
          </div>

          {maxReached && (
            <p className="mb-2 text-[10px] font-semibold text-[#e32c31] dark:text-[#ff5257]">
              Max {mealConfig.maxDishesPerMeal} dishes reached. Deselect a dish to swap.
            </p>
          )}

          {loadingDishes ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shrink-0 w-36 h-[130px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : availableDishes.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {availableDishes.map((item) => {
                const id = String(item._id || item.id);
                const entry = selectedDishMap[id];
                const isSelected = Boolean(entry);
                const isDisabled = !isSelected && maxReached;
                const qty = entry?.quantity ?? 1;

                return (
                  <div
                    key={id}
                    onClick={() => !isDisabled && toggleDish(item)}
                    className={`relative shrink-0 w-36 rounded-2xl p-2.5 border cursor-pointer transition select-none ${
                      isDisabled ? "opacity-40 cursor-not-allowed" : "active:scale-95"
                    } ${
                      isSelected
                        ? "border-[#e32c31] dark:border-[#ff5257] bg-red-50/50 dark:bg-red-950/30 shadow-sm"
                        : "border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] hover:border-gray-200 dark:hover:border-gray-700"
                    }`}
                  >
                    {/* Selection checkmark */}
                    {isSelected && (
                      <span className="absolute top-2 right-2 z-10">
                        <CheckCircle2 className="h-4 w-4 text-[#e32c31] dark:text-[#ff5257]" fill="currentColor" />
                      </span>
                    )}

                    <div className="relative h-20 w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                      {item.image ? (
                        <img
                          src={getImageUrl(item.image)}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 font-bold text-lg">
                          🍱
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/60 text-white">
                        ₹{item.price || 0}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {item.restaurantName || "Kitchen"}
                    </p>

                    {/* Quantity stepper — shown only when allowQuantityPerDish is on */}
                    {isSelected && mealConfig.allowQuantityPerDish && (
                      <div
                        className="mt-2 flex items-center justify-between rounded-lg bg-[#e32c31]/10 dark:bg-[#ff5257]/10 px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setDishQuantity(id, qty - 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow text-[#e32c31] dark:text-[#ff5257]"
                        >
                          <Minus className="h-3 w-3" strokeWidth={3} />
                        </button>
                        <span className="text-[11px] font-black text-gray-900 dark:text-white">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setDishQuantity(id, qty + 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow text-[#e32c31] dark:text-[#ff5257]"
                        >
                          <Plus className="h-3 w-3" strokeWidth={3} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
              <p className="text-xs font-bold text-gray-900 dark:text-white">No dishes available</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Dishes will appear here once restaurants add them.</p>
            </div>
          )}

          {/* Selected dishes summary chips */}
          {selectedCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.values(selectedDishMap).map(({ dish, quantity }) => (
                <span
                  key={dish.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e32c31]/10 dark:bg-[#ff5257]/10 px-2 py-0.5 text-[10px] font-bold text-[#e32c31] dark:text-[#ff5257]"
                >
                  {dish.name}
                  {mealConfig.allowQuantityPerDish && quantity > 1 && ` ×${quantity}`}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Meal Time Selector */}
        <section className="mt-6">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">
              Select Meal Time
            </h2>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#e32c31] dark:text-[#ff5257]">
              Daily Schedule
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {mealSlots.map((slot) => {
              const Icon = slot.icon;
              const active = selectedSlots.includes(slot.id);
              const darkSlotClass = darkSlotClasses[slot.id] || "dark:!bg-[#1a1a1a]";
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleSlot(slot.id)}
                  className={`relative min-h-[164px] overflow-hidden rounded-[14px] border px-4 pb-3 pt-3 text-left shadow-sm transition active:scale-[0.98] ${
                    active
                      ? "border-[#e32c31] dark:border-[#ff5257] ring-2 ring-[#e32c31]/10 dark:ring-[#ff5257]/20"
                      : "border-transparent dark:border-gray-800"
                  } ${darkSlotClass}`}
                  style={{ backgroundColor: slot.backgroundColor }}
                >
                  <span className="absolute right-3 top-3 h-4 w-4 rounded-full border-2 border-[#a4a0a5] dark:border-gray-600 bg-white dark:bg-[#1a1a1a]">
                    {active && (
                      <span className="absolute inset-[3px] rounded-full bg-[#e32c31] dark:bg-[#ff5257]" />
                    )}
                  </span>
                  <div className="absolute left-4 top-3 z-10 max-w-[76%]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-[#1e1e1e] shadow-sm">
                      <Icon className="h-5 w-5" style={{ color: slot.accentColor }} strokeWidth={2.3} />
                    </span>
                    <p className="mt-2 text-[14px] font-black leading-tight text-gray-900 dark:text-white">{slot.title}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide" style={{ color: slot.accentColor }}>
                      {slot.timeLabel}
                    </p>
                  </div>
                  {slot.imageUrl ? (
                    <img
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="absolute bottom-0 left-1/2 h-[76px] w-[92%] -translate-x-1/2 object-contain"
                    />
                  ) : (
                    <span className="absolute bottom-5 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 dark:bg-black/40 text-2xl font-black opacity-80" style={{ color: slot.accentColor }}>
                      {String(slot.title).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {loadingSlots && (
            <p className="mt-3 text-center text-xs font-medium text-gray-400">
              Loading meal schedule...
            </p>
          )}
        </section>

        {/* Promo banner */}
        <section className="mt-4 flex min-h-[88px] overflow-hidden rounded-[14px] bg-[#fff0ec] dark:bg-[#201511] border border-transparent dark:border-[#3d241c] transition-colors">
          <div className="min-w-0 flex-1 px-4 py-3">
            <p className="text-lg font-black leading-5 text-[#171724] dark:text-white">Good food.</p>
            <p className="text-lg font-black leading-5 text-[#e32c31] dark:text-[#ff5257]">Made with care.</p>
            <p className="mt-2 max-w-[170px] text-[9px] font-semibold leading-3 text-[#777184] dark:text-gray-400">
              Fresh ingredients, hygienic kitchens and on-time delivery every single day.
            </p>
          </div>
          <div className="relative w-[42%] shrink-0">
            <div className="absolute bottom-2 right-3 flex h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-[#1a1a1a] text-3xl font-black text-[#e32c31] dark:text-[#ff5257]">
              🍱
            </div>
            <div className="absolute right-3 top-3 flex h-12 w-12 rotate-12 items-center justify-center rounded-full bg-[#e32c31] text-center text-[8px] font-black uppercase leading-[9px] text-white shadow-md">
              Fresh<br />Daily
            </div>
          </div>
        </section>
      </div>

      {/* Sticky bottom CTA */}
      {canContinue && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-gray-800 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            {totalItems > 0 && (
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {selectedCount} dish{selectedCount !== 1 ? "es" : ""}
                  {mealConfig.allowQuantityPerDish && totalItems !== selectedCount
                    ? ` · ${totalItems} items`
                    : ""}
                </span>
                <span className="font-bold text-gray-900 dark:text-white">Total: ₹{totalPrice.toFixed(0)}/meal</span>
              </div>
            )}
            <button
              type="button"
              onClick={continueToPlans}
              className="w-full h-12 rounded-xl bg-[#e32c31] hover:bg-[#c92429] text-sm font-black text-white shadow-lg shadow-red-200 dark:shadow-none active:scale-[0.98] flex items-center justify-center gap-1.5 transition-colors"
            >
              {location.state?.subscriptionPlan ? "Proceed to Checkout" : "Continue to Plans"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

