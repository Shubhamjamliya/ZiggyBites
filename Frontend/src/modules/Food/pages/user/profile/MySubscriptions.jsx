import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { useSubscriptions } from "@food/context/SubscriptionsContext";
import api from "@food/api";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getSubscriptionDateRange = (subscription) => {
  let start = subscription?.startDate ? new Date(subscription.startDate) : null;
  let end = subscription?.endDate ? new Date(subscription.endDate) : null;

  if ((!start || Number.isNaN(start.getTime())) && subscription?.createdAt) {
    start = new Date(subscription.createdAt);
  }

  const days = Number(subscription?.planDays || 30);
  if ((!end || Number.isNaN(end.getTime())) && start && !Number.isNaN(start.getTime())) {
    end = new Date(start);
    end.setDate(end.getDate() + days - 1);
  }

  const startText = formatDate(start);
  const endText = formatDate(end);

  if (startText === "-" && endText === "-") {
    return "Ongoing plan";
  }
  if (startText !== "-" && endText === "-") {
    return `From ${startText}`;
  }
  return `${startText} to ${endText}`;
};

const getStatusClasses = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "bg-green-50 text-green-700 border-green-200";
  if (normalized.includes("failed")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

const formatSubscriptionId = (subscriptionOrId) => {
  if (!subscriptionOrId) return "SUB-000000";
  
  if (typeof subscriptionOrId === "object") {
    if (subscriptionOrId.shortId) return subscriptionOrId.shortId;
    if (subscriptionOrId.subscriptionCode) return subscriptionOrId.subscriptionCode;
    const raw = subscriptionOrId.subscriptionId || subscriptionOrId._id || subscriptionOrId.id;
    return formatSubscriptionId(raw);
  }

  const str = String(subscriptionOrId).trim();
  if (str.startsWith("SUB-") && str.length <= 12) return str;

  const clean = str.replace(/[^a-zA-Z0-9]/g, "");
  const last6 = clean.slice(-6).toUpperCase();
  return `SUB-${last6 || "000000"}`;
};

export default function MySubscriptions() {
  const navigate = useNavigate();
  const { subscriptions, loading, refreshSubscriptions } = useSubscriptions();
  const [activeTab, setActiveTab] = useState("my"); // "my" | "explore"
  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    refreshSubscriptions().catch(() => {});
  }, [refreshSubscriptions]);

  useEffect(() => {
    let cancelled = false;
    const fetchPublicPlans = async () => {
      setLoadingPlans(true);
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
        if (!cancelled) setAvailablePlans(mapped);
      } catch {
        if (!cancelled) setAvailablePlans([]);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    };

    fetchPublicPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) => String(subscription?.status || "").toLowerCase() === "active",
      ).length,
    [subscriptions],
  );

  return (
    <AnimatedPage className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Meal Subscriptions
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeCount} active plan{activeCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 mb-4 rounded-xl bg-gray-200/70 dark:bg-gray-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("my")}
            className={`py-2 rounded-lg transition-all ${
              activeTab === "my"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            My Subscriptions {subscriptions.length > 0 ? `(${subscriptions.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("explore")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "explore"
                ? "bg-white dark:bg-gray-900 text-[#e32c31] shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Explore Plans
          </button>
        </div>

        {/* Tab 1: My Subscriptions */}
        {activeTab === "my" && (
          <>
            {loading ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-6 text-center text-sm text-gray-400">
                  Loading subscriptions...
                </CardContent>
              </Card>
            ) : subscriptions.length === 0 ? (
              <div className="space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-white dark:bg-[#1a1a1a]">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center mx-auto mb-3">
                      <UtensilsCrossed className="w-6 h-6" />
                    </div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      No subscriptions purchased yet
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-[260px] mx-auto">
                      Choose a dish and subscribe to a daily meal plan to get fresh meals delivered to your doorstep.
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                      <Button
                        onClick={() => setActiveTab("explore")}
                        className="rounded-xl bg-[#e32c31] hover:bg-[#c92428] text-white text-xs font-bold"
                      >
                        Explore Meal Plans
                      </Button>
                      <Link to="/food/user">
                        <Button
                          variant="outline"
                          className="rounded-xl text-xs font-bold w-full"
                        >
                          Browse Dishes
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick preview of available plans */}
                {availablePlans.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Available Meal Packages
                    </p>
                    <div className="space-y-2.5">
                      {availablePlans.map((plan) => (
                        <div
                          key={plan.id}
                          onClick={() => navigate("/food/user/subscription-plans")}
                          className="p-3.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">
                                {plan.title}
                              </span>
                              {plan.badge && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">
                                  {plan.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {plan.subtitle || `${plan.durationDays} Days Plan`}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-[#e32c31] flex items-center gap-0.5">
                            Subscribe <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((subscription) => {
                  const id = subscription.subscriptionId || subscription._id;
                  return (
                    <Link key={id} to={`/food/user/profile/subscriptions/${id}`} className="block">
                      <Card className="rounded-2xl border-0 shadow-sm bg-white dark:bg-[#1a1a1a]">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                                {subscription.dishName || "Subscription meal"}
                              </h2>
                              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                                <Store className="h-4 w-4" />
                                {subscription.restaurantName || "Restaurant"}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${getStatusClasses(subscription.status)}`}
                            >
                              {subscription.status || "pending"}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3">
                              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Plan
                              </p>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                {subscription.planTitle || `${subscription.planDays} Days`}
                              </p>
                            </div>
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3">
                              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <CreditCard className="h-3.5 w-3.5" />
                                Amount
                              </p>
                              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                ₹{Number(subscription.totalAmount || 0).toFixed(0)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <p className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              Meals: <span className="font-medium">{Array.isArray(subscription.meals) && subscription.meals.length > 0 ? subscription.meals.join(", ") : "-"}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-[#e32c31]" />
                              Active: <span className="font-medium">{getSubscriptionDateRange(subscription)}</span>
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                              ID: {formatSubscriptionId(subscription)}
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-[#e32c31]">
                              Details
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Explore Plans */}
        {activeTab === "explore" && (
          <div className="space-y-3">
            {loadingPlans ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-6 text-center text-sm text-gray-400">
                  Loading available plans...
                </CardContent>
              </Card>
            ) : availablePlans.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-6 text-center text-sm text-gray-400">
                  No subscription plans available right now.
                </CardContent>
              </Card>
            ) : (
              availablePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {plan.title}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {plan.subtitle || `Duration: ${plan.durationDays} Days`}
                      </p>
                    </div>
                    {plan.badge && (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {plan.description}
                    </p>
                  )}
                  {plan.features?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {plan.features.map((feat, idx) => (
                        <p key={idx} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          {feat}
                        </p>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={() => navigate("/food/user/subscription-plans")}
                    className="w-full mt-2 rounded-xl bg-[#e32c31] hover:bg-[#c92428] text-white text-xs font-bold py-2.5"
                  >
                    Select Plan & Choose Meal
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
