import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Utensils } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { subscriptionAPI } from "@food/api";

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

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAddressText = (address = {}) =>
  [
    address.street || address.address || address.formattedAddress,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

export default function SubscriptionDetails() {
  const navigate = useNavigate();
  const { subscriptionId } = useParams();
  const [subscription, setSubscription] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [subscriptionResponse, scheduleResponse] = await Promise.all([
        subscriptionAPI.getMySubscriptions(),
        subscriptionAPI.getUpcomingSchedules().catch(() => null),
      ]);

      const list =
        subscriptionResponse?.data?.data?.subscriptions ||
        subscriptionResponse?.data?.subscriptions ||
        [];
      const current = (Array.isArray(list) ? list : []).find(
        (item) => String(item.subscriptionId || item._id) === String(subscriptionId),
      );
      const upcoming =
        scheduleResponse?.data?.data?.schedules ||
        scheduleResponse?.data?.schedules ||
        [];
      setSubscription(current || null);
      setSchedules(
        (Array.isArray(upcoming) ? upcoming : []).filter(
          (schedule) =>
            String(schedule.subscriptionId?._id || schedule.subscriptionId || schedule.subscription?.subscriptionId || "") ===
            String(subscriptionId),
        ),
      );
    } catch {
      setSubscription(null);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [subscriptionId]);

  const nextSchedule = useMemo(() => schedules[0] || null, [schedules]);

  const openAddressSelector = () => {
    navigate("/food/user/address-selector", {
      state: {
        mode: "subscription-address",
        subscriptionId,
        returnTo: `/food/user/profile/subscriptions/${subscriptionId}`,
        backTo: `/food/user/profile/subscriptions/${subscriptionId}`,
      },
    });
  };

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="max-w-md mx-auto px-4 py-4 pb-24">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading subscription...
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  if (!subscription) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="max-w-md mx-auto px-4 py-4 pb-24">
          <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              Subscription not found.
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Subscription details</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subscription.restaurantName || "Restaurant"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#55254b]/10 text-[#55254b]">
                  <Utensils className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {subscription.dishName || "Subscription meal"}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Store className="h-4 w-4" />
                    {subscription.restaurantName || "Restaurant"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Plan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {subscription.planTitle || `${subscription.planDays} Days`}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <CreditCard className="h-3.5 w-3.5" />
                    Amount
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {Number(subscription.totalAmount || 0).toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  Meals: <span className="font-medium">{Array.isArray(subscription.meals) ? subscription.meals.join(", ") : "-"}</span>
                </p>
                <p>
                  Active:{" "}
                  <span className="font-medium">
                    {formatDate(subscription.startDate)} to {formatDate(subscription.endDate)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#55254b]" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Delivery address</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {getAddressText(subscription.deliveryAddress) || "No address available"}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {nextSchedule?.canChangeAddress
                  ? `Change before ${formatDateTime(nextSchedule.addressChangeDeadline)}`
                  : "Address change is closed for the next meal"}
              </p>
              <Button
                type="button"
                disabled={!nextSchedule?.canChangeAddress}
                onClick={openAddressSelector}
                className="mt-3 h-11 w-full rounded-xl bg-[#55254b] text-sm font-bold text-white hover:bg-[#6f3461] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Change address
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#55254b]" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Next subscription meals</h2>
              </div>

              {schedules.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming meals found.</p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => {
                    const scheduleId = schedule.scheduleId || schedule._id;
                    const dishes = Array.isArray(schedule.availableDishes) ? schedule.availableDishes : [];
                    return (
                      <div key={scheduleId} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {schedule.mealName} - {formatDate(schedule.serviceDate)}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Current: {schedule.dishName}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${schedule.canChangeDish ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {schedule.canChangeDish ? "Open" : "Closed"}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Change before {formatDateTime(schedule.dishChangeDeadline)}
                        </p>
                        <Button
                          type="button"
                          disabled={!schedule.canChangeDish || dishes.length === 0}
                          onClick={() =>
                            navigate(`/food/user/profile/subscriptions/${subscriptionId}/change-dish/${scheduleId}`)
                          }
                          className="mt-3 h-11 w-full rounded-xl bg-[#55254b] text-sm font-bold text-white hover:bg-[#6f3461] disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          Change dish
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
