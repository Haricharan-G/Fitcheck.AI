import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { ProtocolConfig, TelemetryFrame, SetResult } from "./types";
import { ProtocolSetup } from "./ProtocolSetup";
import { ActiveHUD } from "./ActiveHUD";
import { PostSetAnalytics } from "./PostSetAnalytics";

type View = "setup" | "active" | "analytics";

export function RehabDashboard() {
  const [view, setView] = useState<View>("setup");
  const [config, setConfig] = useState<ProtocolConfig | null>(null);
  const [telemetryLog, setTelemetryLog] = useState<TelemetryFrame[]>([]);
  const [completedSets, setCompletedSets] = useState<SetResult[]>([]);

  const handleStart = useCallback((newConfig: ProtocolConfig) => {
    setConfig(newConfig);
    setTelemetryLog([]);
    setView("active");
  }, []);

  const handleFinish = useCallback((log: TelemetryFrame[]) => {
    setTelemetryLog(log);
    setView("analytics");
  }, []);

  const handleNewSet = useCallback((result: SetResult) => {
    setCompletedSets((prev) => [...prev, result]);
  }, []);

  const handleBackToSetup = useCallback(() => {
    setView("setup");
    setConfig(null);
    setTelemetryLog([]);
    setCompletedSets([]);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {view === "setup" && (
        <ProtocolSetup key="setup" onStart={handleStart} />
      )}

      {view === "active" && config && (
        <ActiveHUD key="active" config={config} onFinish={handleFinish} />
      )}

      {view === "analytics" && config && (
        <PostSetAnalytics
          key="analytics"
          config={config}
          telemetryLog={telemetryLog}
          previousSets={completedSets}
          onNewSet={handleNewSet}
          onBackToSetup={handleBackToSetup}
        />
      )}
    </AnimatePresence>
  );
}
