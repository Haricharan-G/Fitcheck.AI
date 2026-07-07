import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Odometer({ value, className = "" }: { value: number; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (value > prev) setDirection(1);
    else if (value < prev) setDirection(-1);
    setPrev(value);
  }, [value, prev]);

  return (
    <div className={`relative overflow-hidden inline-flex justify-center items-center ${className}`}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={value}
          custom={direction}
          initial={{ y: direction * 40, opacity: 0, rotateX: direction * -90 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: direction * -40, opacity: 0, rotateX: direction * 90 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, mass: 1 }}
          className="absolute"
        >
          {value}
        </motion.div>
      </AnimatePresence>
      <div className="invisible">{value}</div>
    </div>
  );
}
