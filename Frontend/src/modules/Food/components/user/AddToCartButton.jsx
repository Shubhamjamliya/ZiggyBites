import { Plus, Minus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization"

export default function AddToCartButton({ item, className = "" }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const inCart = isInCart(item.id)
  const cartItem = getCartItem(item.id)
  const navigate = useNavigate()
  const location = useLocation()
  const [appCustomization, setAppCustomization] = useState(DEFAULT_APP_CUSTOMIZATION)

  useEffect(() => {
    let mounted = true
    loadAppCustomization()
      .then((settings) => {
        if (mounted) setAppCustomization(settings)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/login', { state: { from: location.pathname } })
      return
    }

    if (appCustomization.normalOrderFlowEnabled === false) {
      openMealSelection()
      return
    }

    addToCart(item)
  }

  const openMealSelection = () => {
    const itemId = item.itemId || item.id || ""
    const restaurantId =
      item.mongoRestaurantId ||
      item.restaurantMongoId ||
      item.restaurantId ||
      ""
    const params = new URLSearchParams()

    if (item.name) params.set("dish", item.name)
    if (itemId) params.set("dishId", itemId)
    if (item.restaurantName || item.restaurant) params.set("restaurant", item.restaurantName || item.restaurant)
    if (restaurantId) params.set("restaurantId", restaurantId)
    if (item.categoryName) params.set("category", item.categoryName)
    if (Number.isFinite(Number(item.price))) params.set("price", String(item.price))

    navigate(
      {
        pathname: "/food/user/choose-meal",
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { state: { dish: { ...item, itemId, restaurantId } } },
    )
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (appCustomization.normalOrderFlowEnabled === false) return
    updateQuantity(item.id, (cartItem?.quantity || 0) + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (appCustomization.normalOrderFlowEnabled === false) return
    updateQuantity(item.id, (cartItem?.quantity || 0) - 1)
  }

  if (appCustomization.normalOrderFlowEnabled === false) {
    return (
      <Button
        size="sm"
        onClick={handleAddToCart}
        className={`bg-[#7e3866] hover:bg-[#55254b] text-white font-bold shadow-md transition-all active:scale-95 ${className}`}
      >
        Add
      </Button>
    )
  }

  if (inCart) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="flex items-center gap-1 bg-[#7e3866] text-white rounded-md shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 text-white hover:bg-[#55254b] hover:text-white"
            onClick={handleDecrease}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="px-1 text-sm font-bold min-w-[1rem] text-center text-white">
            {cartItem?.quantity || 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 text-white hover:bg-[#55254b] hover:text-white"
            onClick={handleIncrease}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleAddToCart}
      className="bg-[#7e3866] hover:bg-[#55254b] text-white font-bold shadow-md transition-all active:scale-95"
    >
      Add to Cart
    </Button>
  )
}
