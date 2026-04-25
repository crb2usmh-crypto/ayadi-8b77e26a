import { motion } from "framer-motion";

export function GradientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-32 -start-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        animate={{ x: [0, 60, -20, 0], y: [0, -40, 30, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -end-32 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl"
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-glow/20 blur-3xl"
        animate={{ x: [-20, 30, -10, -20], y: [0, 20, -30, 0], scale: [1, 1.05, 0.98, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}