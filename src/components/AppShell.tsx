import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation, useMatch } from "react-router-dom";
import { useFacility } from "../auth/FacilityProvider";
import { useAuth } from "../auth/AuthProvider";
import { useActiveHorseId } from "../state/activeHorse";
import { getHorse, getSession, listInTrainingHorses, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { prefetchQuery } from "../supabase/cache";
import { qk } from "../supabase/keys";
import HorseAvatar, { hashTone } from "./HorseAvatar";

interface Props {
  children: ReactNode;
}

const AUTH_PATHS = new Set(["/sign-in", "/sign-up"]);

export default function AppShell({ children }: Props) {
  const { user } = useAuth();
  const { facility } = useFacility();
  const location = useLocation();
  const [activeId, setActiveId] = useActiveHorseId();
  const match = useMatch("/horses/:id/*");
  const rideId = useMatch("/sessions/:id")?.params.id;
  const ride = useQuery(rideId ? qk.session(rideId) : null, () => getSession(rideId!));
  const routeId = rideId ? ride.data?.horse_id : match?.params.id === "new" ? undefined : match?.params.id;

  const horses = useQuery(facility ? qk.horses("in_training") : null, listInTrainingHorses);
  const selectedId = routeId ?? (rideId ? undefined : activeId);
  const rosterHorse = horses.data?.find(horse => horse.id === selectedId);
  const routeHorse = useQuery(routeId && !rosterHorse ? qk.horse(routeId) : null, () => getHorse(routeId!));
  const activeHorse = rosterHorse ?? routeHorse.data;

  // Prime the cache so first navigations paint instantly.
  useEffect(() => {
    if (!user || !facility) return;
    prefetchQuery(qk.horses("in_training"), listInTrainingHorses);
    prefetchQuery(qk.phases(), listPhases);
  }, [user, facility?.id]);

  useEffect(() => {
    if (routeId) {
      if (activeHorse && activeId !== routeId) setActiveId(routeId);
      return;
    }
    if (rideId || !horses.data) return;
    if (activeId && horses.data.some((h) => h.id === activeId)) return;
    if (horses.data.length > 0) setActiveId(horses.data[0].id);
  }, [routeId, rideId, activeHorse, horses.data, activeId, setActiveId]);

  const onAuthRoute = AUTH_PATHS.has(location.pathname);

  const todayTo = "/";
  const horsesTo = "/horses";
  const referenceTo = "/reference";

  const path = location.pathname;
  const isToday = path === "/";
  const isHorses = path.startsWith("/horses") || path.startsWith("/sessions");
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
              <NavLink to="/facilities" className="btn btn-ghost">{facility?.name ?? "Choose facility"}</NavLink>
              {activeHorse && (
                <NavLink
                  to={`/horses/${activeHorse.id}`}
                  className="topbar-horse"
                >
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span className="topbar-horse-eyebrow">Selected horse</span>
                    <strong className="topbar-horse-name" title={activeHorse.name}>
                      {activeHorse.name}
                    </strong>
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
