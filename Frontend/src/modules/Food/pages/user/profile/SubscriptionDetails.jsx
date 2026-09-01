import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Utensils } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { useSubscriptions } from "@food/context/SubscriptionsContext";

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

const formatScheduleDateTime = (schedule) => {
  if (!schedule) return "-";
  const dateVal = schedule.serviceDate || schedule.deliveryDate || schedule.scheduledFor || schedule.orderAt;
  return formatDateTime(dateVal);
};

const getSubscriptionDateRange = (sub) => {
  let start = sub?.startDate ? new Date(sub.startDate) : null;
  let end = sub?.endDate ? new Date(sub.endDate) : null;

  if ((!start || Number.isNaN(start.getTime())) && sub?.createdAt) {
    start = new Date(sub.createdAt);
  }

  const days = Number(sub?.planDays || 30);
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

const getAddressText = (address = {}) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  const parts = [
    address.label ? `[${address.label}]` : "",
    address.name || address.fullName,
    address.street || address.address || address.formattedAddress || address.addressLine1,
    address.additionalDetails || address.addressLine2 || address.landmark,
    address.city,
    address.state,
    address.zipCode || address.postalCode || address.pincode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
};

export default function SubscriptionDetails() {
  const navigate = useNavigate();
  const { subscriptionId } = useParams();
  const {
    loading,
    getSubscriptionById,
    getSchedulesForSubscription,
    refreshSubscriptions,
  } = useSubscriptions();

  const subscription = getSubscriptionById(subscriptionId);
  const schedules = getSchedulesForSubscription(subscriptionId);

  useEffect(() => {
    if (!subscription && subscriptionId) {
      refreshSubscriptions({ silent: false }).catch(() => {});
    }
  }, [subscription, subscriptionId, refreshSubscriptions]);

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

  const nextDeliveryAddressText =
    getAddressText(
      nextSchedule?.deliveryAddress ||
      nextSchedule?.subscription?.deliveryAddress ||
      subscription.deliveryAddress ||
      subscription.address ||
      {}
    ) || "Default delivery address";

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
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#55254b]/10 text-[#55254b] dark:text-[#d38abf]">
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
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Plan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {subscription.planTitle || `${subscription.planDays} Days`}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <CreditCard className="h-3.5 w-3.5" />
                    Amount
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    ₹{Number(subscription.totalAmount || 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Duration</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Clock3 className="h-4 w-4 text-[#55254b] dark:text-[#d38abf]" />
                  {getSubscriptionDateRange(subscription)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Meals</p>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {Array.isArray(subscription.meals) && subscription.meals.length > 0
                    ? subscription.meals.join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Registered Delivery Address</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#55254b] dark:text-[#d38abf]" />
                  <span>{getAddressText(subscription.deliveryAddress || subscription.address || {}) || "No address selected"}</span>
                </p>
                <Button variant="outline" className="mt-3 rounded-xl" onClick={openAddressSelector}>
                  Change address
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Next Delivery with Target Address */}
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Next delivery</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {nextSchedule ? formatScheduleDateTime(nextSchedule) : "No upcoming delivery"}
                  </p>
                  {nextSchedule?.mealName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {nextSchedule.mealName} {nextSchedule.dishName ? `• ${nextSchedule.dishName}` : ""}
                    </p>
                  )}
                </div>
                <div className="rounded-full bg-[#55254b]/10 dark:bg-[#55254b]/30 px-3 py-1 text-xs font-semibold text-[#55254b] dark:text-[#d38abf]">
                  {subscription.status || "pending"}
                </div>
              </div>

              {/* Next Delivery Address Card */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 border border-gray-100 dark:border-gray-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-[#55254b] dark:text-[#d38abf]" />
                  Next Delivery Address
                </p>
                <p className="text-xs font-medium text-gray-900 dark:text-gray-200">
                  {nextDeliveryAddressText}
                </p>
              </div>

              {schedules.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Upcoming Deliveries ({schedules.length})
                  </p>
                  {schedules.map((schedule) => (
                    <div
                      key={schedule._id || schedule.scheduleId || `${schedule.serviceDate || schedule.deliveryDate}-${schedule.mealName || schedule.slot}`}
                      className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/60 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatScheduleDateTime(schedule)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {schedule.mealName ? `${schedule.mealName} • ` : ""}{schedule.dishName || subscription.dishName || "Meal"}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">
                        {schedule.status || "Scheduled"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming schedules available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
