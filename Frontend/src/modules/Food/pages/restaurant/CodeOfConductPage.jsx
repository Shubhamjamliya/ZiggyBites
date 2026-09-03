import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { useEffect, useState } from "react"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"

const DEFAULT_CONDUCT_CONTENT = `
  <div class="space-y-6">
    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">1. Food Safety & Hygiene Standards</h3>
      <p class="text-gray-600 leading-relaxed">
        All partner restaurants must strictly comply with FSSAI regulations and local health authority standards. Kitchens, food preparation areas, and storage facilities must be kept clean, sanitized, and pest-free at all times. High-quality and fresh ingredients must be used for all orders.
      </p>
    </section>

    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">2. Timely Order Preparation</h3>
      <p class="text-gray-600 leading-relaxed">
        Orders must be prepared within the estimated preparation time. Timely handovers minimize delivery partner wait times and ensure meals reach customers hot and fresh. Avoid prematurely marking orders as "Ready for Pickup" before they are fully packed.
      </p>
    </section>

    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">3. Packaging & Quality Integrity</h3>
      <p class="text-gray-600 leading-relaxed">
        All food items must be packaged securely using food-grade, leak-proof, and tamper-evident materials. Items must be clearly labeled with order numbers. Ensure that cold and hot items are packed separately to preserve quality during transit.
      </p>
    </section>

    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">4. Professional Conduct with Delivery Partners</h3>
      <p class="text-gray-600 leading-relaxed">
        Delivery partners are an essential extension of our community. Restaurant staff must treat delivery partners with dignity, patience, and professional courtesy. Provide designated waiting areas and access to basic amenities like drinking water where feasible.
      </p>
    </section>

    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">5. Accurate Menu Information & Fair Pricing</h3>
      <p class="text-gray-600 leading-relaxed">
        Menus, item descriptions, dietary tags (Veg/Non-Veg), and allergens must be accurate and up-to-date. In-stock availability must be actively managed to prevent order cancellations. Prices listed should follow platform partner agreements fairly.
      </p>
    </section>

    <section>
      <h3 class="text-base font-bold text-gray-900 mb-2">6. Zero Tolerance Policy</h3>
      <p class="text-gray-600 leading-relaxed">
        ZiggyBites maintains a strict zero-tolerance policy towards discrimination, verbal or physical abuse, harassment, food tampering, fraud, or intentional platform misuse. Violations may result in immediate suspension or termination of restaurant partnership.
      </p>
    </section>
  </div>
`

export default function CodeOfConductPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [conductData, setConductData] = useState({
    title: "Restaurant Partner Code of Conduct",
    content: "",
    updatedAt: ""
  })

  useEffect(() => {
    const fetchConduct = async () => {
      try {
        const endpoint = API_ENDPOINTS?.ADMIN?.CONDUCT_PUBLIC || "/food/pages/conduct"
        const response = await api.get(endpoint)
        if (response?.data?.success && response?.data?.data) {
          const payload = response.data.data
          setConductData({
            title: payload?.title || "Restaurant Partner Code of Conduct",
            content: payload?.content || DEFAULT_CONDUCT_CONTENT,
            updatedAt: payload?.updatedAt || ""
          })
        } else {
          setConductData({
            title: "Restaurant Partner Code of Conduct",
            content: DEFAULT_CONDUCT_CONTENT,
            updatedAt: new Date().toISOString()
          })
        }
      } catch (_) {
        setConductData({
          title: "Restaurant Partner Code of Conduct",
          content: DEFAULT_CONDUCT_CONTENT,
          updatedAt: new Date().toISOString()
        })
      } finally {
        setLoading(false)
      }
    }

    fetchConduct()
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-10">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-50 flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Code of Conduct</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 pt-[4.5rem]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
          <div className="space-y-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Partner Standards</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {conductData.title || "Restaurant Partner Code of Conduct"}
            </h2>
            <p className="text-sm text-gray-600">
              Last updated:{" "}
              {(conductData.updatedAt ? new Date(conductData.updatedAt) : new Date()).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" }
              )}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading code of conduct...</p>
          ) : conductData.content ? (
            <div
              className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: conductData.content }}
            />
          ) : (
            <p className="text-sm text-gray-500">No code of conduct content available.</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
