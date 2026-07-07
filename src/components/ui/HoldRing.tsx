import { useEffect, useRef } from "react";
import { useTelemetryStore } from "../../features/tracker/store";

export function HoldRing({ size = 200, strokeWidth = 12 }: { size?: number, strokeWidth?: number }) {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    return useTelemetryStore.subscribe(
      (state: any) => state.holdProgress,
      (progress: any) => {
        if (circleRef.current) {
          const offset = circumference - progress * circumference;
          circleRef.current.style.strokeDashoffset = `${offset}`;
        }
      }
    );
  }, [circumference]);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-surface-container-highest"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-primary transition-all duration-75 drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="butt"
        />
      </svg>
    </div>
  );
}
