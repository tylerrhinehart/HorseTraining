import { NavLink } from "react-router-dom";
import { useActiveHorse } from "../db/queries";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const navItem = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white",
  ].join(" ");

export default function AppShell({ children }: Props) {
  const activeHorse = useActiveHorse();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 mr-4">
            <span
              aria-hidden
              className="inline-block h-8 w-8 rounded-lg bg-brand-600"
            />
            <span className="font-semibold tracking-tight">
              Horse Training Tracker
            </span>
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navItem}>
              Dashboard
            </NavLink>
            <NavLink to="/horses" className={navItem}>
              Horses
            </NavLink>
            <NavLink to="/questions" className={navItem}>
              Questions
            </NavLink>
            <NavLink to="/settings" className={navItem}>
              Settings
            </NavLink>
          </nav>
          <div className="ml-auto text-sm text-slate-400">
            {activeHorse ? (
              <span>
                Active horse:{" "}
                <span className="text-slate-100 font-medium">
                  {activeHorse.name}
                </span>
              </span>
            ) : (
              <span>No active horse</span>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
      <footer className="border-t border-slate-800 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between">
          <span>Local-first PWA. Your data stays on this device.</span>
          <span>v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
