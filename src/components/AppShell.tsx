import { useEffect, useMemo, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useActiveHorseId } from "../state/activeHorse";
import { listEngagementsForHorse, listHorses } from "../supabase/queries";
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
    () => (user ? listHorses(false) : Promise.resolve([])),
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

  const engagements = useQuery(
    () =>
      activeHorse ? listEngagementsForHorse(activeHorse.id) : Promise.resolve([]),
    [activeHorse?.id],
  );

  // Most recent engagement drives the Report tab — main stores reports per
  // engagement, not per horse, so we link to the latest one if any.
  const latestEngagementId = useMemo(() => {
    if (!engagements.data || engagements.data.length === 0) return null;
    return [...engagements.data].sort((a, b) => {
      const ad = a.arrival_date ?? a.created_at;
      const bd = b.arrival_date ?? b.created_at;
      return bd.localeCompare(ad);
    })[0].id;
  }, [engagements.data]);

  const onAuthRoute = AUTH_PATHS.has(location.pathname);

  const todayTo = "/";
  const horsesTo = "/horses";
  const progressTo = activeHorse ? `/horses/${activeHorse.id}` : "/horses";
  const reportTo = latestEngagementId
    ? `/engagements/${latestEngagementId}/report`
    : activeHorse
      ? `/horses/${activeHorse.id}`
      : "/horses";

  const path = location.pathname;
  const isToday = path === "/";
  const isHorses =
    path === "/horses" || path === "/horses/new";
  const isProgress = activeHorse
    ? path === `/horses/${activeHorse.id}`
    : false;
  const isReport = path.endsWith("/report");

  return (
    <div className="app-root">
      {!onAuthRoute && (
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand-mark">T</span>
            <div>
              <div className="brand-name">TQA Tracker</div>
              <div className="brand-sub">Industry standard · 5 phases</div>
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
                    <span className="topbar-horse-eyebrow">Now training</span>
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
            to={progressTo}
            className={() => (isProgress ? "is-active" : "")}
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
                <path d="M3 17l5-6 4 4 7-9" />
                <path d="M14 6h6v6" />
              </svg>
            </span>
            Progress
          </NavLink>
          <NavLink
            to={reportTo}
            className={() => (isReport ? "is-active" : "")}
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
                <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                <path d="M14 3v6h6M9 13h6M9 17h6" />
              </svg>
            </span>
            Report
          </NavLink>
        </nav>
      )}
    </div>
  );
}
