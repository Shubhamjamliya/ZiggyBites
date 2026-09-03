const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === "object") return Object.values(parsed)
    } catch {
      return []
    }
  }
  if (value && typeof value === "object") {
    return Object.values(value).filter((v) => v && (typeof v === "object" || typeof v === "string"))
  }
  return []
}

export const normalizeFoodVariants = (value, fallbackPrice = 0) =>
  toArray(value)
    .map((entry = {}, index) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim()
        if (!trimmed) return null
        return {
          id: `variant-${index}`,
          _id: `variant-${index}`,
          name: trimmed,
          price: Number(fallbackPrice) || 0,
        }
      }

      const id = String(entry?.id || entry?._id || `variant-${index}`)
      const name = String(
        entry?.name ||
        entry?.variantName ||
        entry?.title ||
        entry?.label ||
        entry?.variant ||
        entry?.size ||
        entry?.portion ||
        ""
      ).trim()

      const rawPrice =
        entry?.price ??
        entry?.variantPrice ??
        entry?.rate ??
        entry?.cost ??
        fallbackPrice
      const price = Number(rawPrice)
      if (!name || !Number.isFinite(price) || price < 0) return null

      return {
        id,
        _id: id,
        name,
        price,
      }
    })
    .filter(Boolean)

export const getFoodVariants = (item = {}) => {
  const candidates =
    item?.variants ||
    item?.variations ||
    item?.foodVariants ||
    item?.sizes ||
    item?.portions ||
    item?.food?.variants ||
    item?.dish?.variants ||
    []
  return normalizeFoodVariants(candidates, item?.price || 0)
}

export const hasFoodVariants = (item = {}) => getFoodVariants(item).length > 0

export const getDefaultFoodVariant = (item = {}) => getFoodVariants(item)[0] || null

export const getFoodDisplayPrice = (item = {}) => {
  const variants = getFoodVariants(item)
  if (variants.length > 0) {
    return Math.min(...variants.map((variant) => Number(variant.price) || 0))
  }

  const price = Number(item?.price)
  return Number.isFinite(price) ? price : 0
}

export const getFoodPriceLabel = (item = {}) => {
  const price = getFoodDisplayPrice(item)
  return hasFoodVariants(item) ? `Starting from ₹${Math.round(price)}` : `₹${Math.round(price)}`
}

export const buildCartLineId = (itemId, variantId = "") =>
  `${String(itemId || "")}::${String(variantId || "base")}`
