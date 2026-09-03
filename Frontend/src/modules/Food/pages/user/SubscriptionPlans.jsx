import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Edit3,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import api from "@food/api";
import { loadAppCustomization } from "@food/utils/appCustomization";

const featureIcons = [Clock3, CalendarCheck, ShieldCheck];

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (mounted && settings.subscriptionFlowEnabled === false) {
          navigate("/food/user", { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const dish = useMemo(() => {
    const stateDish = location.state?.dish || {};
    return {
      id: stateDish.id || stateDish.itemId || searchParams.get("dishId") || "",
      itemId: stateDish.itemId || stateDish.id || searchParams.get("dishId") || "",
      name: stateDish.name || searchParams.get("dish") || "Selected meal",
      restaurantName:
        stateDish.restaurantName || searchParams.get("restaurant") || "",
      restaurantId:
        stateDish.restaurantId || searchParams.get("restaurantId") || "",
      categoryName: stateDish.categoryName || searchParams.get("category") || "",
      price: stateDish.price || searchParams.get("price") || "",
      image: stateDish.image || "",
      foodType: stateDish.foodType || "",
    };
  }, [location.state, searchParams]);

  const selectedMeals = useMemo(() => {
    const meals = Array.isArray(location.state?.selectedMeals)
      ? location.state.selectedMeals
      : [];
    return meals.filter(Boolean);
  }, [location.state]);

  const selectedDishes = useMemo(() => {
    if (Array.isArray(location.state?.selectedDishes) && location.state.selectedDishes.length > 0) {
      return location.state.selectedDishes;
    }
    return dish ? [dish] : [];
  }, [location.state, dish]);

  const selectedMealCount = selectedMeals.length || 1;
  const selectedDishPrice = useMemo(() => {
    if (Array.isArray(location.state?.selectedDishes) && location.state.selectedDishes.length > 0) {
      return location.state.selectedDishes.reduce(
        (sum, item) => sum + (Number(item.price || 0) * (Number(item.quantity) || 1)),
        0
      );
    }
    return Number(dish.price || 0) || 0;
  }, [location.state, dish]);

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
            currency: plan.currency || "INR",
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
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-4">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="flex-1 text-left text-lg font-bold text-gray-900 dark:text-white">
            Choose your plan
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/food/user/help")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-750"
              aria-label="Help & Support"
              title="Help & Support"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/food/user/profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-750"
              aria-label="Profile"
            >
              <UserCircle2 className="h-6 w-6" />
            </button>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-[16px] bg-[#fff6f0] dark:bg-[#201511] border border-transparent dark:border-[#3d241c] px-4 py-4 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#e3282c] dark:text-[#ff5257]">
                Your Selection
              </p>
              {selectedDishPrice > 0 ? (
                <>
                  <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white truncate">
                    {dish.name || "Selected meal"} ({selectedMealCount} meal{selectedMealCount === 1 ? "" : "s"})
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    INR {selectedDishPrice.toLocaleString("en-IN")}/meal {dish.restaurantName ? `• ${dish.restaurantName}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
                    No meal selected yet
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    Choose a plan below, then pick your daily meal.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                navigate({
                  pathname: "/food/user/choose-meal",
                  search: `?dish=${encodeURIComponent(dish.name || "")}&dishId=${encodeURIComponent(dish.itemId || dish.id || "")}&restaurant=${encodeURIComponent(dish.restaurantName || "")}&restaurantId=${encodeURIComponent(dish.restaurantId || "")}&category=${encodeURIComponent(dish.categoryName || "")}${dish.price ? `&price=${encodeURIComponent(dish.price)}` : ""}`,
                }, { state: { dish } })
              }
              className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#e3282c] dark:text-[#ff5257] mt-1 hover:underline"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {selectedDishPrice > 0 ? "Edit Meals" : "Choose Meal"}
            </button>
          </div>
        </section>

        <main className="mt-5 space-y-4">
          {loading && plans.length === 0 ? (
            <div className="rounded-[16px] border border-red-100 dark:border-gray-800 p-8 text-center text-sm font-medium text-gray-400">
              Loading subscription plans...
            </div>
          ) : (
            plans.length > 0 ? plans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-[20px] border border-[#e3282c] dark:border-[#ff5257]/60 bg-white dark:bg-[#1a1a1a] p-5 shadow-sm transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {plan.title}
                    </h2>
                    {plan.subtitle && (
                      <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">
                        {plan.subtitle}
                      </p>
                    )}
                    {plan.description && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  {plan.badge && (
                    <span className="rounded-full bg-[#e3282c] dark:bg-[#ff5257] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mt-6 bg-[#fafafa] dark:bg-[#121212] rounded-[12px] p-3 border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#e3282c] dark:text-[#ff5257]">
                    Pricing
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-gray-900 dark:text-white">
                    {selectedDishPrice > 0
                      ? `INR ${(selectedDishPrice * selectedMealCount * plan.durationDays).toLocaleString("en-IN")} + GST + delivery`
                      : `From ~INR ${(99 * selectedMealCount * plan.durationDays).toLocaleString("en-IN")} (${plan.durationDays} Days)`}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {selectedDishPrice > 0
                      ? `${plan.durationDays} days x ${selectedMealCount} meal${selectedMealCount === 1 ? "" : "s"} x INR ${selectedDishPrice.toLocaleString("en-IN")}`
                      : "Calculated based on your selected daily meal dish"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedDishPrice > 0) {
                      navigate("/food/user/checkout", {
                        state: { dish, selectedDishes, selectedMeals, subscriptionPlan: plan },
                      });
                    } else {
                      navigate({
                        pathname: "/food/user/choose-meal",
                        search: `?planId=${encodeURIComponent(plan.id || "")}&duration=${encodeURIComponent(plan.durationDays || "")}`,
                      }, { state: { subscriptionPlan: plan } });
                    }
                  }}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e3282c] hover:bg-[#c42226] text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  {selectedDishPrice > 0 ? "Continue to Checkout" : "Choose Meal & Subscribe"}
                  <ChevronRight className="h-4 w-4" />
                </button>

                {plan.features.length > 0 && (
                  <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-5">
                    <div className="space-y-3.5">
                      {plan.features.map((feature, index) => {
                        const Icon = featureIcons[index % featureIcons.length];
                        return (
                          <div key={`${plan.id}-${feature}`} className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40 text-[#e3282c] dark:text-[#ff5257]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
               <div className="rounded-[16px] border border-dashed border-red-100 dark:border-gray-800 p-8 text-center text-sm font-medium text-gray-400">
                No subscription plans available.
              </div>
            )
          )}
        </main>

        <div className="fixed bottom-24 right-5 z-20 md:right-[calc(50%-13rem)]">
          <button
            type="button"
            onClick={() => navigate("/food/user/help")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e3282c] hover:bg-[#c42226] text-white shadow-lg transition-transform active:scale-95"
            aria-label="Help"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
