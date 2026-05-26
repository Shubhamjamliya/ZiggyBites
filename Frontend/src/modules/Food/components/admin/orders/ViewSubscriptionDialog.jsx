import { Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

const getStatusColor = (status) => {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "expired") return "bg-blue-100 text-blue-700"
  if (normalized === "active") return "bg-emerald-100 text-emerald-700"
  if (normalized.includes("pending")) return "bg-amber-100 text-amber-700"
  if (normalized.includes("failed") || normalized.includes("cancel")) return "bg-rose-100 text-rose-700"
  return "bg-slate-100 text-slate-700"
}

export default function ViewSubscriptionDialog({ isOpen, onOpenChange, order }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-orange-600" />
            Subscription Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this subscription
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription ID</p>
                <p className="text-sm font-medium text-slate-900">{order.shortId || order.subscriptionId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Type</p>
                <p className="text-sm font-medium text-slate-900">{order.orderType}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</p>
                <p className="text-sm font-medium text-slate-900">{order.duration}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Name</p>
                <p className="text-sm font-medium text-slate-900">{order.customerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-medium text-slate-900">{order.customerPhone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Restaurant</p>
                <p className="text-sm font-medium text-slate-900">{order.restaurant}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.statusLabel || order.status}
                </span>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-slate-900">{order.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Delivered</p>
                  <p className="text-lg font-bold text-emerald-600">{order.delivered}</p>
                </div>
              </div>
            </div>
            {Array.isArray(order.schedules) && order.schedules.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Upcoming / Recent Meals</p>
                <div className="max-h-44 overflow-y-auto space-y-2">
                  {order.schedules.slice(0, 8).map((schedule) => (
                    <div key={schedule.scheduleId || schedule._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{schedule.mealName}</p>
                        <p className="text-xs text-slate-500">{schedule.dishName}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {String(schedule.status || "").replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

