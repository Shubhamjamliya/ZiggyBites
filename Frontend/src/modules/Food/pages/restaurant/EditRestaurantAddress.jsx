import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, Loader2, MapPin, Navigation, Search } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { toast } from "sonner"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { Label } from "@food/components/ui/label"

const ADDRESS_STORAGE_KEY = "restaurant_address"
const DEFAULT_LAT = 22.7196
const DEFAULT_LNG = 75.8577
const isNearZero = (n) => Math.abs(Number(n) || 0) < 0.000001

export default function EditRestaurantAddress() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantName, setRestaurantName] = useState("")

  const [form, setForm] = useState({
    formattedAddress: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
  })

  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)

  // Fetch restaurant data from backend
  useEffect(() => {
    let cancelled = false
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data && !cancelled) {
          setRestaurantName(data.name || data.restaurantName || "")
          const loc = data.location || {}
          const latVal = Number(loc.latitude ?? data.latitude)
          const lngVal = Number(loc.longitude ?? data.longitude)
          const hasCoords =
            Number.isFinite(latVal) &&
            Number.isFinite(lngVal) &&
            !isNearZero(latVal) &&
            !isNearZero(lngVal)

          setForm({
            formattedAddress:
              loc.formattedAddress ||
              loc.address ||
              data.formattedAddress ||
              data.address ||
              "",
            addressLine1:
              loc.addressLine1 || data.addressLine1 || loc.formattedAddress || "",
            addressLine2: loc.addressLine2 || data.addressLine2 || "",
            area: loc.area || data.area || "",
            city: loc.city || data.city || "",
            state: loc.state || data.state || "",
            pincode: loc.pincode || data.pincode || "",
            landmark: loc.landmark || data.landmark || "",
            latitude: hasCoords ? latVal : DEFAULT_LAT,
            longitude: hasCoords ? lngVal : DEFAULT_LNG,
          })
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRestaurantData()
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (loading) return
    let cancelled = false

    const initAutocomplete = async () => {
      try {
        if (!window.google?.maps?.places?.Autocomplete) {
          const apiKey = await getGoogleMapsApiKey()
          if (!apiKey) return

          await new Promise((resolve) => {
            const existing =
              document.getElementById("admin-google-maps-script") ||
              document.querySelector(
                'script[src*="maps.googleapis.com/maps/api/js"]'
              )
            if (existing) {
              if (window.google?.maps?.places?.Autocomplete) {
                resolve()
                return
              }
              existing.addEventListener("load", resolve, { once: true })
              setTimeout(resolve, 3000)
              return
            }
            const script = document.createElement("script")
            script.id = "admin-google-maps-script"
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
            script.async = true
            script.defer = true
            script.onload = resolve
            script.onerror = resolve
            document.head.appendChild(script)
          })
        }

        if (cancelled || !window.google?.maps?.places?.Autocomplete) return
        const inputEl = locationSearchInputRef.current
        if (!inputEl) return

        const autocomplete = new window.google.maps.places.Autocomplete(
          inputEl,
          {
            fields: ["formatted_address", "address_components", "geometry"],
            componentRestrictions: { country: "in" },
          }
        )
        placesAutocompleteRef.current = autocomplete

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          const comps = Array.isArray(place?.address_components)
            ? place.address_components
            : []
          const get = (types) =>
            comps.find((c) => types.some((t) => c.types?.includes(t)))
              ?.long_name || ""
          const area =
            get(["sublocality_level_1", "sublocality", "neighborhood"]) ||
            get(["locality"])
          const city =
            get(["locality"]) || get(["administrative_area_level_2"])
          const state = get(["administrative_area_level_1"])
          const pincode = get(["postal_code"])
          const lat = place?.geometry?.location?.lat?.()
          const lng = place?.geometry?.location?.lng?.()

          const formattedAddress = place?.formatted_address || ""

          setForm((prev) => ({
            ...prev,
            formattedAddress: formattedAddress || prev.formattedAddress,
            addressLine1: formattedAddress || prev.addressLine1,
            area: area || prev.area,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode,
            latitude: Number.isFinite(lat)
              ? Number(lat.toFixed(6))
              : prev.latitude,
            longitude: Number.isFinite(lng)
              ? Number(lng.toFixed(6))
              : prev.longitude,
          }))
        })
      } catch (err) {
        console.warn("Failed to load Google Places:", err)
      }
    }

    initAutocomplete()

    return () => {
      cancelled = true
      if (placesAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(
          placesAutocompleteRef.current
        )
      }
      placesAutocompleteRef.current = null
    }
  }, [loading])

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))
        toast.success("GPS coordinates detected!")
      },
      (err) => {
        toast.error(
          "Failed to get location: " + (err.message || "Permission denied")
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSave = async (e) => {
    e?.preventDefault?.()
    const lat = Number(form.latitude)
    const lng = Number(form.longitude)

    if (!form.formattedAddress && !form.addressLine1) {
      toast.error("Please enter restaurant address")
      return
    }

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      isNearZero(lat) ||
      isNearZero(lng)
    ) {
      toast.error("Please enter valid latitude and longitude coordinates")
      return
    }

    try {
      setSaving(true)
      const formattedAddress = String(
        form.formattedAddress || form.addressLine1 || ""
      ).trim()
      const updatedLocation = {
        type: "Point",
        latitude: lat,
        longitude: lng,
        coordinates: [lng, lat],
        formattedAddress,
        address: formattedAddress,
        addressLine1: String(form.addressLine1 || formattedAddress).trim(),
        addressLine2: String(form.addressLine2 || "").trim(),
        area: String(form.area || "").trim(),
        city: String(form.city || "").trim(),
        state: String(form.state || "").trim(),
        pincode: String(form.pincode || "").trim(),
        landmark: String(form.landmark || "").trim(),
      }

      const res = await restaurantAPI.updateProfile({
        location: updatedLocation,
      })
      if (
        res?.data?.data?.restaurant ||
        res?.data?.restaurant ||
        res?.status === 200
      ) {
        try {
          localStorage.setItem(ADDRESS_STORAGE_KEY, formattedAddress)
        } catch {}
        window.dispatchEvent(new Event("addressUpdated"))
        toast.success("Outlet address & location updated successfully!")
        setTimeout(() => {
          goBack()
        }, 500)
      } else {
        throw new Error(res?.data?.message || "Failed to update address")
      }
    } catch (err) {
      console.error("Error saving address:", err)
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update address"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              Edit Outlet Location
            </h1>
            <p className="text-xs text-gray-500">
              {restaurantName || "Restaurant Outlet"}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-[#E91E63] hover:bg-[#D81557] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm"
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Location"
          )}
        </Button>
      </div>

      <div className="max-w-2xl w-full mx-auto p-4 space-y-4 pb-16">
        {/* Map Preview Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#E91E63]" />
              <h2 className="text-sm font-bold text-gray-900">
                Outlet Map Location
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDetectLocation}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              Use GPS Location
            </button>
          </div>

          <div className="w-full h-52 rounded-xl overflow-hidden border border-gray-200 shadow-inner relative bg-gray-100">
            <iframe
              src={`https://www.google.com/maps?q=${form.latitude},${form.longitude}&hl=en&z=15&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <p className="text-[11px] text-gray-500">
            Coordinates: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
          </p>
        </div>

        {/* Search Places */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <Label className="text-xs font-bold text-gray-800">
            Search Place / Landmark
          </Label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <Input
              ref={locationSearchInputRef}
              placeholder="Search address or area via Google Places..."
              className="pl-9 bg-gray-50 border-gray-200 text-sm h-10 rounded-xl"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Select a suggestion to auto-fill the address and coordinates below,
            or type them manually.
          </p>
        </div>

        {/* Address Form Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            Address Details
          </h2>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Complete Formatted Address
              </Label>
              <textarea
                value={form.formattedAddress}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    formattedAddress: e.target.value,
                    addressLine1: p.addressLine1 || e.target.value,
                  }))
                }
                rows={2}
                placeholder="Full address as shown to customers"
                className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E91E63]/20 focus:border-[#E91E63]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Address Line 1 (Shop/Building/Street)
                </Label>
                <Input
                  value={form.addressLine1}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, addressLine1: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Shop 12, Main Street"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Address Line 2 (Optional)
                </Label>
                <Input
                  value={form.addressLine2}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, addressLine2: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Floor 2"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Area / Locality
                </Label>
                <Input
                  value={form.area}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, area: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Vijay Nagar"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  City
                </Label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, city: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Indore"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  State
                </Label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, state: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Madhya Pradesh"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Pincode / Postal Code
                </Label>
                <Input
                  value={form.pincode}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pincode: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. 452010"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Landmark
                </Label>
                <Input
                  value={form.landmark}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, landmark: e.target.value }))
                  }
                  className="mt-1 bg-gray-50 text-sm h-10 rounded-xl"
                  placeholder="e.g. Opposite City Mall"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <Label className="text-xs font-semibold text-gray-700 block mb-2">
                Coordinates (GPS)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-gray-500">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, latitude: e.target.value }))
                    }
                    className="mt-1 bg-gray-50 text-sm h-10 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-500">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, longitude: e.target.value }))
                    }
                    className="mt-1 bg-gray-50 text-sm h-10 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="w-full bg-[#E91E63] hover:bg-[#D81557] text-white font-bold h-12 rounded-xl shadow-md transition-all active:scale-[0.99]"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Outlet Location...
                </span>
              ) : (
                "Save Address & Location"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
