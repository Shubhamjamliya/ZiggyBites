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
  const [selectedSlots, setSelectedSlots] = useState([]);
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

  const canContinue = selectedSlots.length > 0;
  const toggleSlot = (slotId) => {
    setSelectedSlots((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId],
    );
  };

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
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-4">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 active:bg-gray-100"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="flex-1 text-left text-lg font-bold">
            Choose your meal
          </h1>
          <button
            type="button"
            onClick={() => navigate("/food/user/profile")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-700 shadow-sm"
            aria-label="Profile"
          >
            <UserCircle2 className="h-6 w-6" />
          </button>
        </header>

        <section className="mt-5 rounded-[16px] border border-gray-100 bg-gray-50 p-3">
          <div className="flex gap-3">
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-red-50">
              {dish.image ? (
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-bold text-[#ef2b24]">
                  {String(dish.name || "M").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{dish.name}</p>
              {[dish.restaurantName, dish.categoryName]
                .filter(Boolean)
                .map((line) => (
                  <p
                    key={line}
                    className="mt-0.5 truncate text-xs font-medium text-gray-500"
                  >
                    {line}
                  </p>
                ))}
              {dish.price && (
                <p className="mt-1 text-sm font-bold text-[#ef2b24]">
                  Rs. {dish.price}
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="mt-5 text-sm font-medium leading-6 text-gray-600">
          Pick your preferred meal time to get started. Once you choose at
          least one meal, you can continue to the plan page.
        </p>

        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold">
              Select Meal Time
            </h2>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#ef2b24]">
              Daily Schedule
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {mealSlots.map((slot) => {
              const Icon = slot.icon;
              const active = selectedSlots.includes(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleSlot(slot.id)}
                  className={`relative min-h-[160px] overflow-hidden rounded-[16px] border p-4 text-left shadow-sm transition active:scale-[0.98] ${
                    active
                      ? "border-[#ef2b24] ring-2 ring-[#ef2b24]/10"
                      : "border-transparent bg-[#f9f9f9]"
                  }`}
                  style={{
                    backgroundColor: active ? "#fff1f1" : slot.backgroundColor,
                  }}
                >
                  <span className="absolute right-3 top-3 h-5 w-5 rounded-full border-2 border-gray-300 bg-white">
                    {active && (
                      <span className="absolute inset-0.5 rounded-full bg-[#ef2b24]" />
                    )}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                    <Icon className="h-5 w-5" style={{ color: slot.accentColor }} strokeWidth={2} />
                  </span>
                  <p className="mt-4 text-[15px] font-bold">{slot.title}</p>
                  <p
                    className="mt-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: slot.accentColor }}
                  >
                    {slot.timeLabel}
                  </p>
                  {slot.imageUrl ? (
                    <img
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="absolute bottom-0 right-0 h-20 w-[80%] object-contain mix-blend-multiply opacity-80"
                    />
                  ) : (
                    <span className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/60 text-xl font-bold opacity-70" style={{ color: slot.accentColor }}>
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

        <section className="mt-7 overflow-hidden rounded-[16px] bg-gray-100">
          {dish.image ? (
            <img
              src={dish.image}
              alt={dish.name}
              className="h-28 w-full object-cover grayscale opacity-50"
            />
          ) : (
            <div className="flex h-28 w-full items-center justify-center text-gray-400">
              <Moon className="h-8 w-8" />
            </div>
          )}
        </section>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            const mealsToPass = mealSlots
              .filter((slot) => selectedSlots.includes(slot.id))
              .map(({ icon, ...rest }) => rest);
            navigate("/food/user/subscription-plans", {
              state: {
                dish,
                selectedMeals: mealsToPass,
              },
            });
          }}
          className={`mt-6 h-12 w-full rounded-xl text-sm font-bold text-white shadow-sm transition ${
            canContinue
              ? "bg-[#e3282c] active:scale-[0.98]"
              : "bg-gray-300"
          }`}
        >
          Continue
        </button>

        <div className="fixed bottom-24 right-5 z-20 md:right-[calc(50%-13rem)]">
          <button
            type="button"
            onClick={() => navigate("/food/user/help")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e3282c] text-white shadow-xl"
            aria-label="Help"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
