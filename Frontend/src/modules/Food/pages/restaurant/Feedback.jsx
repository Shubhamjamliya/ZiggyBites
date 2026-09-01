import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  HelpCircle,
  Search,
  SlidersHorizontal,
  Calendar,
  X,
  Loader2,
  Star,
  RotateCcw,
  Check,
  MessageSquare
} from "lucide-react"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { restaurantAPI } from "@food/api"

const debugError = (...args) => {}

const tabs = [
  { id: "complaints", label: "Complaints" },
  { id: "reviews", label: "Reviews" },
]

const normalizeOrderStatus = (order) =>
  String(order?.status || order?.orderStatus || "").toLowerCase()

const normalizeRating = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  return Math.min(5, Math.round(parsed * 10) / 10)
}

const extractReviewRating = (order) =>
  normalizeRating(
    order?.review?.rating ??
      order?.ratings?.restaurant?.rating ??
      order?.feedback?.rating ??
      order?.rating
  )

const extractReviewText = (order) => {
  const raw =
    order?.review?.comment ??
    order?.review?.text ??
    order?.ratings?.restaurant?.comment ??
    order?.feedback?.comment ??
    order?.feedback?.text ??
    ""
  const normalized = String(raw || "").trim()
  return normalized || "No review text"
}

const toComparableId = (value) =>
  String(value?._id || value || "").trim()

