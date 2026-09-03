import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  IndianRupee,
  Lock,
  MapPin,
} from "lucide-react";
import { subscriptionAPI, adminAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import { useProfile } from "@food/context/ProfileContext";
import { useLocation as useUserLocation } from "@food/hooks/useLocation";
import { useSubscriptions } from "@food/context/SubscriptionsContext";
import { DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization";
import { toast } from "sonner";
import { Button } from "@food/components/ui/button";
import { motion } from "framer-motion";

const RUPEE_SYMBOL = "\u20B9";
const SUBSCRIPTION_GST_RATE = 5;
const SUBSCRIPTION_DELIVERY_FEE_PER_DAY = 10;

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

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const formatCurrency = (value) =>
  `${RUPEE_SYMBOL}${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

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
  const { userProfile, getDefaultAddress, isAuthenticated } = useProfile();
  const { location: currentLocation } = useUserLocation();
  const { refreshSubscriptions } = useSubscriptions();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [completedSubscription, setCompletedSubscription] = useState(null);
  const [appCustomization, setAppCustomization] = useState(DEFAULT_APP_CUSTOMIZATION);

  const { dish, selectedDishes = [], selectedMeals = [], subscriptionPlan, selectedDeliveryAddress } = location.state || {};

  const effectiveDishes = useMemo(() => {
    if (Array.isArray(selectedDishes) && selectedDishes.length > 0) {
      return selectedDishes;
    }
    return dish ? [dish] : [];
  }, [selectedDishes, dish]);

  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (!mounted) return;
        setAppCustomization(settings);
        if (settings.subscriptionFlowEnabled === false) {
          navigate("/food/user", { replace: true });
        }
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const [feeSettings, setFeeSettings] = useState({
    packagingFee: 0,
    platformFee: 5,
    gstRate: 5,
    gstOnPlatformFee: 0,
    gstOnPackagingFee: 0,
  });

  useEffect(() => {
    let mounted = true;
    if (typeof adminAPI?.getPublicFeeSettings === "function") {
      adminAPI
        .getPublicFeeSettings()
        .then((res) => {
          if (!mounted) return;
          const fs = res?.data?.data?.feeSettings;
          if (fs) {
            setFeeSettings({
              packagingFee: Number(fs.packagingFee ?? 0),
              platformFee: Number(fs.platformFee ?? 5),
              gstRate: Number(fs.gstRate ?? 5),
              gstOnPlatformFee: Number(fs.gstOnPlatformFee ?? 0),
              gstOnPackagingFee: Number(fs.gstOnPackagingFee ?? 0),
            });
          }
        })
        .catch(() => { });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const basePrice = useMemo(() => {
    if (effectiveDishes.length > 0) {
      return effectiveDishes.reduce(
        (sum, item) => sum + (Number(item.price || 0) * (Number(item.quantity) || 1)),
        0
      );
    }
    return Math.max(0, Number.parseFloat(dish?.price || 0) || 0);
  }, [effectiveDishes, dish]);
  const mealCount = selectedMeals.length || 1;
  const days = subscriptionPlan?.durationDays || 30;
  const totalFoodCost = roundMoney(basePrice * mealCount * days);

  const packagingFee = Number(feeSettings.packagingFee || 0);
  const platformFee = Number(feeSettings.platformFee || 0);
  const deliveryFeePerDay = SUBSCRIPTION_DELIVERY_FEE_PER_DAY;
  const totalDeliveryCharges = roundMoney(deliveryFeePerDay * days);

  const gstRate = Number(feeSettings.gstRate || SUBSCRIPTION_GST_RATE);
  const gstOnFood = roundMoney(totalFoodCost * (gstRate / 100));
  const gstOnPlatform = roundMoney(platformFee * (Number(feeSettings.gstOnPlatformFee || 0) / 100));
  const gstOnPackaging = roundMoney(packagingFee * (Number(feeSettings.gstOnPackagingFee || 0) / 100));
  const gstAmount = roundMoney(gstOnFood + gstOnPlatform + gstOnPackaging);

  const totalAmount = roundMoney(totalFoodCost + packagingFee + platformFee + gstAmount + totalDeliveryCharges);
  const totalDeliveries = mealCount * days;

  const savedAddress = getDefaultAddress();
  const defaultAddress = useMemo(() => {
    if (selectedDeliveryAddress) return selectedDeliveryAddress;
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
  }, [currentLocation, savedAddress, selectedDeliveryAddress, userProfile?.phone]);

  const addressLabel = formatFullAddress(defaultAddress);
  const selectedMealLabel = selectedMeals
    .map((meal) => String(meal?.title || meal?.name || "").trim())
    .filter(Boolean)
    .join(", ");

  const orderNote = useMemo(() => {
    const noteParts = [
      `Subscription plan: ${subscriptionPlan?.title || `${days} Days`}`,
      selectedMealLabel ? `Meals: ${selectedMealLabel}` : "",
    ].filter(Boolean);
    return noteParts.join(" | ");
  }, [days, selectedMealLabel, subscriptionPlan?.title]);

  const redirectToLogin = () => {
    navigate("/user/auth/login", {
      replace: true,
      state: { from: location.pathname },
    });
  };

  const handleChangeAddress = () => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    navigate("/food/user/address-selector", {
      state: {
        mode: "subscription-checkout-address",
        returnTo: "/food/user/subscriptions/checkout",
        checkoutState: {
          ...(location.state || {}),
          dish,
          selectedMeals,
          subscriptionPlan,
        },
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.info("Please login to continue with payment.");
      redirectToLogin();
      return;
    }

    if (appCustomization.subscriptionFlowEnabled === false) {
      toast.error("Subscription ordering is currently unavailable.");
      return;
    }

    console.log("[SubscriptionCheckout] Proceed to pay clicked", {
      rawState: location.state || null,
      dish,
      selectedMeals,
      subscriptionPlan,
      defaultAddress,
      addressLabel,
      totalFoodCost,
      totalDeliveryCharges,
      gstAmount,
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

    if (basePrice <= 0) {
      toast.error("Dish price is missing for this subscription.");
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
        dishId: dish?.itemId || dish?.id || effectiveDishes[0]?.itemId || effectiveDishes[0]?.id || "dish-0",
        dishName: effectiveDishes.length > 1
          ? effectiveDishes.map((d) => `${d.name}${d.quantity > 1 ? ` ×${d.quantity}` : ""}`).join(", ")
          : (dish?.name || effectiveDishes[0]?.name || "Subscription meal"),
        dishes: effectiveDishes.map((d) => ({
          dishId: d.itemId || d.id,
          dishName: d.name,
          price: d.price,
          quantity: d.quantity || 1,
        })),
        restaurantId: dish?.restaurantId || effectiveDishes[0]?.restaurantId || "",
        restaurantName: dish?.restaurantName || effectiveDishes[0]?.restaurantName || "",
        meals: selectedMeals
          .map((meal) => String(meal?.title || meal?.name || "").trim())
          .filter(Boolean),
        planId: subscriptionPlan?.id || undefined,
        planDays: days,
        itemPrice: basePrice,
        mealCount,
        packagingFee,
        platformFee,
        foodSubtotal: totalFoodCost,
        gstRate,
        gstAmount,
        deliveryFeePerDay,
        deliveryCharges: totalDeliveryCharges,
        totalAmount,
        currency: "INR",
        customerName,
        customerPhone,
        deliveryAddress: defaultAddress,
      };

      console.log("[SubscriptionCheckout] Subscription create-order payload", payload);

      const response = await subscriptionAPI.createOrder(payload);
      const { subscription, razorpay, order } = response?.data?.data || {};

      console.log("[SubscriptionCheckout] Create-order response", {
        response: response?.data,
        subscription,
        razorpay,
        order,
      });

      if (!subscription) {
        throw new Error("Unable to initialize subscription payment.");
      }

      if (appCustomization.directPaymentTestMode === true) {
        const verifyPayload = {
          subscriptionId: subscription.subscriptionId || subscription._id || "",
          razorpayOrderId: razorpay?.orderId || subscription.razorpayOrderId || `test_order_${Date.now()}`,
          razorpayPaymentId: `test_payment_${Date.now()}`,
          razorpaySignature: "test_signature_bypass",
        };

        const verifyResponse = await subscriptionAPI.verifyPayment(verifyPayload);
        if (!verifyResponse?.data?.success) {
          throw new Error(
            verifyResponse?.data?.message || "Payment verification failed.",
          );
        }

        const verifiedSub = verifyResponse?.data?.data?.subscription || subscription;
        setCompletedSubscription(verifiedSub || {
          subscriptionId: subscription.subscriptionId || subscription._id,
          totalAmount,
          status: "active",
          paymentStatus: "completed",
        });
        setIsPlacingOrder(false);
        toast.success("Subscription activated successfully.");
        try {
          await refreshSubscriptions();
        } catch {
          // ignore refresh error
        }
        return;
      }

      if (!razorpay?.orderId || !razorpay?.key) {
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
              razorpayOrderId:
                razorpayResponse.razorpay_order_id ||
                razorpay.orderId,
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

            const verifiedSub = verifyResponse?.data?.data?.subscription || subscription;
            setCompletedSubscription(verifiedSub || {
              subscriptionId: subscription.subscriptionId || subscription._id,
              totalAmount,
              status: "active",
              paymentStatus: "completed",
            });
            setIsPlacingOrder(false);
            toast.success("Subscription activated successfully.");
            try {
              await refreshSubscriptions();
            } catch {
              // ignore refresh error
            }
          } catch (error) {
            if (error?.response?.status === 401) {
              toast.info("Please login to continue.");
              redirectToLogin();
              return;
            }

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
          navigate("/food/user/checkout", { replace: true });
        },
      });
    } catch (error) {
      if (error?.response?.status === 401) {
        toast.info("Please login to continue with payment.");
        redirectToLogin();
        setIsPlacingOrder(false);
        return;
      }

      console.error("[SubscriptionCheckout] Failed to start subscription payment", error);
      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        "Failed to start subscription payment.",
      );
      setIsPlacingOrder(false);
    }
  };

  if (completedSubscription) {
    const subId = formatSubscriptionId(
      completedSubscription?.subscriptionId ||
      completedSubscription?._id ||
      completedSubscription?.id ||
      completedSubscription?.shortId
    );

    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] text-gray-900 dark:text-white pb-12 font-sans transition-colors">
        <header className="sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/food/user/profile/subscriptions", { replace: true })}
              className="text-gray-800 dark:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">Plan details & payment</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/food/user/help")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Contact Support"
            title="Contact Support"
          >
            <HelpCircle className="h-6 w-6" strokeWidth={1.8} />
          </button>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-center py-6 px-4 bg-white dark:bg-[#141414] rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-800"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Payment Completed
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              Subscription Activated!
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px] mx-auto">
              Your meal subscription is confirmed and scheduled.
            </p>

            <div className="mt-3 inline-block bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-3.5 py-1 rounded-full text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
              ID: {subId}
            </div>
          </motion.div>

          {/* Subscription Summary Card */}
          <div className="bg-white dark:bg-[#141414] rounded-[20px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plan Details
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Completed
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/30 overflow-hidden flex items-center justify-center shrink-0">
                {dish?.image ? (
                  <img
                    src={dish.image}
                    alt={dish?.name || "Dish"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-[#e3282c]">
                    {dish?.name?.charAt(0) || "M"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2">
                  {effectiveDishes.length > 1
                    ? effectiveDishes.map((d) => `${d.name}${d.quantity > 1 ? ` ×${d.quantity}` : ""}`).join(", ")
                    : (dish?.name || "Subscription meal")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {days} Days Plan ({totalDeliveries} total deliveries)
                </p>
                {selectedMealLabel && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-[#e3282c] uppercase">
                    {selectedMealLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">
                  Amount Paid
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  ₹{Number(completedSubscription.totalAmount || totalAmount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">
                  Payment Status
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Completed
                </span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-0.5">
                Delivery Address
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                {addressLabel || "Standard delivery address"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={() => navigate("/food/user/profile/subscriptions", { replace: true })}
              className="w-full h-12 rounded-xl bg-[#e3282c] hover:bg-[#c92428] text-white text-sm font-bold shadow-md shadow-red-500/20 active:scale-[0.99] transition-all"
            >
              View My Subscriptions
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/food/user", { replace: true })}
              className="w-full h-11 rounded-xl text-xs font-bold border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.99] transition-all"
            >
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Plan details & payment</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/food/user/help")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Contact Support"
          title="Contact Support"
        >
          <HelpCircle className="h-6 w-6" strokeWidth={1.8} />
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
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <MapPin className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[15px]">Delivery address</h2>
              <p className="mt-1 text-xs text-gray-500 leading-snug">
                {addressLabel || "Add a default address from profile"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleChangeAddress}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-[#e3282c] active:bg-red-100"
            >
              {addressLabel ? "Change" : "Add"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <IndianRupee className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-[15px]">Price breakdown</h2>
          </div>

          <div className="mb-4 rounded-[12px] border border-gray-100 bg-[#fafafa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {dish.name || "Subscription meal"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-gray-500">
                  {mealCount} meal{mealCount === 1 ? "" : "s"} per day x {days} days
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#e3282c]">
                {totalDeliveries} deliveries
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Dish price</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">Base price for one meal</p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(basePrice)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Food subtotal</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {formatCurrency(basePrice)} x {mealCount} meal{mealCount === 1 ? "" : "s"} x {days} days
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(totalFoodCost)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Packaging charges</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">Packaging fee for subscription</p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(packagingFee)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Platform fee</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">Platform service charge</p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(platformFee)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Delivery charges</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {formatCurrency(deliveryFeePerDay)} x {days} days
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(totalDeliveryCharges)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">GST</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {gstRate}% on subtotal & services
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(gstAmount)}</span>
            </div>

            <div className="border-t border-dashed border-gray-200 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-[15px]">Total amount</span>
              <span className="font-bold text-xl text-[#e3282c]">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 mt-6 pt-2">
          <h3 className="font-bold text-[15px] mb-4">What you get</h3>
          <ul className="space-y-4">
            {[
              "24-hour prior delivery notification before each meal",
              "Modify, skip, or confirm each delivery",
              "One-time secure checkout for this meal plan",
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

        <div className="rounded-[16px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141414] p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-[#e3282c] dark:text-[#ff5257] shrink-0">
                <HelpCircle className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Have questions about this plan?</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Our support team is here to assist you 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/food/user/help")}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-bold text-[#e3282c] dark:text-[#ff5257] active:scale-95 transition-all"
            >
              Support
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
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

