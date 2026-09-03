import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, Search, Volume2 } from "lucide-react";

export default function VoiceSearchModal({
  isOpen,
  transcript = "",
  onClose,
  onSubmit,
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (transcript.trim() && onSubmit) {
      onSubmit(transcript.trim());
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {/* Backdrop Click to Close */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#18181b] rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-zinc-800 text-center z-10 overflow-hidden"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close voice search"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Central Microphone Animation */}
            <div className="relative my-6 flex items-center justify-center">
              {/* Outer Ripple 1 */}
              <div className="absolute w-32 h-32 rounded-full bg-red-500/10 dark:bg-red-500/15 animate-ping" />
              {/* Outer Ripple 2 */}
              <div className="absolute w-24 h-24 rounded-full bg-red-500/20 dark:bg-red-500/25 animate-pulse" />

              {/* Glowing Mic Button */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#e23744] to-[#f25c54] text-white flex items-center justify-center shadow-[0_0_25px_rgba(226,55,68,0.5)]">
                <Mic className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
              </div>
            </div>

            {/* Status Heading */}
            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              Listening...
            </h3>

            {/* Audio Wave Bars */}
            <div className="flex items-center justify-center gap-1.5 h-6 my-3">
              {[0.4, 0.8, 0.5, 1, 0.6, 0.9, 0.4].map((scale, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scaleY: [1, scale * 2.2, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.8,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                  className="w-1 bg-[#e23744] rounded-full h-3"
                />
              ))}
            </div>

            {/* Live Transcript / Prompt */}
            <div className="min-h-[60px] flex items-center justify-center px-4 py-3 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800 my-4">
              {transcript ? (
                <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug break-words">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-xs sm:text-sm font-medium text-gray-400 dark:text-zinc-400 italic flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-gray-400 shrink-0" />
                  Say a dish, cuisine, or restaurant name...
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              {transcript.trim() && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-[#e23744] hover:bg-[#d12836] text-white shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
