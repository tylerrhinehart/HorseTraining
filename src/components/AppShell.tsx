import { useEffect, useMemo, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useActiveHorseId } from "../state/activeHorse";
import { listHorses } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import HorseAvatar, { hashTone } from "./HorseAvatar";

interface Props {
  children: ReactNode;
}

const AUTH_PATHS = new Set(["/sign-in", "/sign-up"]);

export default function AppShell({ children }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [activeId, setActiveId] = useActiveHorseId();

  const horses = useQuery(
    () => (user ? listHorses({ statuses: ['in_training'] }) : Promise.resolve([])),
    [user?.id],
  );

  useEffect(() => {
    if (!horses.data) return;
    if (activeId && horses.data.some((h) => h.id === activeId)) return;
    if (horses.data.length > 0) setActiveId(horses.data[0].id);
  }, [horses.data, activeId, setActiveId]);

  const activeHorse = useMemo(
    () => horses.data?.find((h) => h.id === activeId) ?? null,
    [horses.data, activeId],
  );

  const onAuthRoute = AUTH_PATHS.has(location.pathname);

  const todayTo = "/";
  const horsesTo = "/horses";
  const referenceTo = "/reference";

  const path = location.pathname;
  const isToday = path === "/";
  const isHorses = path === "/horses" || path === "/horses/new";
  const isReference =
    path.startsWith("/phases") ||
    path.startsWith("/reference") ||
    path.startsWith("/resources") ||
    path.startsWith("/foundation");

  return (
    <div className="app-root">
      {!onAuthRoute && (
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand-mark">T</span>
            <div>
              <div className="brand-name">TQA Tracker</div>
              <div className="brand-sub">Training quality assurance</div>
            </div>
          </NavLink>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {activeHorse && (
                <NavLink
                  to={`/horses/${activeHorse.id}`}
                  className="topbar-horse"
                >
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span className="topbar-horse-eyebrow">Today</span>
                    <strong>{activeHorse.name}</strong>
                  </span>
                  <HorseAvatar
                    name={activeHorse.name}
                    tone={hashTone(activeHorse.name)}
                  />
                </NavLink>
              )}
              <NavLink
                to="/settings"
                aria-label="Settings"
                className="btn btn-ghost"
                style={{ padding: 6 }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
              </NavLink>
            </div>
          )}
        </header>
      )}

      <main className="flex-1">{children}</main>

      {user && !onAuthRoute && (
        <nav className="tabbar" aria-label="Primary">
          <NavLink
            to={todayTo}
            end
            className={() => (isToday ? "is-active" : "")}
          >
            <span className="tab-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </span>
            Today
          </NavLink>
          <NavLink
            to={horsesTo}
            className={() => (isHorses ? "is-active" : "")}
          >
            <span className="tab-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
              </svg>
            </span>
            Horses
          </NavLink>
          <NavLink
            to={referenceTo}
            className={() => (isReference ? "is-active" : "")}
          >
            <span className="tab-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
              </svg>
            </span>
            Reference
          </NavLink>
        </nav>
      )}
    </div>
  );
}