export default function Feedback() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState(tabFromUrl === "complaints" ? "complaints" : "reviews")
  const navigate = useNavigate()

  // Update active tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === "complaints") {
      setActiveTab("complaints")
    } else {
      setActiveTab("reviews")
    }
  }, [tabFromUrl])

  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  // --- REVIEWS STATE ---
  const [reviews, setReviews] = useState([])
  const [reviewsSearchQuery, setReviewsSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterValues, setFilterValues] = useState({
    sortBy: "newest",
    ratings: [],
    hasCommentOnly: false
  })
  const [tempFilterValues, setTempFilterValues] = useState({
    sortBy: "newest",
    ratings: [],
    hasCommentOnly: false
  })
  const [displayedReviews, setDisplayedReviews] = useState([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)

  // --- COMPLAINTS STATE ---
  const [complaints, setComplaints] = useState([])
  const [complaintsSearchQuery, setComplaintsSearchQuery] = useState("")
  const [debouncedComplaintsSearch, setDebouncedComplaintsSearch] = useState("")
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false)
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({
    issueType: []
  })
  const [tempComplaintsFilterValues, setTempComplaintsFilterValues] = useState({
    issueType: []
  })
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false)

  // --- DATE PICKER STATE ---
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState("last5days")
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null })
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)

  // --- RESTAURANT PROFILE DATA ---
  const [restaurantData, setRestaurantData] = useState(null)
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true)
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    totalRatings: 0,
    totalReviews: 0
  })

  // Debounce complaints search query to avoid spamming API on keystrokes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedComplaintsSearch(complaintsSearchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [complaintsSearchQuery])

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setIsLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        if (response.data?.success && response.data.data?.restaurant) {
          setRestaurantData(response.data.data.restaurant)
        }
      } catch (error) {
        debugError("Error fetching restaurant data:", error)
      } finally {
        setIsLoadingRestaurant(false)
      }
    }
    fetchRestaurantData()
  }, [])

  const getDateRanges = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const last5DaysStart = new Date(today)
    last5DaysStart.setDate(last5DaysStart.getDate() - 4)

    const thisWeekStart = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    thisWeekStart.setDate(diff)

    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
    lastWeekEnd.setHours(23, 59, 59, 999)

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)

    return {
      today,
      yesterday,
      thisWeekStart,
      thisWeekEnd: new Date(),
      lastWeekStart,
      lastWeekEnd,
      thisMonthStart,
      thisMonthEnd: new Date(),
      lastMonthStart,
      lastMonthEnd,
      last5DaysStart,
      last5DaysEnd: new Date()
    }
  }

  // Fetch Complaints
  useEffect(() => {
    const fetchComplaints = async () => {
      if (activeTab !== "complaints") return

      try {
        setIsComplaintsLoading(true)
        const dateRanges = getDateRanges()
        let fromDate = null
        let toDate = null

        switch (selectedDateRange) {
          case "today":
            fromDate = dateRanges.today
            toDate = new Date()
            break
          case "yesterday":
            fromDate = dateRanges.yesterday
            toDate = new Date(dateRanges.yesterday)
            toDate.setHours(23, 59, 59, 999)
            break
          case "thisWeek":
            fromDate = dateRanges.thisWeekStart
            toDate = dateRanges.thisWeekEnd
            break
          case "lastWeek":
            fromDate = dateRanges.lastWeekStart
            toDate = dateRanges.lastWeekEnd
            break
          case "thisMonth":
            fromDate = dateRanges.thisMonthStart
            toDate = dateRanges.thisMonthEnd
            break
          case "lastMonth":
            fromDate = dateRanges.lastMonthStart
            toDate = dateRanges.lastMonthEnd
            break
          case "last5days":
            fromDate = dateRanges.last5DaysStart
            toDate = dateRanges.last5DaysEnd
            break
          case "custom":
            if (customDateRange.start && customDateRange.end) {
              fromDate = customDateRange.start
              toDate = customDateRange.end
            }
            break
          default:
            break
        }

        const params = {}
        if (fromDate) params.fromDate = fromDate.toISOString()
        if (toDate) params.toDate = toDate.toISOString()
        if (complaintsFilterValues.issueType?.length > 0) {
          params.complaintType = complaintsFilterValues.issueType[0]
        }
        if (debouncedComplaintsSearch.trim()) {
          params.search = debouncedComplaintsSearch.trim()
        }

        const response = await restaurantAPI.getComplaints(params)
        if (response?.data?.success && response.data.data?.complaints) {
          setComplaints(response.data.data.complaints)
        } else {
          setComplaints([])
        }
      } catch (error) {
        debugError("Error fetching complaints:", error)
        setComplaints([])
      } finally {
        setIsComplaintsLoading(false)
      }
    }

    fetchComplaints()
  }, [activeTab, selectedDateRange, customDateRange, complaintsFilterValues, debouncedComplaintsSearch])

  // Fetch Reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoadingReviews(true)
        let allOrders = []
        let page = 1
        let hasMore = true
        const limit = 1000
        const maxPages = 50

        while (hasMore && page <= maxPages) {
          try {
            const response = await restaurantAPI.getOrders({
              page,
              limit,
              status: "delivered"
            })

            if (response.data?.success && response.data.data?.orders) {
              const orders = response.data.data.orders
              allOrders = [...allOrders, ...orders]
              const totalPages = response.data.data.pagination?.totalPages || response.data.data.totalPages || 1
              if (orders.length < limit || (totalPages > 0 && page >= totalPages)) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (pageError) {
            hasMore = false
          }
        }

        const transformedReviews = allOrders
          .filter((order) => normalizeOrderStatus(order) === "delivered")
          .map((order, index) => {
            const orderDate = new Date(order.createdAt || order.deliveredAt || Date.now())
            const day = orderDate.getDate()
            const month = orderDate.toLocaleDateString("en-GB", { month: "short" })
            const year = orderDate.getFullYear()
            const formattedDate = `${day} ${month}, ${year}`

            const userName = order.userId?.name || order.customerName || "Customer"
            const userImage =
              order.userId?.profileImage ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`
            const outlet = order.restaurantName || restaurantData?.name || "Restaurant"

            const rating = extractReviewRating(order)
            const reviewText = extractReviewText(order)

            const userOrdersCount = allOrders.filter(
              (o) => toComparableId(o.userId) === toComparableId(order.userId)
            ).length

            return {
              id: order._id || order.orderId || `review-${index}`,
              orderNumber: order.orderId || order.orderNumber || String(index),
              outlet: outlet,
              userName: userName,
              userImage: userImage,
              ordersCount: userOrdersCount,
              rating: rating,
              date: formattedDate,
              reviewText: reviewText,
              orderData: order
            }
          })
          .filter(
            (review) =>
              review.rating !== null ||
              (review.reviewText && review.reviewText !== "No review text")
          )

        const ratings = transformedReviews.map((r) => r.rating).filter((r) => r !== null)
        const averageRating =
          ratings.length > 0
            ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
            : 0

        setRatingSummary({
          averageRating: parseFloat(averageRating),
          totalRatings: ratings.length,
          totalReviews: transformedReviews.length
        })
        setReviews(transformedReviews)
      } catch (error) {
        debugError("Error fetching reviews:", error)
      } finally {
        setIsLoadingReviews(false)
      }
    }

    if (!isLoadingRestaurant) fetchReviews()
  }, [isLoadingRestaurant, restaurantData])

  // Filter & Search Reviews
  useEffect(() => {
    let filtered = [...reviews]

    // Search query filter (Customer Name, Order Number, Review Text)
    if (reviewsSearchQuery.trim()) {
      const q = reviewsSearchQuery.trim().toLowerCase()
      filtered = filtered.filter((review) => {
        const userName = String(review.userName || "").toLowerCase()
        const orderNumber = String(review.orderNumber || "").toLowerCase()
        const reviewText = String(review.reviewText || "").toLowerCase()
        return userName.includes(q) || orderNumber.includes(q) || reviewText.includes(q)
      })
    }

    // Star rating filter
    if (filterValues.ratings && filterValues.ratings.length > 0) {
      filtered = filtered.filter((review) => {
        if (review.rating === null || review.rating === undefined) return false
        const rounded = Math.round(Number(review.rating))
        return filterValues.ratings.includes(rounded)
      })
    }

    // Written reviews only
    if (filterValues.hasCommentOnly) {
      filtered = filtered.filter(
        (review) => review.reviewText && review.reviewText !== "No review text"
      )
    }

    // Sorting
    if (filterValues.sortBy) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.orderData?.createdAt || a.orderData?.deliveredAt || a.date)
        const dateB = new Date(b.orderData?.createdAt || b.orderData?.deliveredAt || b.date)
        if (filterValues.sortBy === "newest") return dateB - dateA
        if (filterValues.sortBy === "oldest") return dateA - dateB
        if (filterValues.sortBy === "bestRated") return (b.rating ?? 0) - (a.rating ?? 0)
        if (filterValues.sortBy === "worstRated") return (a.rating ?? 0) - (b.rating ?? 0)
        return 0
      })
    }

    setDisplayedReviews(filtered)
  }, [reviews, filterValues, reviewsSearchQuery])

  // Handlers for Reviews Filter Modal
  const openReviewsFilter = () => {
    setTempFilterValues({ ...filterValues })
    setIsFilterOpen(true)
  }

  const handleFilterReset = () => {
    const defaultFilters = {
      sortBy: "newest",
      ratings: [],
      hasCommentOnly: false
    }
    setFilterValues(defaultFilters)
    setTempFilterValues(defaultFilters)
    setIsFilterOpen(false)
  }

  const handleFilterApply = () => {
    setFilterValues({ ...tempFilterValues })
    setIsFilterOpen(false)
  }

  // Handlers for Complaints Filter Modal
  const openComplaintsFilter = () => {
    setTempComplaintsFilterValues({ ...complaintsFilterValues })
    setIsComplaintsFilterOpen(true)
  }

  const handleComplaintsFilterReset = () => {
    const defaultFilters = { issueType: [] }
    setComplaintsFilterValues(defaultFilters)
    setTempComplaintsFilterValues(defaultFilters)
    setIsComplaintsFilterOpen(false)
  }

  const handleComplaintsFilterApply = () => {
    setComplaintsFilterValues({ ...tempComplaintsFilterValues })
    setIsComplaintsFilterOpen(false)
  }

  // Date selection handlers
  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range)
    if (range === "custom") {
      setIsCustomDateOpen(true)
    } else {
      setIsDateSelectorOpen(false)
    }
  }

  const handleCustomDateApply = () => {
    setIsCustomDateOpen(false)
    setIsDateSelectorOpen(false)
  }

  // Touch handlers for swipe tabs
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const handleTouchMove = (e) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (deltaX > deltaY && deltaX > 10) isSwiping.current = true
    if (isSwiping.current) touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!isSwiping.current) return
    const swipeDistance = touchStartX.current - touchEndX.current
    if (Math.abs(swipeDistance) > 50) {
      if (swipeDistance > 0) setActiveTab("reviews")
      else setActiveTab("complaints")
    }
  }

  const hasActiveReviewsFilter =
    filterValues.ratings?.length > 0 ||
    filterValues.hasCommentOnly ||
    filterValues.sortBy !== "newest"

  const hasActiveComplaintsFilter =
    complaintsFilterValues.issueType?.length > 0

  return (
    <div
      className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a] flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky bg-white dark:bg-[#0a0a0a] top-0 z-40 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-wider text-gray-500 uppercase">Showing data for</p>
            <p className="text-md font-bold text-gray-900 dark:text-white">
              {restaurantData?.name || "Restaurant"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
              aria-label="Refresh"
            >
              <RotateCcw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/food/restaurant/help-centre/support")}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
              aria-label="Open support"
            >
              <HelpCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all relative ${
                activeTab === tab.id
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                  : "bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.id === "complaints" && complaints.length > 0 && activeTab !== "complaints" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#0a0a0a]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4">
        {activeTab === "complaints" ? (
          <div className="space-y-4">
            {/* Search and Filter Row */}
            <div className="space-y-2.5">
              {/* Complaints Search Bar */}
              <div className="flex bg-white dark:bg-[#1a1a1a] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 items-center gap-2 shadow-sm">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={complaintsSearchQuery}
                  onChange={(e) => setComplaintsSearchQuery(e.target.value)}
                  placeholder="Search complaints by customer, order #, issue..."
                  className="flex-1 text-sm bg-transparent focus:outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                {complaintsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setComplaintsSearchQuery("")}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Date Selector & Issue Filter Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDateSelectorOpen(true)}
                  className="flex-1 bg-white dark:bg-[#1a1a1a] p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center shadow-sm hover:border-gray-300 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-900 dark:text-white capitalize">
                      {selectedDateRange === "last5days"
                        ? "Last 5 Days"
                        : selectedDateRange.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-[10px] text-gray-500">Select date range</p>
                  </div>
                  <Calendar className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  type="button"
                  onClick={openComplaintsFilter}
                  className={`p-3 rounded-xl border flex items-center justify-center relative shadow-sm transition-all ${
                    hasActiveComplaintsFilter
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-200 dark:border-gray-800 hover:border-gray-300"
                  }`}
                  aria-label="Filter complaints"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {hasActiveComplaintsFilter && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-[#0a0a0a]" />
                  )}
                </button>
              </div>
            </div>

            {/* Complaints List */}
            <AnimatePresence mode="wait">
              {isComplaintsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3">
                  <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
                  <p className="text-xs text-gray-500 font-medium">Loading complaints...</p>
                </div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-[#141414] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                    {complaintsSearchQuery || hasActiveComplaintsFilter
                      ? "No matching complaints found"
                      : "No complaints found"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    {complaintsSearchQuery || hasActiveComplaintsFilter
                      ? "Try adjusting your search keywords or filter criteria"
                      : "Great job! Your customers have not logged any complaints for this period."}
                  </p>
                  {(complaintsSearchQuery || hasActiveComplaintsFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setComplaintsSearchQuery("")
                        handleComplaintsFilterReset()
                      }}
                      className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Clear Search & Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pb-24">
                  {complaints.map((complaint) => (
                    <div
                      key={complaint._id}
                      className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            complaint.status === "open"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
                              : "bg-green-100 dark:bg-green-900/30 text-green-600"
                          }`}
                        >
                          {complaint.status || "open"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          {new Date(complaint.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-400">
                          {complaint.userId?.name?.[0] || "U"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {complaint.userId?.name || "Customer"}
                          </p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">
                            Order #{complaint.orderId?.orderId || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 relative">
                        <p className="text-[10px] font-black text-red-500 uppercase mb-1">
                          {complaint.issueType}
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-semibold leading-relaxed">
                          {complaint.description}
                        </p>
                      </div>

                      {complaint.adminResponse && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/30">
                          <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1">
                            Admin Response
                          </p>
                          <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
                            {complaint.adminResponse}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reviews Search & Filter Header */}
            <div className="flex gap-2">
              <div className="flex-1 bg-white dark:bg-[#1a1a1a] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2 shadow-sm">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={reviewsSearchQuery}
                  onChange={(e) => setReviewsSearchQuery(e.target.value)}
                  placeholder="Search reviews by customer, order #, text..."
                  className="flex-1 text-sm bg-transparent focus:outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                {reviewsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReviewsSearchQuery("")}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={openReviewsFilter}
                className={`p-3 rounded-xl border flex items-center justify-center relative shadow-sm transition-all ${
                  hasActiveReviewsFilter
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-200 dark:border-gray-800 hover:border-gray-300"
                }`}
                aria-label="Filter reviews"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {hasActiveReviewsFilter && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-[#0a0a0a]" />
                )}
              </button>
            </div>

            {/* Ratings Summary Card */}
            {ratingSummary.totalRatings > 0 && !reviewsSearchQuery && (
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Overall Rating</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                      {ratingSummary.averageRating}
                    </span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= Math.round(ratingSummary.averageRating)
                              ? "fill-amber-400 text-amber-400"
                              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500">
                    {ratingSummary.totalReviews} reviews
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">from delivered orders</p>
                </div>
              </div>
            )}

            {/* Reviews List */}
            {isLoadingReviews ? (
              <div className="flex flex-col items-center justify-center p-12 gap-3">
                <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
                <p className="text-xs text-gray-500 font-medium">Loading reviews...</p>
              </div>
            ) : displayedReviews.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#141414] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <Star className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                  {reviewsSearchQuery || hasActiveReviewsFilter
                    ? "No matching reviews found"
                    : "No reviews yet"}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  {reviewsSearchQuery || hasActiveReviewsFilter
                    ? "Try adjusting your search keywords or filter criteria"
                    : "Customer reviews for delivered orders will appear here."}
                </p>
                {(reviewsSearchQuery || hasActiveReviewsFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewsSearchQuery("")
                      handleFilterReset()
                    }}
                    className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear Search & Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 pb-24">
                {displayedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                      <span>Order #{review.orderNumber}</span>
                      <span>{review.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={review.userImage}
                        alt={review.userName}
                        className="w-8 h-8 rounded-full border border-gray-100 dark:border-gray-800 object-cover"
                      />
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {review.userName}
                      </p>
                      {review.rating !== null && (
                        <div className="ml-auto flex items-center gap-1 bg-green-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {review.rating} <Star className="w-2.5 h-2.5 fill-current" />
                        </div>
                      )}
                    </div>
                    {review.reviewText && review.reviewText !== "No review text" && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium italic">
                          "{review.reviewText}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date Selector Popup */}
      <AnimatePresence>
        {isDateSelectorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[70] backdrop-blur-sm"
              onClick={() => setIsDateSelectorOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl z-[75] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex justify-center mb-4">
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold dark:text-white">Select Date Range</h3>
                <button
                  type="button"
                  onClick={() => setIsDateSelectorOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                {[
                  "today",
                  "yesterday",
                  "thisWeek",
                  "lastWeek",
                  "thisMonth",
                  "lastMonth",
                  "last5days",
                  "custom"
                ].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => handleDateRangeSelect(range)}
                    className={`py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                      selectedDateRange === range
                        ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                        : "border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {range === "last5days"
                      ? "Last 5 Days"
                      : range.replace(/([A-Z])/g, " $1").trim()}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Date Range Picker */}
      <AnimatePresence>
        {isCustomDateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[80] backdrop-blur-sm"
              onClick={() => setIsCustomDateOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 m-auto w-[90%] max-w-sm h-fit bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl z-[85] p-6"
            >
              <DateRangeCalendar
                startDate={customDateRange.start}
                endDate={customDateRange.end}
                onDateRangeChange={(start, end) => {
                  setCustomDateRange({ start, end })
                }}
                onClose={() => setIsCustomDateOpen(false)}
              />
              <button
                type="button"
                onClick={handleCustomDateApply}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold mt-4 shadow-xl active:scale-[0.98] transition-all"
              >
                Apply Custom Range
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reviews Filter Drawer (Fixed Z-Index & Safe-Area Padding) */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[70] backdrop-blur-sm"
              onClick={() => setIsFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[32px] shadow-2xl z-[75] overflow-hidden flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              <div className="p-6 flex flex-col h-full pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Filter & Sort Reviews
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Customize your review view</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-6 mb-6">
                  {/* Sort By */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Sort By
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "newest", label: "Newest First" },
                        { id: "oldest", label: "Oldest First" },
                        { id: "bestRated", label: "Highest Rated" },
                        { id: "worstRated", label: "Lowest Rated" }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setTempFilterValues((prev) => ({ ...prev, sortBy: opt.id }))
                          }
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between border ${
                            tempFilterValues.sortBy === opt.id
                              ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                              : "bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-transparent hover:bg-slate-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {tempFilterValues.sortBy === opt.id && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ratings Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Star Rating
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const isSelected = tempFilterValues.ratings?.includes(stars)
                        return (
                          <button
                            key={stars}
                            type="button"
                            onClick={() => {
                              const current = tempFilterValues.ratings || []
                              const next = isSelected
                                ? current.filter((s) => s !== stars)
                                : [...current, stars]
                              setTempFilterValues((prev) => ({ ...prev, ratings: next }))
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                              isSelected
                                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                                : "bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-transparent hover:bg-slate-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            <span>{stars}</span>
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isSelected
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-current text-gray-400"
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Content Filter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Review Content
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setTempFilterValues((prev) => ({
                          ...prev,
                          hasCommentOnly: !prev.hasCommentOnly
                        }))
                      }
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                        tempFilterValues.hasCommentOnly
                          ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                          : "bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-transparent hover:bg-slate-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span>Written Reviews Only</span>
                      {tempFilterValues.hasCommentOnly && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Footer Buttons with Safe Margin */}
                <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={handleFilterReset}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-gray-800"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleFilterApply}
                    className="flex-[2] bg-slate-900 dark:bg-white text-white dark:text-black py-3.5 rounded-2xl font-bold text-sm shadow-xl active:scale-[0.98] transition-all"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Complaints Filter Popup (Fixed Z-Index & Safe-Area Padding) */}
      <AnimatePresence>
        {isComplaintsFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[70] backdrop-blur-sm"
              onClick={() => setIsComplaintsFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[32px] shadow-2xl z-[75] overflow-hidden flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              <div className="p-6 flex flex-col h-full pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Filter Complaints
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Filter by complaint issue type</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsComplaintsFilterOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Issue Type
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {["Missing Item", "Wrong Item", "Quality Issue", "Delivery Delay", "Other"].map(
                        (type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const current = tempComplaintsFilterValues.issueType || []
                              setTempComplaintsFilterValues({
                                ...tempComplaintsFilterValues,
                                issueType: current.includes(type) ? [] : [type]
                              })
                            }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                              tempComplaintsFilterValues.issueType?.includes(type)
                                ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg shadow-slate-200 dark:shadow-none"
                                : "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {type}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={handleComplaintsFilterReset}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-gray-800"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleComplaintsFilterApply}
                    className="flex-[2] bg-slate-900 dark:bg-white text-white dark:text-black py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 dark:shadow-none active:scale-[0.98] transition-all"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Bottom Navigation */}
      <BottomNavOrders />
    </div>
  )
}
