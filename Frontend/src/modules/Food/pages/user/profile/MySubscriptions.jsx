import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3, CreditCard, Store } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { subscriptionAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { toast } from "sonner";

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

const getStatusClasses = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (normalized.includes("failed")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
};

export default function MySubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadSubscriptions = async () => {
      setLoading(true);
      try {
        const response = await subscriptionAPI.getMySubscriptions();
        const scheduleResponse = await subscriptionAPI.getUpcomingSchedules().catch(() => null);
        const list =
          response?.data?.data?.subscriptions ||
          response?.data?.subscriptions ||
          [];
        const upcoming =
          scheduleResponse?.data?.data?.schedules ||
          scheduleResponse?.data?.schedules ||
          [];
        if (mounted) {
          setSubscriptions(Array.isArray(list) ? list : []);
          setSchedules(Array.isArray(upcoming) ? upcoming : []);
        }
      } catch {
        if (mounted) setSubscriptions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSubscriptions();
    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) =>
          String(subscription?.status || "").toLowerCase() === "active",
      ).length,
    [subscriptions],
  );

  const handleDishChange = async (schedule, dishId) => {
    if (!dishId || dishId === schedule.dishId) return;
    const scheduleId = schedule.scheduleId || schedule._id;
    try {
      setChangingId(scheduleId);
      const response = await subscriptionAPI.changeScheduleDish(scheduleId, { dishId });
      const payload = response?.data?.data || {};

      if (payload.status === "payment_required" && payload.razorpay) {
        await initRazorpayPayment({
          key: payload.razorpay.key,
          amount: payload.razorpay.amount,
          currency: payload.razorpay.currency || "INR",
          order_id: payload.razorpay.orderId,
          name: "Appzeto Food",
          description: "Subscription dish change",
          prefill: {},
          notes: { scheduleId },
          handler: async (razorpayResponse) => {
            try {
              await subscriptionAPI.verifyDishChangePayment(scheduleId, {
                razorpayOrderId: razorpayResponse.razorpay_order_id || payload.razorpay.orderId,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpaySignature: razorpayResponse.razorpay_signature,
              });
              toast.success("Dish changed successfully");
              const refreshed = await subscriptionAPI.getUpcomingSchedules();
              setSchedules(refreshed?.data?.data?.schedules || []);
            } catch (error) {
              toast.error(error?.response?.data?.message || "Payment verification failed");
            } finally {
              setChangingId("");
            }
          },
          onError: (error) => {
            toast.error(error?.description || error?.message || "Payment failed");
            setChangingId("");
          },
          onClose: () => {
            toast.info("Payment was not completed");
            setChangingId("");
          },
        });
        return;
      }

      if (payload.status === "wallet_credited") {
        toast.success("Dish changed and price difference added to wallet");
      } else {
        toast.success("Dish changed successfully");
      }
      const refreshed = await subscriptionAPI.getUpcomingSchedules();
      setSchedules(refreshed?.data?.data?.schedules || []);
      setChangingId("");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to change dish");
      setChangingId("");
    }
  };

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
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
              Purchased Subscriptions
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeCount} active plan{activeCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading subscriptions...
            </CardContent>
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                No subscriptions purchased yet
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose a dish and plan to start your meal subscription.
              </p>
              <Link to="/food/user" className="inline-block mt-4">
                <Button className="rounded-xl bg-[#55254b] hover:bg-[#3c0f3d] text-white">
                  Explore meals
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <Card
                key={subscription.subscriptionId || subscription._id}
                className="rounded-2xl border-0 shadow-sm bg-white dark:bg-[#1a1a1a]"
              >
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
                        Rs. {Number(subscription.totalAmount || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Meals:{" "}
                      <span className="font-medium">
                        {Array.isArray(subscription.meals) && subscription.meals.length > 0
                          ? subscription.meals.join(", ")
                          : "-"}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#55254b]" />
                      Active:{" "}
                      <span className="font-medium">
                        {formatDate(subscription.startDate)} to {formatDate(subscription.endDate)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>ID: {subscription.subscriptionId || "-"}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#55254b] dark:text-[#d6bfd0]">
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {schedules.length > 0 && (
              <div className="pt-2">
                <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
                  Upcoming meal changes
                </h2>
                <div className="space-y-3">
                  {schedules.slice(0, 6).map((schedule) => {
                    const scheduleId = schedule.scheduleId || schedule._id;
                    const dishes = Array.isArray(schedule.availableDishes) ? schedule.availableDishes : [];
                    return (
                      <Card key={scheduleId} className="rounded-2xl border-0 shadow-sm bg-white dark:bg-[#1a1a1a]">
                        <CardContent className="p-4">
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
                            Change before {new Date(schedule.dishChangeDeadline).toLocaleString("en-IN")}
                          </p>
                          <select
                            value={schedule.dishId}
                            disabled={!schedule.canChangeDish || changingId === scheduleId || dishes.length === 0}
                            onChange={(event) => handleDishChange(schedule, event.target.value)}
                            className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-[#111] dark:text-white"
                          >
                            <option value={schedule.dishId}>{schedule.dishName}</option>
                            {dishes
                              .filter((dish) => dish.id !== schedule.dishId)
                              .map((dish) => (
                                <option key={dish.id} value={dish.id}>
                                  {dish.name} - Rs. {Number(dish.price || 0).toFixed(0)}
                                </option>
                              ))}
                          </select>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
