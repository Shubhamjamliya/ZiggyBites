import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Edit3,
  MessageCircle,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import api from "@food/api";

const featureIcons = [Clock3, CalendarCheck, ShieldCheck];

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const selectedMeals = useMemo(() => {
    const meals = Array.isArray(location.state?.selectedMeals)
      ? location.state.selectedMeals
      : [];
    return meals.filter(Boolean);
  }, [location.state]);

  const selectedMealCount = selectedMeals.length || 1;

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const response = await api.get("/food/subscription-plans/public");
        const apiPlans = response?.data?.data?.plans || response?.data?.plans || [];
        const mapped = apiPlans
          .filter((plan) => plan?.title && plan?.durationDays)
          .map((plan, index) => ({
            id: plan._id || plan.id || `plan-${index}`,
            title: plan.title,
            durationDays: plan.durationDays,
            subtitle: plan.subtitle || "",
            description: plan.description || "",
            badge: plan.badge || "",
            priceLabel: plan.priceLabel || "Price based on your meal selection",
            features: Array.isArray(plan.features) ? plan.features : [],
          }));

        if (!cancelled) {
          setPlans(mapped);
        }
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-950 dark:bg-[#0a0a0a] dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-4">
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
            Choose your plan
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

        <section className="mt-4 overflow-hidden rounded-[10px] bg-[#fff0f0] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#e92823]">
                Your Selection
              </p>
              <p className="mt-5 text-sm font-black text-gray-950">
                You have selected {selectedMealCount} meal{selectedMealCount === 1 ? "" : "s"}.
              </p>
              <p className="text-xs font-semibold text-gray-700">
                Price will be calculated based on this selection.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate({
                  pathname: "/food/user/choose-meal",
                  search: `?dish=${encodeURIComponent(dish.name || "")}&restaurant=${encodeURIComponent(dish.restaurantName || "")}&category=${encodeURIComponent(dish.categoryName || "")}${dish.price ? `&price=${encodeURIComponent(dish.price)}` : ""}`,
                }, { state: { dish } })
              }
              className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#e92823]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Meals
            </button>
          </div>
        </section>

        <main className="mt-5 space-y-4">
          {loading && plans.length === 0 ? (
            <div className="rounded-[10px] border border-red-100 p-8 text-center text-sm font-semibold text-gray-400">
              Loading subscription plans...
            </div>
          ) : (
            plans.length > 0 ? plans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-[18px] border border-[#ef2b24] bg-white p-6 shadow-sm dark:bg-[#111]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">
                      {plan.title}
                    </h2>
                    {plan.subtitle && (
                      <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {plan.subtitle}
                      </p>
                    )}
                    {plan.description && (
                      <p className="mt-2 text-sm font-medium leading-5 text-gray-600 dark:text-gray-400">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  {plan.badge && (
                    <span className="rounded-full bg-[#e92823] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e92823]">
                    Pricing
                  </p>
                  <p className="mt-2 text-lg font-black text-gray-950 dark:text-white">
                    {plan.priceLabel}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/food/user/cart", {
                      state: { dish, selectedMeals, subscriptionPlan: plan },
                    })
                  }
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#e92823] text-sm font-black text-white shadow-sm active:scale-[0.98]"
                >
                  View details
                  <ChevronRight className="h-4 w-4" />
                </button>

                {plan.features.length > 0 && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="space-y-4">
                      {plan.features.map((feature, index) => {
                        const Icon = featureIcons[index % featureIcons.length];
                        return (
                          <div key={`${plan.id}-${feature}`} className="flex items-center gap-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-[#e92823]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {feature}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            )) : (
              <div className="rounded-[10px] border border-dashed border-red-100 p-8 text-center text-sm font-semibold text-gray-400">
                No subscription plans available.
              </div>
            )
          )}
        </main>

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
