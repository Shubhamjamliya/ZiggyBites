import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, HelpCircle, CalendarDays, IndianRupee, CreditCard, CheckCircle2, Lock } from "lucide-react"

export default function SubscriptionCheckout() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [autoPay, setAutoPay] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  const { dish, selectedMeals = [], subscriptionPlan } = location.state || {}

  const basePrice = dish?.price ? parseFloat(dish.price) : 319 
  const mealCount = selectedMeals.length || 1
  const days = subscriptionPlan?.durationDays || 30
  
  // Calculate prices
  const totalFoodCost = basePrice * mealCount * days
  const deliveryFeePerDay = 10
  const totalDeliveryCharges = deliveryFeePerDay * days
  const totalAmount = totalFoodCost + totalDeliveryCharges

  const handlePlaceOrder = () => {
    setIsPlacingOrder(true)
    setTimeout(() => {
      setIsPlacingOrder(false)
      navigate("/food/user/orders?confirmed=true", { replace: true })
    }, 1500)
  }

  if (!dish || !subscriptionPlan) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
        <p className="text-gray-500 font-medium mb-4">No plan details found.</p>
        <button onClick={() => navigate(-1)} className="text-[#e3282c] font-bold border border-[#e3282c] px-6 py-2.5 rounded-xl">Go Back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 pb-12 font-sans">
      {/* Header */}
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
        {/* Plan Banner */}
        <div className="bg-gradient-to-r from-[#fff5ef] to-[#fffaf8] rounded-[20px] p-5 flex justify-between relative overflow-hidden border border-orange-50/50">
          <div className="flex-1 z-10 pr-2 pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-5 w-5 text-[#e3282c]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-[#e3282c] tracking-widest uppercase">Validity</span>
            </div>
            <p className="text-xl font-bold mb-4">{days} Days</p>

            <span className="text-[10px] font-bold text-[#e3282c] tracking-widest uppercase block mb-1.5">Description</span>
            <p className="text-xs font-semibold text-gray-700 leading-snug max-w-[200px]">
              {subscriptionPlan.description || "Value plan for a balanced everyday meal."}
            </p>
          </div>
          <div className="w-32 h-32 shrink-0 absolute -right-2 top-2">
            {dish.image ? (
              <img src={dish.image} alt={dish.name} className="w-full h-full object-contain mix-blend-multiply" />
            ) : (
              <div className="w-24 h-24 mt-4 ml-4 bg-gray-200 rounded-2xl flex items-center justify-center font-bold text-gray-400 text-2xl">
                {dish.name?.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <IndianRupee className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-[15px]">Price breakdown</h2>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total food cost</span>
              <span className="font-bold">₹{totalFoodCost.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Delivery charges ({days} × ₹{deliveryFeePerDay}/day)</span>
              <span className="font-bold">₹{totalDeliveryCharges.toLocaleString("en-IN")}</span>
            </div>
            
            <div className="border-t border-dashed border-gray-200 my-4"></div>
            
            <div className="flex justify-between items-center">
              <span className="font-bold text-[15px]">Total amount</span>
              <span className="font-bold text-xl text-[#e3282c]">₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Auto Pay Toggle */}
        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c] shrink-0 mt-0.5">
              <CreditCard className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-sm">
                Auto-pay <span className="text-gray-400 font-medium text-xs ml-1">(Recommended)</span>
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">Automatically renews your plan on expiry.</p>
            </div>
          </div>
          {/* Toggle Button */}
          <button 
            type="button" 
            onClick={() => setAutoPay(!autoPay)}
            className={`w-[44px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ml-2 ${autoPay ? "bg-[#e3282c]" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${autoPay ? "left-[26px]" : "left-1"}`} />
          </button>
        </div>

        {/* What you get */}
        <div className="px-1 mt-6 pt-2">
          <h3 className="font-bold text-[15px] mb-4">What you get</h3>
          <ul className="space-y-4">
            {[
              "24-hour prior delivery notification before each meal",
              "Modify, skip, or confirm each delivery",
              "Subscribe from any restaurant on Home",
              "No refunds on cancellation (ZiggyBites policy)"
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-sm font-medium text-gray-600 leading-snug">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
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
                Proceed to pay ₹{totalAmount.toLocaleString("en-IN")}
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
  )
}
