import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { Dashboard } from './pages/Dashboard';
import { Tracker } from './features/tracker/Tracker';
import { History } from './features/history/History';
import { RehabDashboard } from './features/rehab/RehabDashboard';

import { ErrorBoundary } from "./components/layout/ErrorBoundary";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/history" element={<History />} />
          <Route path="/rehab" element={<RehabDashboard />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
