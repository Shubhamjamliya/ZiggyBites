import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  Coffee,
  MessageCircle,
  Moon,
  Soup,
  UserCircle2,
  Utensils,
} from "lucide-react";
import api from "@food/api";

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
  const [selectedSlot, setSelectedSlot] = useState("");
  const [mealSlots, setMealSlots] = useState(fallbackMealSlots);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const dish = useMemo(() => {
    const stateDish = location.state?.dish || {};
    return {
      name: stateDish.name || searchParams.get("dish") || "Selected meal",
      restaurantName:
        stateDish.restaurantName || searchParams.get("restaurant") || "",
      categoryName: stateDish.categoryName || searchParams.get("category") || "",
      price: stateDish.price || searchParams.get("price") || "",
      image: stateDish.image || "",
    };
  }, [location.state, searchParams]);

  const canContinue = Boolean(selectedSlot);

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
            imageUrl: slot.imageUrl || "",
            icon: iconMap[slot.icon] || Utensils,
            accentColor: slot.accentColor || "#ef2b24",
            backgroundColor: slot.backgroundColor || "#fff7ed",
          }));

        if (!cancelled && mapped.length > 0) {
          setMealSlots(mapped);
        }
      } catch {
        if (!cancelled) setMealSlots(fallbackMealSlots);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    loadMealSlots();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-950 dark:bg-[#0a0a0a] dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-24 pt-4">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 active:bg-gray-100 dark:text-white dark:active:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-left text-xl font-black tracking-tight">
            Choose your meal
          </h1>
          <button
            type="button"
            onClick={() => navigate("/food/user/profile")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-700 shadow-sm dark:bg-white/10 dark:text-white"
            aria-label="Profile"
          >
            <UserCircle2 className="h-6 w-6" />
          </button>
        </header>

        <section className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex gap-3">
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-red-50">
              {dish.image ? (
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-black text-[#ef2b24]">
                  {String(dish.name || "M").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black">{dish.name}</p>
              {[dish.restaurantName, dish.categoryName]
                .filter(Boolean)
                .map((line) => (
                  <p
                    key={line}
                    className="mt-0.5 truncate text-xs font-semibold text-gray-500 dark:text-gray-400"
                  >
                    {line}
                  </p>
                ))}
              {dish.price && (
                <p className="mt-1 text-sm font-black text-[#ef2b24]">
                  Rs. {dish.price}
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="mt-5 text-sm font-semibold leading-6 text-gray-600 dark:text-gray-300">
          Pick your preferred meal time to get started. Once you choose at
          least one meal, you can continue to the plan page.
        </p>

        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-black tracking-tight">
              Select Meal Time
            </h2>
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ef2b24]">
              Daily Schedule
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {mealSlots.map((slot) => {
              const Icon = slot.icon;
              const active = selectedSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlot(slot.id)}
                  className={`relative min-h-[184px] overflow-hidden rounded-[10px] border p-4 text-left shadow-sm transition active:scale-[0.98] ${
                    active
                      ? "border-[#ef2b24] bg-red-50 ring-2 ring-[#ef2b24]/15 dark:bg-[#3a1212]"
                      : "border-transparent bg-[#f6f4fb] dark:bg-white/10"
                  }`}
                  style={{
                    backgroundColor: active ? "#fff1f1" : slot.backgroundColor,
                  }}
                >
                  <span className="absolute right-3 top-3 h-4 w-4 rounded-full border-2 border-gray-400 bg-white">
                    {active && (
                      <span className="absolute inset-0.5 rounded-full bg-[#ef2b24]" />
                    )}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                    <Icon className="h-6 w-6" style={{ color: slot.accentColor }} />
                  </span>
                  <p className="mt-5 text-base font-black">{slot.title}</p>
                  <p
                    className="mt-1 text-[10px] font-black uppercase tracking-[0.08em]"
                    style={{ color: slot.accentColor }}
                  >
                    {slot.timeLabel}
                  </p>
                  {slot.imageUrl ? (
                    <img
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="absolute bottom-0 right-0 h-24 w-[86%] object-contain"
                    />
                  ) : (
                    <span className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-2xl font-black" style={{ color: slot.accentColor }}>
                      {String(slot.title).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {loadingSlots && (
            <p className="mt-3 text-center text-xs font-semibold text-gray-400">
              Loading meal schedule...
            </p>
          )}
        </section>

        <section className="mt-7 overflow-hidden rounded-[22px] bg-gray-200 dark:bg-white/10">
          {dish.image ? (
            <img
              src={dish.image}
              alt={dish.name}
              className="h-32 w-full object-cover grayscale"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-gray-100 text-gray-400 dark:bg-white/10">
              <Moon className="h-10 w-10" />
            </div>
          )}
        </section>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            navigate("/food/user/cart", {
              state: { dish, mealSlot: selectedSlot },
            })
          }
          className={`mt-6 h-12 rounded-2xl text-sm font-black text-white shadow-sm transition ${
            canContinue
              ? "bg-[#ef2b24] active:scale-[0.98]"
              : "bg-gray-300 dark:bg-white/15"
          }`}
        >
          Continue
        </button>

        <div className="fixed bottom-24 right-5 z-20 md:right-[calc(50%-13rem)]">
          <button
            type="button"
            onClick={() => navigate("/food/user/help")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef2b24] text-white shadow-xl"
            aria-label="Help"
          >
            <MessageCircle className="h-7 w-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
