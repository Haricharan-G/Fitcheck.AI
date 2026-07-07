import { useEffect, useState, useRef } from "react";
import LottieModule, { type LottieRefCurrentProps } from "lottie-react";
import checkmarkData from "../../assets/checkmark.json";

// Handle Vite/CJS interop for lottie-react
const Lottie = (LottieModule as any).default || LottieModule;

interface Props {
  trigger: number; // Increment to trigger the animation
}

export function LottieCheckmark({ trigger }: Props) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger > 0 && lottieRef.current) {
      setKey(prev => prev + 1); // Force re-render to restart animation
    }
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
      <div className="w-64 h-64 opacity-80 mix-blend-screen drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
        <Lottie
          key={key}
          lottieRef={lottieRef}
          animationData={checkmarkData}
          loop={false}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
