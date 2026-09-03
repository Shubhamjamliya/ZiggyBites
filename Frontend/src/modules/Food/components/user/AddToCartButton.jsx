import { Plus, Minus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { hasFoodVariants } from "@food/utils/foodVariants"

export default function AddToCartButton({ item, className = "", onShowVariants }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const inCart = isInCart(item.id)
  const cartItem = getCartItem(item.id)
  const navigate = useNavigate()
  const location = useLocation()
  const isCustomisable = hasFoodVariants(item)

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/login', { state: { from: location.pathname } })
      return
    }

    if (isCustomisable) {
      if (onShowVariants) {
        onShowVariants(item)
        return
      }
      const restaurantSlug = item?.restaurantSlug || item?.restaurantId || item?.restaurant
      if (restaurantSlug) {
        navigate(`/food/restaurants/${restaurantSlug}`)
        return
      }
    }

    addToCart(item)
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCustomisable && onShowVariants) {
      onShowVariants(item)
      return
    }
    updateQuantity(item.id, (cartItem?.quantity || 0) + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) - 1)
  }

  if (inCart) {
    return (
      <div className={`flex flex-col items-center gap-0.5 ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="flex items-center gap-1 bg-primary text-white rounded-md shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 text-white hover:bg-secondary hover:text-white"
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
            className="h-8 w-6 text-white hover:bg-secondary hover:text-white"
            onClick={handleIncrease}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {isCustomisable && (
          <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
            Customisable
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <Button
        size="sm"
        onClick={handleAddToCart}
        className="bg-primary hover:bg-secondary text-white font-bold shadow-md transition-all active:scale-95"
      >
        Add to Cart
      </Button>
      {isCustomisable && (
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
          Customisable
        </span>
      )}
    </div>
  )
}
