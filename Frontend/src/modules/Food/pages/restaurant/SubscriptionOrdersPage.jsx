import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";

const formatSubscriptionDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getSubscriptionGroupKey = (meal) =>
  meal?.subscription?.subscriptionId?._id ||
  meal?.subscription?.subscriptionId ||
  meal?.subscriptionId?._id ||
  meal?.subscriptionId ||
  meal?.subscription?._id ||
  meal?.subscription?.id ||
  meal?.subscriptionId?.id ||
  meal?.subscriptionKey ||
  meal?.userId?._id ||
  meal?.user?._id ||
  meal?.customerId ||
  meal?.customerPhone ||
  meal?.customerName ||
  meal?.deliveryAddressId ||
  meal?.groupId ||
  meal?._id;

function SubscriptionOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptionId } = useParams();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingScheduleIds, setSendingScheduleIds] = useState({});

  const subscriptionLabel =
    location.state?.subscriptionLabel || `Subscription ${String(subscriptionId || "").slice(-6)}`;

  useEffect(() => {
    let active = true;

    const fetchMeals = async () => {
      try {
        setLoading(true);
        const response = await restaurantAPI.getTodaySubscriptionMeals({ view: "all" });
        const rows = response?.data?.data?.schedules || [];
        if (!active) return;
        setMeals(
          rows.filter(
            (meal) =>
              String(getSubscriptionGroupKey(meal)) === String(subscriptionId) &&
              !["cancelled", "skipped"].includes(String(meal.status || "").toLowerCase()),
          ),
        );
      } catch (error) {
        if (active) setMeals([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMeals();
    const interval = setInterval(fetchMeals, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [subscriptionId]);

  const groupedMeals = useMemo(() => {
    return [...meals].sort((a, b) => {
      const timeA = new Date(a.serviceDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.serviceDate || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }, [meals]);

  const handleSendMeal = async (meal) => {
    const scheduleId = meal.scheduleId || meal._id;
    if (!scheduleId || sendingScheduleIds[scheduleId]) return;

    try {
      setSendingScheduleIds((prev) => ({ ...prev, [scheduleId]: true }));
      await restaurantAPI.sendSubscriptionMealToDelivery(scheduleId);
      toast.success("Subscription meal sent to delivery");
      const response = await restaurantAPI.getTodaySubscriptionMeals({ view: "all" });
      const rows = response?.data?.data?.schedules || [];
      setMeals(
        rows.filter(
          (item) =>
            String(getSubscriptionGroupKey(item)) === String(subscriptionId) &&
            !["cancelled", "skipped"].includes(String(item.status || "").toLowerCase()),
        ),
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send subscription meal");
    } finally {
      setSendingScheduleIds((prev) => {
        const next = { ...prev };
        delete next[scheduleId];
        return next;
      });
    }
  };

  const now = Date.now();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/food/restaurant")}
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-orange">Subscription</p>
          <h1 className="mt-1 text-lg font-black text-gray-900">{subscriptionLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">All scheduled meals for this subscription appear here.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white py-12 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary-orange" />
          </div>
        ) : groupedMeals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-900">No meals found for this subscription</p>
            <p className="mt-1 text-xs text-gray-500">This subscription may not have any due orders right now.</p>
          </div>
        ) : (
        <div className="space-y-3">
            {groupedMeals.map((meal) => {
              const scheduleId = meal.scheduleId || meal._id;
              const sent = meal.status === "sent_to_delivery";
              const cancelled = ["cancelled", "skipped"].includes(String(meal.status || "").toLowerCase());
              const serviceTime = meal.serviceDate ? new Date(meal.serviceDate).getTime() : 0;
              const canSend = !sent && !cancelled && serviceTime <= now;

              return (
                <div
                  key={scheduleId}
                  className="rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 border-l-4 border-primary-orange/80 pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{meal.dishName || "Subscription meal"}</p>
                        <span className="rounded-full bg-primary-orange/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary-orange">
                          {meal.mealName || "Meal"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{formatSubscriptionDate(meal.serviceDate)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        sent
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-600"
                          : cancelled
                            ? "border border-red-200 bg-red-50 text-red-600"
                            : "border border-amber-200 bg-amber-50 text-amber-700"
                      }`}>
                      {sent ? "Sent" : meal.status || "Scheduled"}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!canSend || sendingScheduleIds[scheduleId]}
                    onClick={() => handleSendMeal(meal)}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-orange text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-gray-200 disabled:text-gray-500">
                    {sendingScheduleIds[scheduleId] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sent ? "Already sent" : canSend ? "Send to delivery boy" : "Scheduled for later"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionOrdersPage;
