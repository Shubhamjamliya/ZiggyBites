import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "@food/api";
import { toast } from "sonner";
import { getModuleToken } from "@food/utils/auth";

const emptyForm = {
  id: "",
  title: "",
  timeLabel: "",
  description: "",
  icon: "meal",
  accentColor: "#ef2b24",
  backgroundColor: "#fff7ed",
  image: null,
  previewUrl: "",
};

const iconOptions = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snacks", label: "Evening Snacks" },
  { value: "dinner", label: "Dinner" },
  { value: "meal", label: "Meal" },
];

export default function MealTimeManagement() {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isEditing = Boolean(form.id);

  const authConfig = useMemo(() => {
    const token = getModuleToken("admin");
    return token
      ? { contextModule: "admin", headers: { Authorization: `Bearer ${token}` } }
      : { contextModule: "admin" };
  }, []);

  const loadSlots = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/food/meal-slots", authConfig);
      setSlots(response?.data?.data?.slots || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load meal slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const resetForm = () => {
    if (form.previewUrl && form.image) URL.revokeObjectURL(form.previewUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm(emptyForm);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError("Please upload a valid image file");
      event.target.value = "";
      return;
    }
    if (form.previewUrl && form.image) URL.revokeObjectURL(form.previewUrl);
    setError("");
    setForm((current) => ({
      ...current,
      image: file,
      previewUrl: URL.createObjectURL(file),
    }));
  };

  const editSlot = (slot) => {
    resetForm();
    setForm({
      id: slot._id || slot.id || "",
      title: slot.title || "",
      timeLabel: slot.timeLabel || "",
      description: slot.description || "",
      icon: slot.icon || "meal",
      accentColor: slot.accentColor || "#ef2b24",
      backgroundColor: slot.backgroundColor || "#fff7ed",
      image: null,
      previewUrl: slot.imageUrl || "",
    });
  };

  const saveSlot = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = new FormData();
      body.append("title", form.title);
      body.append("timeLabel", form.timeLabel);
      body.append("description", form.description);
      body.append("icon", form.icon);
      body.append("accentColor", form.accentColor);
      body.append("backgroundColor", form.backgroundColor);
      if (form.image) body.append("image", form.image);

      const config = {
        ...authConfig,
        headers: {
          ...(authConfig.headers || {}),
          "Content-Type": "multipart/form-data",
        },
      };

      if (isEditing) {
        const response = await api.patch(`/food/meal-slots/${form.id}`, body, config);
        const updatedSlot = response?.data?.data?.slot;
        if (updatedSlot?.imageUrl) {
          setSlots((current) =>
            current.map((slot) =>
              (slot._id || slot.id) === form.id ? { ...slot, ...updatedSlot } : slot,
            ),
          );
        }
      } else {
        await api.post("/food/meal-slots", body, config);
      }

      setMessage(isEditing ? "Meal slot updated" : "Meal slot added");
      resetForm();
      await loadSlots();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save meal slot");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slot) => {
    const id = slot._id || slot.id;
    if (!id || !window.confirm(`Delete ${slot.title}?`)) return;
    try {
      await api.delete(`/food/meal-slots/${id}`, authConfig);
      setMessage("Meal slot deleted");
      await loadSlots();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete meal slot");
    }
  };

  const toggleSlot = async (slot) => {
    const id = slot._id || slot.id;
    if (!id) return;
    try {
      await api.patch(`/food/meal-slots/${id}/status`, {}, authConfig);
      const nextActive = !slot.isActive;
      const msg = nextActive
        ? `"${slot.title}" is now Active (Visible to users)`
        : `"${slot.title}" is now Hidden (Hidden from users)`;
      setMessage(msg);
      toast.success(msg);
      await loadSlots();
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Failed to update status";
      setError(errMsg);
      toast.error(errMsg);
    }
  };

  const moveSlot = async (slot, direction) => {
    const id = slot._id || slot.id;
    if (!id) return;
    const nextOrder = Number(slot.order ?? slot.sortOrder ?? 0) + direction;
    try {
      await api.patch(`/food/meal-slots/${id}/order`, { order: nextOrder }, authConfig);
      toast.success("Meal slot order updated");
      await loadSlots();
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Failed to update order";
      setError(errMsg);
      toast.error(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] p-6 transition-colors duration-200">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meal Time Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            Manage and toggle visibility of meal slots displayed on the user Choose Meal page.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="text-emerald-700 dark:text-emerald-300 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-red-700 dark:text-red-300 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={saveSlot} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-5 shadow-sm h-fit">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEditing ? "Edit Meal" : "Add Meal"}
            </h2>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Meal Name</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Breakfast"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Time Label</span>
              <input
                value={form.timeLabel}
                onChange={(event) => setForm((current) => ({ ...current, timeLabel: event.target.value }))}
                placeholder="7:00 AM - 10:00 AM"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional helper text"
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Icon</span>
                <select
                  value={form.icon}
                  onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                >
                  {iconOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Accent</span>
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-1 cursor-pointer"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Card BG</span>
                <input
                  type="color"
                  value={form.backgroundColor}
                  onChange={(event) => setForm((current) => ({ ...current, backgroundColor: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-1 cursor-pointer"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-gray-300">Meal Image</span>
              <div className="mt-1 flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
                {form.previewUrl && (
                  <div className="flex items-center gap-2">
                    <img src={form.previewUrl} alt="Meal preview" className="h-16 w-20 rounded-lg object-cover border dark:border-gray-700" />
                    {form.image && (
                      <span className="max-w-[140px] truncate text-xs font-semibold text-slate-500 dark:text-gray-400">
                        {form.image.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ef2b24] hover:bg-[#d9221b] text-sm font-bold text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEditing ? "Save Meal" : "Add Meal"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configured Meals</h2>
            <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-3 py-1 text-xs font-bold text-slate-600 dark:text-gray-300">
              {slots.length} item(s)
            </span>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-gray-800 text-slate-400">
              <ImageIcon className="mb-2 h-8 w-8" />
              No meal slots yet
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => {
                const isActive = slot.isActive !== false;
                return (
                  <article
                    key={slot._id || slot.id}
                    className={`overflow-hidden rounded-xl border transition-all duration-200 shadow-sm ${
                      isActive
                        ? "border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]"
                        : "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 opacity-75 grayscale-[20%]"
                    }`}
                  >
                    <div
                      className="relative h-40 p-4"
                      style={{ backgroundColor: slot.backgroundColor || "#fff7ed" }}
                    >
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm"
                        style={{ color: slot.accentColor || "#ef2b24" }}
                      >
                        <CalendarClock className="h-5 w-5" />
                      </span>
                      
                      {/* Active / Hidden Status Badge */}
                      <span
                        className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-sm ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" />
                            Hidden
                          </>
                        )}
                      </span>

                      {slot.imageUrl ? (
                        <img src={slot.imageUrl} alt={slot.title} className="absolute bottom-0 right-0 h-24 w-40 object-contain" />
                      ) : (
                        <div className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-xl font-black text-slate-400">
                          {String(slot.title || "M").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 max-w-[65%]">
                        <p className="font-black text-slate-950">{slot.title}</p>
                        <p className="mt-1 text-[11px] font-black uppercase" style={{ color: slot.accentColor || "#ef2b24" }}>
                          {slot.timeLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-[#1a1a1a] border-t border-slate-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => editSlot(slot)}
                        title="Edit meal slot"
                        className="rounded-lg border border-slate-200 dark:border-gray-700 p-2 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlot(slot, -1)}
                        title="Move up"
                        className="rounded-lg border border-slate-200 dark:border-gray-700 p-2 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlot(slot, 1)}
                        title="Move down"
                        className="rounded-lg border border-slate-200 dark:border-gray-700 p-2 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      
                      {/* Toggle Active / Hidden Status Button */}
                      <button
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        title={isActive ? "Click to Hide this meal from user app" : "Click to Make Active on user app"}
                        className={`rounded-lg border p-2 transition-colors flex items-center gap-1 text-xs font-semibold ${
                          isActive
                            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                            : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                        }`}
                      >
                        {isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <span className="hidden sm:inline">{isActive ? "Hide" : "Show"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteSlot(slot)}
                        title="Delete meal slot"
                        className="rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


