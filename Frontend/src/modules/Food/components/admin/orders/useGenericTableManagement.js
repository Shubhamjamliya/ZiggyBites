import { useState, useMemo } from "react"
import { exportToExcel, exportToPDF } from "./ordersExportUtils"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export function useGenericTableManagement(data, title, searchFields = []) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({})

  // Apply search
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search query
    if (searchQuery.trim() && searchFields.length > 0) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(item => 
        searchFields.some(field => {
          const value = item[field]
          return value && value.toString().toLowerCase().includes(query)
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "") {
        result = result.filter(item => {
          const itemValue = item[key]
          if (typeof value === 'string') {
            return itemValue === value || itemValue?.toString().toLowerCase() === value.toLowerCase()
          }
          return itemValue === value
        })
      }
    })

    return result
  }, [data, searchQuery, filters, searchFields])

  const count = filteredData.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "" && value !== null && value !== undefined).length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  const handleExport = async (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "excel":
        exportToExcel(filteredData, filename)
        break
      case "pdf":
        await exportToPDF(filteredData, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const toNumber = (val) => {
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }

  const formatMoney = (val) => {
    return `Rs. ${toNumber(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDisplayText = (val) => {
    if (val === null || val === undefined || val === "") return "N/A"
    return String(val).trim()
  }

  const formatOrderAddress = (addr) => {
    if (!addr) return "N/A"
    if (typeof addr === "string") return addr
    const parts = [
      addr.street,
      addr.addressLine1 || addr.addressLine,
      addr.addressLine2,
      addr.landmark,
      addr.city,
      addr.state,
      addr.pincode || addr.postalCode,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "N/A"
  }

  const handlePrintOrder = async (tableOrder) => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const raw = tableOrder?.originalOrder || tableOrder || {}
      const user = raw?.userId && typeof raw.userId === "object" ? raw.userId : null
      const restaurant = raw?.restaurantId && typeof raw.restaurantId === "object" ? raw.restaurantId : null
      const dispatchPartner = raw?.dispatch?.deliveryPartnerId && typeof raw.dispatch.deliveryPartnerId === "object" ? raw.dispatch.deliveryPartnerId : null

      const orderId = formatDisplayText(
        tableOrder?.orderId ||
        raw?.orderId ||
        raw?._id ||
        raw?.id ||
        tableOrder?.subscriptionId
      )

      const orderDate = tableOrder?.orderDate || tableOrder?.date
        ? `${tableOrder.orderDate || tableOrder.date}${tableOrder.orderTime || tableOrder.time ? `, ${tableOrder.orderTime || tableOrder.time}` : ""}`
        : raw?.createdAt
        ? new Date(raw.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : new Date().toLocaleDateString("en-IN")

      const customerName = formatDisplayText(
        tableOrder?.userName ||
        tableOrder?.customerName ||
        raw?.customerName ||
        raw?.userName ||
        user?.name
      )

      const customerPhone = formatDisplayText(
        tableOrder?.userNumber ||
        tableOrder?.customerPhone ||
        raw?.customerPhone ||
        raw?.userNumber ||
        user?.phone ||
        raw?.deliveryAddress?.phone
      )

      const restaurantName = formatDisplayText(
        tableOrder?.restaurantName ||
        tableOrder?.restaurant ||
        raw?.restaurantName ||
        raw?.restaurant ||
        restaurant?.restaurantName
      )

      const deliveryPartnerName = formatDisplayText(
        tableOrder?.deliveryBoyName ||
        tableOrder?.deliveryPartnerName ||
        raw?.deliveryPartnerName ||
        raw?.deliveryBoyName ||
        dispatchPartner?.name ||
        raw?.deliveryPartnerId?.name
      )

      const deliveryPartnerPhone = formatDisplayText(
        tableOrder?.deliveryBoyNumber ||
        tableOrder?.deliveryPartnerPhone ||
        raw?.deliveryPartnerPhone ||
        raw?.deliveryBoyNumber ||
        dispatchPartner?.phone ||
        raw?.deliveryPartnerId?.phone
      )

      const orderStatus = formatDisplayText(
        tableOrder?.status ||
        raw?.orderStatus ||
        raw?.status
      )

      const paymentStatus = formatDisplayText(
        raw?.payment?.status ||
        tableOrder?.paymentStatus ||
        raw?.paymentStatus ||
        (raw?.payment?.method === "cash" ? "Cash on Delivery" : "Paid")
      )

      const deliveryAddress = formatOrderAddress(
        raw?.deliveryAddress ||
        raw?.customerAddress ||
        raw?.address ||
        tableOrder?.address
      )

      const items = Array.isArray(raw?.items) && raw.items.length > 0
        ? raw.items
        : Array.isArray(tableOrder?.items) && tableOrder.items.length > 0
        ? tableOrder.items
        : []

      const pricing = raw?.pricing || {}
      const subtotal = toNumber(pricing.subtotal ?? pricing.itemsTotal ?? raw?.subtotal)
      const deliveryFee = toNumber(pricing.deliveryFee ?? pricing.deliveryCharge ?? raw?.deliveryFee)
      const taxAmount = toNumber(pricing.tax ?? pricing.taxAmount ?? raw?.tax)
      const discountAmount = toNumber(pricing.discount ?? pricing.couponDiscount ?? raw?.discount)
      const totalAmount = toNumber(
        pricing.total ??
        raw?.totalAmount ??
        tableOrder?.totalAmount ??
        (subtotal + deliveryFee + taxAmount - discountAmount)
      )

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const pageWidth = doc.internal.pageSize.getWidth()

      // Header Banner
      doc.setFillColor(15, 118, 110)
      doc.rect(0, 0, pageWidth, 46, "F")
      doc.setFillColor(255, 255, 255)
      doc.setGState(new doc.GState({ opacity: 0.08 }))
      doc.circle(pageWidth - 24, 12, 18, "F")
      doc.circle(pageWidth - 6, 36, 22, "F")
      doc.setGState(new doc.GState({ opacity: 1 }))

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(17)
      doc.setFont(undefined, "bold")
      doc.text("ZiggyBites", 14, 17)
      doc.setFontSize(10)
      doc.setFont(undefined, "normal")
      doc.text("Order Invoice", 14, 24)
      doc.setFontSize(8.5)
      doc.text("Order summary with billing and delivery details", 14, 30)

      doc.setFontSize(9)
      doc.text(`Invoice #: ${orderId}`, pageWidth - 14, 14, { align: "right" })
      doc.text(`Date: ${orderDate}`, pageWidth - 14, 20, { align: "right" })
      doc.text(`Status: ${orderStatus}`, pageWidth - 14, 26, { align: "right" })
      doc.text(`Payment: ${paymentStatus}`, pageWidth - 14, 32, { align: "right" })

      doc.setDrawColor(226, 232, 240)
      doc.setFillColor(248, 250, 252)

      const drawInfoCard = (titleText, x, y, width, rows, accentColor = [15, 118, 110]) => {
        const cardPaddingX = 4
        const titleBarHeight = 8
        const contentStartY = y + 14
        const labelX = x + cardPaddingX
        const valueX = x + 18
        const valueWidth = width - 26

        let measuredHeight = contentStartY
        const measuredRows = rows.map((row) => {
          const label = `${row.label}:`
          const valueLines = doc.splitTextToSize(formatDisplayText(row.value), valueWidth)
          const rowHeight = Math.max(5, valueLines.length * 4)
          measuredHeight += rowHeight
          return { label, valueLines, rowHeight }
        })

        const cardHeight = Math.max(39, measuredHeight - y + 4)

        doc.setFillColor(255, 255, 255)
        doc.roundedRect(x, y, width, cardHeight, 3, 3, "FD")
        doc.setFillColor(...accentColor)
        doc.roundedRect(x, y, width, titleBarHeight, 3, 3, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont(undefined, "bold")
        doc.text(titleText, labelX, y + 5.5)
        doc.setTextColor(71, 85, 105)
        doc.setFont(undefined, "normal")
        doc.setFontSize(8.5)

        let currentY = contentStartY
        measuredRows.forEach((row) => {
          doc.setFont(undefined, "bold")
          doc.text(row.label, labelX, currentY)
          doc.setFont(undefined, "normal")
          doc.text(row.valueLines, valueX, currentY)
          currentY += row.rowHeight
        })

        return cardHeight
      }

      const customerCardHeight = drawInfoCard("Customer", 14, 53, 58, [
        { label: "Name", value: customerName },
        { label: "Phone", value: customerPhone },
        { label: "Address", value: deliveryAddress },
      ])
      const restaurantCardHeight = drawInfoCard("Restaurant", 76, 53, 58, [
        { label: "Name", value: restaurantName },
        { label: "Items", value: `${items.length} item(s)` },
      ], [37, 99, 235])
      const deliveryCardHeight = drawInfoCard("Delivery Partner", 138, 53, 58, [
        { label: "Name", value: deliveryPartnerName },
        { label: "Phone", value: deliveryPartnerPhone },
      ], [249, 115, 22])

      const infoCardsBottomY = 53 + Math.max(customerCardHeight, restaurantCardHeight, deliveryCardHeight)

      autoTable(doc, {
        startY: infoCardsBottomY + 8,
        body: [[
          `Order ID: ${orderId}`,
          `Status: ${orderStatus}`,
          `Payment: ${paymentStatus}`,
          `Grand Total: ${formatMoney(totalAmount)}`,
        ]],
        theme: "plain",
        styles: {
          fontSize: 9,
          textColor: [30, 41, 59],
          fillColor: [241, 245, 249],
          cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
          lineColor: [226, 232, 240],
          lineWidth: 0.25,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 45 },
          2: { cellWidth: 50 },
          3: { cellWidth: 42, halign: "right", textColor: [15, 118, 110] },
        },
        margin: { left: 14, right: 14 },
      })

      const tableBody = items.length > 0
        ? items.map((item) => {
          const qty = toNumber(item.quantity || item.qty || 1)
          const title = item.name || item.itemName || item.title || item.dishName || "Item"
          const unitPrice = toNumber(item.price || item.unitPrice)
          const lineTotal = qty * unitPrice
          return [qty, title, formatMoney(unitPrice), formatMoney(lineTotal)]
        })
        : [[1, "Order Total", formatMoney(totalAmount), formatMoney(totalAmount)]]

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 110) + 6,
        head: [["Qty", "Item", "Unit Price", "Line Total"]],
        body: tableBody,
        theme: "grid",
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: 255,
          fontSize: 9,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        styles: {
          cellPadding: 3.2,
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 18 },
          1: { cellWidth: 94 },
          2: { halign: "right", cellWidth: 36 },
          3: { halign: "right", cellWidth: 38 },
        },
        margin: { left: 14, right: 14 },
      })

      const summaryStartY = (doc.lastAutoTable?.finalY || 130) + 10
      doc.setDrawColor(226, 232, 240)
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(pageWidth - 92, summaryStartY - 5, 78, 35, 2, 2, "FD")
      autoTable(doc, {
        startY: summaryStartY,
        body: [
          ["Subtotal", formatMoney(subtotal || totalAmount)],
          ["Delivery Fee", formatMoney(deliveryFee)],
          ["Tax", formatMoney(taxAmount)],
          ["Discount", `- ${formatMoney(discountAmount)}`],
          ["Grand Total", formatMoney(totalAmount)],
        ],
        theme: "plain",
        styles: {
          fontSize: 10,
          textColor: [30, 41, 59],
          cellPadding: 1.8,
        },
        columnStyles: {
          0: { cellWidth: 34, fontStyle: "bold" },
          1: { cellWidth: 40, halign: "right" },
        },
        margin: { left: pageWidth - 88 },
        didParseCell: (hookData) => {
          if (hookData.row.index === 4) {
            hookData.cell.styles.fontStyle = "bold"
            hookData.cell.styles.fontSize = 11
            hookData.cell.styles.textColor = [15, 118, 110]
          }
        },
      })

      const footerY = Math.max((doc.lastAutoTable?.finalY || summaryStartY) + 18, 262)
      doc.setDrawColor(226, 232, 240)
      doc.line(14, footerY - 6, pageWidth - 14, footerY - 6)
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`Generated on ${new Date().toLocaleString()}`, 14, footerY)
      doc.text("Includes customer, restaurant, and delivery partner details.", pageWidth - 14, footerY, { align: "right" })

      const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(filename)
    } catch (error) {
      debugError("Error generating PDF invoice:", error)
      alert("Failed to download PDF invoice. Please try again.")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = (defaultColumns) => {
    setVisibleColumns(defaultColumns || {})
  }

  return {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  }
}

