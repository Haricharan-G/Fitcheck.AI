import { Link, useLocation } from "react-router-dom";
import { Activity, Clock, LayoutDashboard, Bell, User } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/rehab", label: "Clinical Rehab", icon: Activity },
];

export function Navbar() {
  const location = useLocation();
  const { scrollY } = useScroll();
  const background = useTransform(
    scrollY,
    [0, 80],
    ["rgba(5, 5, 5, 0)", "rgba(5, 5, 5, 0.85)"]
  );
  const backdropBlur = useTransform(
    scrollY,
    [0, 80],
    ["blur(0px)", "blur(20px)"]
  );
  const borderOpacity = useTransform(
    scrollY,
    [0, 80],
    [0, 0.08]
  );

  const borderBottom = useTransform(borderOpacity, v => `1px solid rgba(255, 255, 255, ${v})`);

  // Don't show full navbar on immersive pages
  const isImmersive = location.pathname === "/tracker" || location.pathname === "/rehab";

  if (isImmersive) return null;

  return (
    <motion.nav 
      style={{ 
        background, 
        backdropFilter: backdropBlur, 
        borderBottom
      }}
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
    >
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 group-hover:shadow-cyan-500/30 transition-all duration-300">
            <Activity color="white" size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              FormCheck<span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-semibold tracking-[0.2em] uppercase leading-tight">
              Neural Engine v3.0
            </p>
          </div>
        </Link>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full px-1.5 py-1.5">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? "text-white" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-white/[0.08] border border-white/[0.1] rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={16} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link 
            to="/history"
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
              location.pathname === "/history"
                ? "bg-white/[0.08] border-white/[0.1] text-white"
                : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <Clock size={16} />
            <span className="text-sm font-semibold">History</span>
          </Link>
          
          <button className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-300">
            <Bell size={18} />
          </button>
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition-all duration-300">
            <User size={18} />
          </button>
        </div>

      </div>
    </motion.nav>
  );
}
