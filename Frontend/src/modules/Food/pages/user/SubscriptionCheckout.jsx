import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  IndianRupee,
  Lock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import { useProfile } from "@food/context/ProfileContext";
import { useLocation as useUserLocation } from "@food/hooks/useLocation";

const RUPEE_SYMBOL = "\u20B9";

const formatFullAddress = (address) => {
  if (!address) return "";
  if (
    address.formattedAddress &&
    address.formattedAddress !== "Select location"
  ) {
    return address.formattedAddress;
  }
  const parts = [
    address.street,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return address.address || "";
};

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, getDefaultAddress } = useProfile();
  const { location: currentLocation } = useUserLocation();

  const [autoPay, setAutoPay] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const { dish, selectedMeals = [], subscriptionPlan } = location.state || {};

  const basePrice = Number.parseFloat(dish?.price || 0) || 319;
  const mealCount = selectedMeals.length || 1;
  const days = subscriptionPlan?.durationDays || 30;
  const totalFoodCost = basePrice * mealCount * days;
  const deliveryFeePerDay = 10;
  const totalDeliveryCharges = deliveryFeePerDay * days;
  const totalAmount = totalFoodCost + totalDeliveryCharges;

  const savedAddress = getDefaultAddress();
  const defaultAddress = useMemo(() => {
    if (savedAddress) return savedAddress;
    if (!currentLocation?.latitude || !currentLocation?.longitude) return null;

    const formattedAddress =
      currentLocation.formattedAddress || currentLocation.address || "";
    if (!formattedAddress || formattedAddress === "Select location") return null;

    return {
      label: "Home",
      formattedAddress,
      address: formattedAddress,
      street:
        currentLocation.street ||
        currentLocation.address ||
        currentLocation.area ||
        "Current Location",
      additionalDetails: currentLocation.area || "",
      city: currentLocation.city || currentLocation.area || "Current City",
      state: currentLocation.state || currentLocation.city || "Current State",
      zipCode: currentLocation.postalCode || currentLocation.zipCode || "",
      phone: userProfile?.phone || "",
      location: {
        type: "Point",
        coordinates: [currentLocation.longitude, currentLocation.latitude],
      },
    };
  }, [currentLocation, savedAddress, userProfile?.phone]);

  const addressLabel = formatFullAddress(defaultAddress);
  const selectedMealLabel = selectedMeals
    .map((meal) => String(meal?.title || meal?.name || "").trim())
    .filter(Boolean)
    .join(", ");

  const orderNote = useMemo(() => {
    const noteParts = [
      `Subscription plan: ${subscriptionPlan?.title || `${days} Days`}`,
      selectedMealLabel ? `Meals: ${selectedMealLabel}` : "",
      `Auto-renew: ${autoPay ? "Enabled" : "Disabled"}`,
    ].filter(Boolean);
    return noteParts.join(" | ");
  }, [autoPay, days, selectedMealLabel, subscriptionPlan?.title]);

  const handlePlaceOrder = async () => {
    console.log("[SubscriptionCheckout] Proceed to pay clicked", {
      rawState: location.state || null,
      dish,
      selectedMeals,
      subscriptionPlan,
      defaultAddress,
      addressLabel,
      totalFoodCost,
      totalDeliveryCharges,
      totalAmount,
    });

    if (!dish?.restaurantId) {
      console.warn("[SubscriptionCheckout] Missing restaurantId", {
        dish,
        rawState: location.state || null,
      });
      toast.error("Restaurant details are missing for this dish.");
      return;
    }

    if (!dish?.itemId && !dish?.id) {
      console.warn("[SubscriptionCheckout] Missing dish/item id", {
        dish,
        rawState: location.state || null,
      });
      toast.error("Dish details are missing for this subscription.");
      return;
    }

    if (!selectedMeals.length) {
      toast.error("Please select at least one meal.");
      navigate(-1);
      return;
    }

    if (!defaultAddress || !addressLabel) {
      toast.error("Please add a delivery address before payment.");
      navigate("/food/user/profile");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const customerName = userProfile?.name || userProfile?.fullName || "User";
      const customerPhone = userProfile?.phone || defaultAddress?.phone || "";
      const payload = {
        dishId: dish.itemId || dish.id,
        dishName: dish.name || "Subscription meal",
        restaurantId: dish.restaurantId,
        restaurantName: dish.restaurantName || "",
        meals: selectedMeals
          .map((meal) => String(meal?.title || meal?.name || "").trim())
          .filter(Boolean),
        planId: subscriptionPlan?.id || undefined,
        planDays: days,
        totalAmount,
        currency: "INR",
      };

      console.log("[SubscriptionCheckout] Subscription create-order payload", payload);

      const response = await subscriptionAPI.createOrder(payload);
      const { subscription, order, razorpay } = response?.data?.data || {};

      console.log("[SubscriptionCheckout] Create-order response", {
        response: response?.data,
        subscription,
        order,
        razorpay,
      });

      if (!subscription || !order || !razorpay?.orderId || !razorpay?.key) {
        throw new Error("Unable to initialize subscription payment.");
      }

      const companyName = await getCompanyNameAsync();
      const formattedPhone = String(customerPhone || "")
        .replace(/\D/g, "")
        .slice(-10);

      let paymentHandled = false;

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `${subscriptionPlan?.title || `${days} Days`} - ${dish.name || "Meal Subscription"}`,
        prefill: {
          name: customerName,
          email: userProfile?.email || "",
          contact: formattedPhone,
        },
        notes: {
          subscriptionId:
            subscription.subscriptionId || subscription._id || "",
          dishName: dish.name || "",
          customerName,
          customerPhone,
          deliveryAddress: addressLabel,
          note: orderNote,
        },
        handler: async (razorpayResponse) => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.log("[SubscriptionCheckout] Razorpay success response", razorpayResponse);

          try {
            const verifyPayload = {
              subscriptionId:
                subscription.subscriptionId || subscription._id || "",
              razorpayOrderId: razorpayResponse.razorpay_order_id,
              razorpayPaymentId: razorpayResponse.razorpay_payment_id,
              razorpaySignature: razorpayResponse.razorpay_signature,
            };

            console.log("[SubscriptionCheckout] Verify-payment payload", verifyPayload);

            const verifyResponse = await subscriptionAPI.verifyPayment(verifyPayload);

            console.log("[SubscriptionCheckout] Verify-payment response", verifyResponse?.data);

            if (!verifyResponse?.data?.success) {
              throw new Error(
                verifyResponse?.data?.message || "Payment verification failed.",
              );
            }

            toast.success("Subscription activated successfully.");
            navigate("/food/user/profile", { replace: true });
          } catch (error) {
            toast.error(
              error?.response?.data?.message ||
                error?.message ||
                "Payment verification failed.",
            );
          } finally {
            setIsPlacingOrder(false);
          }
        },
        onError: (error) => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.error("[SubscriptionCheckout] Razorpay payment error", error);
          toast.error(
            error?.description ||
              error?.message ||
              "Payment failed. Please try again.",
          );
          setIsPlacingOrder(false);
        },
        onClose: () => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.warn("[SubscriptionCheckout] Razorpay modal closed by user");
          toast.info("Payment was not completed.");
          setIsPlacingOrder(false);
        },
      });
    } catch (error) {
      console.error("[SubscriptionCheckout] Failed to start subscription payment", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to start subscription payment.",
      );
      setIsPlacingOrder(false);
    }
  };

  if (!dish || !subscriptionPlan) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
        <p className="text-gray-500 font-medium mb-4">No plan details found.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[#e3282c] font-bold border border-[#e3282c] px-6 py-2.5 rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 pb-12 font-sans">
      <header className="sticky top-0 z-10 bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Plan details & payment</h1>
        </div>
        <button className="text-gray-500">
          <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-gradient-to-r from-[#fff5ef] to-[#fffaf8] rounded-[20px] p-5 flex justify-between relative overflow-hidden border border-orange-50/50">
          <div className="flex-1 z-10 pr-2 pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-5 w-5 text-[#e3282c]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-[#e3282c] tracking-widest uppercase">
                Validity
              </span>
            </div>
            <p className="text-xl font-bold mb-2">{days} Days</p>
            <p className="text-xs font-semibold text-gray-700 leading-snug max-w-[210px]">
              {subscriptionPlan.description || "Value plan for a balanced everyday meal."}
            </p>
            {selectedMealLabel && (
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#e3282c]">
                {selectedMealLabel}
              </p>
            )}
          </div>
          <div className="w-32 h-32 shrink-0 absolute -right-2 top-2">
            {dish.image ? (
              <img
                src={dish.image}
                alt={dish.name}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            ) : (
              <div className="w-24 h-24 mt-4 ml-4 bg-gray-200 rounded-2xl flex items-center justify-center font-bold text-gray-400 text-2xl">
                {dish.name?.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <MapPin className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-bold text-[15px]">Delivery address</h2>
              <p className="text-xs text-gray-500">
                {addressLabel || "Add a default address from profile"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <IndianRupee className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-[15px]">Price breakdown</h2>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Food cost</span>
              <span className="font-bold">
                {RUPEE_SYMBOL}
                {totalFoodCost.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">
                Delivery charges ({days} x {RUPEE_SYMBOL}
                {deliveryFeePerDay}/day)
              </span>
              <span className="font-bold">
                {RUPEE_SYMBOL}
                {totalDeliveryCharges.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="border-t border-dashed border-gray-200 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-[15px]">Total amount</span>
              <span className="font-bold text-xl text-[#e3282c]">
                {RUPEE_SYMBOL}
                {totalAmount.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c] shrink-0 mt-0.5">
              <CreditCard className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-sm">
                Auto-pay{" "}
                <span className="text-gray-400 font-medium text-xs ml-1">
                  (Recommended)
                </span>
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Automatically renews your plan on expiry.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAutoPay(!autoPay)}
            className={`w-[44px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ml-2 ${
              autoPay ? "bg-[#e3282c]" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                autoPay ? "left-[26px]" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="px-1 mt-6 pt-2">
          <h3 className="font-bold text-[15px] mb-4">What you get</h3>
          <ul className="space-y-4">
            {[
              "24-hour prior delivery notification before each meal",
              "Modify, skip, or confirm each delivery",
              "One-time prepaid subscription activation",
              "No refunds on cancellation (ZiggyBites policy)",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckCircle2
                  className="h-5 w-5 text-green-500 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <span className="text-sm font-medium text-gray-600 leading-snug">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 space-y-3 pb-8">
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="w-full bg-[#e3282c] text-white rounded-[12px] py-3.5 flex justify-center items-center gap-2 font-bold text-sm transition-opacity active:opacity-80 disabled:opacity-70 shadow-sm hover:bg-[#d02023]"
          >
            {isPlacingOrder ? (
              "Processing..."
            ) : (
              <>
                <Lock className="h-4 w-4" strokeWidth={2} />
                Proceed to pay {RUPEE_SYMBOL}
                {totalAmount.toLocaleString("en-IN")}
              </>
            )}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-white text-[#e3282c] border border-[#e3282c] rounded-[12px] py-3.5 flex justify-center items-center font-bold text-sm transition-colors active:bg-red-50 hover:bg-red-50/50"
          >
            Back to plans
          </button>
        </div>
      </main>
    </div>
  );
}
