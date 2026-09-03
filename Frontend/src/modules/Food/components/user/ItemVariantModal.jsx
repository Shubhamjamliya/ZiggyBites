import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Minus, ShoppingBag, Check } from "lucide-react"
import { getFoodVariants, hasFoodVariants, getDefaultFoodVariant } from "@food/utils/foodVariants"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

const RUPEE_SYMBOL = "₹"

export default function ItemVariantModal({
  isOpen,
  onClose,
  item,
  restaurant = null,
  onAddToCart = null,
  initialVariantId = "",
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToCart } = useCart()

  const variants = useMemo(() => (item ? getFoodVariants(item) : []), [item])
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)

  // Initialize or reset selected variant when item changes or modal opens
  useEffect(() => {
    if (!isOpen || !item) return

    setQuantity(1)
    if (initialVariantId && variants.some((v) => String(v.id) === String(initialVariantId))) {
      setSelectedVariantId(String(initialVariantId))
    } else {
      const defaultVariant = getDefaultFoodVariant(item)
      setSelectedVariantId(defaultVariant ? String(defaultVariant.id) : "")
    }
  }, [isOpen, item, initialVariantId, variants])

  if (!isOpen || !item) return null

  const isVeg =
    String(item.foodType || "").toLowerCase() === "veg" ||
    item.isVeg === true

  const selectedVariant =
    variants.find((v) => String(v.id) === String(selectedVariantId)) ||
    variants[0] ||
    null

  const unitPrice = selectedVariant
    ? Number(selectedVariant.price) || 0
    : Number(item.price) || 0

  const totalPrice = unitPrice * quantity

  const handleAdd = (e) => {
    e?.stopPropagation?.()

    if (!isModuleAuthenticated("user")) {
      toast.error("Please login to add items to cart")
      navigate("/user/auth/login", { state: { from: location.pathname } })
      onClose()
      return
    }

    if (!selectedVariant && variants.length > 0) {
      toast.error("Please select a variant")
      return
    }

    if (typeof onAddToCart === "function") {
      onAddToCart(item, quantity, selectedVariant, e)
      onClose()
      return
    }

    // Default cart dispatch using useCart
    const resolvedRestaurantName =
      restaurant?.name ||
      restaurant?.restaurantName ||
      item.restaurantName ||
      item.restaurant ||
      ""

    const resolvedRestaurantId =
      restaurant?.restaurantId ||
      restaurant?._id ||
      restaurant?.id ||
      item.restaurantId ||
      item.mongoRestaurantId ||
      item.restaurantMongoId ||
      ""

    const baseItemId = String(item.itemId || item.id || item._id || "")
    const variantId = selectedVariant ? String(selectedVariant.id || selectedVariant._id || "") : ""
    const lineItemId = variantId ? `${baseItemId}::${variantId}` : baseItemId

    const cartPayload = {
      id: lineItemId,
      lineItemId,
      itemId: baseItemId,
      name: item.name,
      price: unitPrice,
      originalPrice: unitPrice,
      variantId,
      variantName: selectedVariant?.name || "",
      variantPrice: unitPrice,
      variant: selectedVariant,
      image: item.image || item.imageUrl || "",
      isVeg,
      restaurant: resolvedRestaurantName,
      restaurantId: resolvedRestaurantId,
      quantity,
    }

    const result = addToCart(cartPayload)
    if (result?.ok === false) {
      toast.error(result.error || "Unable to add item to cart")
      return
    }

    toast.success(
      `Added ${item.name}${selectedVariant?.name ? ` (${selectedVariant.name})` : ""} to cart`
    )
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-white dark:bg-[#18181b] rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] border border-gray-100 dark:border-zinc-800 z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-gray-100 dark:border-zinc-800/80 bg-white/50 dark:bg-[#18181b]/50 backdrop-blur-md">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`mt-1 w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                  isVeg ? "border-green-600 bg-green-50/50" : "border-red-600 bg-red-50/50"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isVeg ? "bg-green-600" : "bg-red-600"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#e23744] block mb-0.5">
                  Customisation
                </span>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Variants List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Quantity / Size
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-full">
                Required · Choose 1
              </span>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-2.5">
                {variants.map((variant) => {
                  const isSelected = String(selectedVariantId) === String(variant.id)
                  return (
                    <div
                      key={variant.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVariantId(String(variant.id))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedVariantId(String(variant.id))
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                        isSelected
                          ? "border-[#e23744] bg-red-50/40 dark:bg-red-950/20 shadow-sm"
                          : "border-gray-200/80 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-[#202023]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Custom Radio Button */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-[#e23744]"
                              : "border-gray-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#e23744]" />
                          )}
                        </div>
                        <span
                          className={`text-sm sm:text-base font-bold ${
                            isSelected
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-700 dark:text-zinc-300"
                          }`}
                        >
                          {variant.name}
                        </span>
                      </div>

                      <span
                        className={`text-sm sm:text-base font-black ${
                          isSelected
                            ? "text-[#e23744] dark:text-[#ff5257]"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {RUPEE_SYMBOL}
                        {Math.round(variant.price)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 text-center text-xs text-gray-500">
                Standard Option · {RUPEE_SYMBOL}{unitPrice}
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-[#18181b] flex items-center justify-between gap-4">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-2 border border-gray-200 dark:border-zinc-700 rounded-full bg-white dark:bg-zinc-900 px-2 py-1 shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-black text-gray-900 dark:text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add to Cart CTA */}
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 h-12 rounded-2xl bg-[#e23744] hover:bg-[#d12b37] active:scale-[0.98] text-white font-bold text-sm sm:text-base flex items-center justify-between px-5 shadow-lg shadow-red-500/25 transition-all"
            >
              <span>Add to Cart</span>
              <span className="font-black text-white/95">
                {RUPEE_SYMBOL}
                {Math.round(totalPrice)}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
