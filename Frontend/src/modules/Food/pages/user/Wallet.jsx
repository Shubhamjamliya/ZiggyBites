import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, IndianRupee, Plus, Loader2, PlusCircle, ShoppingBag, RefreshCw, ChevronRight, ShieldCheck } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import AddMoneyModal from "@food/components/user/AddMoneyModal"
import { userAPI } from "@food/api"
import { toast } from "sonner"
import { useCompanyName } from "@food/hooks/useCompanyName"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const TRANSACTION_TYPES = {
  ALL: "all",
  ADDITIONS: "additions",
  DEDUCTIONS: "deductions",
  REFUNDS: "refunds",
}

export default function Wallet() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const [selectedFilter, setSelectedFilter] = useState(TRANSACTION_TYPES.ALL)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addMoneyModalOpen, setAddMoneyModalOpen] = useState(false)

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await userAPI.getWallet()
      const walletData = response?.data?.data?.wallet || response?.data?.wallet

      if (walletData) {
        setWallet(walletData)
        setTransactions(walletData.transactions || [])
      }
    } catch (err) {
      debugError("Error fetching wallet:", err)
      setError(err?.response?.data?.message || "Failed to load wallet")
      toast.error("Failed to load wallet data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletData()
  }, [])

  const currentBalance = wallet?.balance || 0

  const filteredTransactions = useMemo(() => {
    if (selectedFilter === TRANSACTION_TYPES.ALL) {
      return transactions
    }

    return transactions.filter((transaction) => {
      if (selectedFilter === TRANSACTION_TYPES.ADDITIONS) {
        return transaction.type === "addition"
      }
      if (selectedFilter === TRANSACTION_TYPES.DEDUCTIONS) {
        return transaction.type === "deduction"
      }
      if (selectedFilter === TRANSACTION_TYPES.REFUNDS) {
        return transaction.type === "refund"
      }
      return true
    })
  }, [selectedFilter, transactions])

  const formatAmount = (amount) => {
    const numeric = Number(amount ?? 0)
    const safe = Number.isFinite(numeric) ? numeric : 0
    return `${"\u20B9"}${safe.toLocaleString("en-IN")}`
  }

  const formatDateStr = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    const formattedDate = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    return `${formattedDate}, ${formattedTime}`
  }

  const getTransactionIcon = (type) => {
    if (type === "addition") {
      return (
        <div className="w-10 h-10 rounded-[12px] bg-green-50 flex items-center justify-center border border-green-100">
          <PlusCircle className="h-5 w-5 text-green-600" strokeWidth={2} />
        </div>
      )
    }
    if (type === "deduction") {
      return (
        <div className="w-10 h-10 rounded-[12px] bg-red-50 flex items-center justify-center border border-red-100">
          <ShoppingBag className="h-5 w-5 text-red-500" strokeWidth={2} />
        </div>
      )
    }
    if (type === "refund") {
      return (
        <div className="w-10 h-10 rounded-[12px] bg-blue-50 flex items-center justify-center border border-blue-100">
          <RefreshCw className="h-5 w-5 text-blue-500" strokeWidth={2} />
        </div>
      )
    }
    return (
      <div className="w-10 h-10 rounded-[12px] bg-gray-50 flex items-center justify-center border border-gray-100">
         <div className="h-2 w-2 bg-gray-400 rounded-full" />
      </div>
    )
  }

  const getTransactionColor = (type) => {
    switch (type) {
      case "addition":
        return "text-[#16a34a]"
      case "deduction":
        return "text-[#e3282c]"
      case "refund":
        return "text-blue-600"
      default:
        return "text-gray-900"
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-white font-sans">
      <header className="sticky top-0 z-10 bg-white px-4 py-4 flex items-center shadow-sm">
        <button onClick={goBack} className="text-gray-800 mr-3">
          <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <h1 className="text-lg font-bold">Wallet</h1>
      </header>

      <main className="max-w-md mx-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {/* Wallet Card */}
            <div className="bg-gradient-to-r from-[#fff5f5] to-[#fffaf8] border border-red-50 rounded-[20px] p-5 relative overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="w-16 h-16 bg-[#e3282c] rounded-[16px] flex items-center justify-center flex-shrink-0 z-10 shadow-sm">
                <IndianRupee className="text-white h-8 w-8" strokeWidth={2.5} />
              </div>
              <div className="z-10">
                <h2 className="text-[17px] font-bold text-gray-900 leading-tight">{companyName} Money</h2>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5 tracking-tight">{formatAmount(currentBalance)}</p>
              </div>
              
              {/* Wallet Illustration in background */}
              <div className="absolute right-[-15px] top-1/2 transform -translate-y-1/2 opacity-20 pointer-events-none">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#e3282c" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                  <circle cx="18" cy="14" r="1.5" fill="#e3282c" />
                </svg>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 text-center font-medium my-1">
              Add money to enjoy one-tap, seamless payments
            </p>

            <Button
              className="w-full bg-[#16a34a] hover:bg-[#15803d] active:bg-[#16a34a] text-white rounded-[12px] h-12 font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98]"
              onClick={() => setAddMoneyModalOpen(true)}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} /> Add money
            </Button>

            <div className="mt-8 pt-4">
              <h3 className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-4">
                Transaction History
              </h3>
              
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {[
                  { id: TRANSACTION_TYPES.ALL, label: "All Transactions" },
                  { id: TRANSACTION_TYPES.ADDITIONS, label: "Additions" },
                  { id: TRANSACTION_TYPES.DEDUCTIONS, label: "Deductions" },
                  { id: TRANSACTION_TYPES.REFUNDS, label: "Refunds" },
                ].map((filter) => {
                  const isSelected = selectedFilter === filter.id
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedFilter(filter.id)}
                      className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                        isSelected 
                          ? "border-[#16a34a] text-[#16a34a] bg-green-50/50" 
                          : "border-gray-200 text-gray-600 bg-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 space-y-3">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <div key={tx.id} className="bg-white border border-gray-100 rounded-[16px] p-4 flex items-center justify-between shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-3.5">
                        {getTransactionIcon(tx.type)}
                        <div>
                          <p className="text-[13px] font-bold text-gray-900 leading-tight">
                            {tx.description || "Transaction"}
                          </p>
                          <p className="text-[11px] text-gray-500 font-medium mt-1">
                            {tx.metadata?.source === "referral_signup" || String(tx.description || "").toLowerCase().startsWith("referral reward")
                              ? "Promocode: REFERRAL" 
                              : tx.metadata?.orderId ? `Order #${tx.metadata.orderId.substring(0, 8).toUpperCase()}` : "Paid via UPI"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-[13px] font-bold ${getTransactionColor(tx.type)}`}>
                            {tx.type === "deduction" ? "-" : "+"}{formatAmount(tx.amount)}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium mt-1">
                            {formatDateStr(tx.date || tx.createdAt)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={2.5} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium text-gray-400">No transactions found</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-8 pt-4 pb-8 opacity-60">
              <ShieldCheck className="h-4 w-4 text-[#16a34a]" strokeWidth={2} />
              <span className="text-[11px] font-semibold text-gray-500">100% secure payments</span>
            </div>
          </div>
        )}
      </main>

      <AddMoneyModal
        open={addMoneyModalOpen}
        onOpenChange={setAddMoneyModalOpen}
        onSuccess={fetchWalletData}
      />
    </AnimatedPage>
  )
}
