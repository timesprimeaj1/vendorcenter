import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PageLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for the DOM to settle, then fade out
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
        >
          <div className="flex flex-col items-center gap-6">
            {/* Animated logo mark */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="relative"
            >
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] flex items-center justify-center shadow-xl">
                <span className="text-2xl font-bold text-white font-display">V</span>
              </div>
              {/* Orbital ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-3"
              >
                <div className="h-full w-full rounded-full border-2 border-transparent border-t-primary/40 border-r-primary/20" />
              </motion.div>
            </motion.div>

            {/* Progress bar */}
            <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, ease: "easeInOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(340,82%,52%)]"
              />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-muted-foreground tracking-widest uppercase"
            >
              VendorCenter
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
