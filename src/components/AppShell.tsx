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
const UX_VARIANT = {
  title: "Stable Kanban Board",
  short: "Phase-based kanban board that organizes horses by training stage instead of a normal list.",
  className: "ux-stable-kanban",
  nav: "board",
};

export default function AppShell({ children }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [activeId, setActiveId] = useActiveHorseId();

  const horses = useQuery(
    () => (user ? listHorses({ statuses: ["in_training"] }) : Promise.resolve([])),
    [user?.id],
  );

  useEffect(() => {
    if (!horses.data) return;
    if (activeId && horses.data.some((h) => h.id === activeId)) return;
    if (horses.data.length > 0) setActiveId(horses.data[0].id);
  }, [horses.data, activeId, setActiveId]);

  useEffect(() => {
    if (!activeId) return;
    if (horses.loading) return;
    if (!horses.data) return;
    if (horses.data.some((h) => h.id === activeId)) return;
    horses.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const activeHorse = useMemo(
    () => horses.data?.find((h) => h.id === activeId) ?? null,
    [horses.data, activeId],
  );

  const onAuthRoute = AUTH_PATHS.has(location.pathname);
  const path = location.pathname;
  const isToday = path === "/";
  const isHorses = path === "/horses" || path === "/horses/new";
  const isReference = path.startsWith("/reference") || path.startsWith("/resources") || path.startsWith("/foundation") || path.startsWith("/phases");

  const navItems = [
    { to: "/", label: "Today", active: isToday, icon: "◉" },
    { to: "/horses", label: "Horses", active: isHorses, icon: "♞" },
    { to: "/reference", label: "Reference", active: isReference, icon: "◇" },
  ];

  return (
    <div className={`app-root app-root-variant ${UX_VARIANT.className}`} data-ux-variant={UX_VARIANT.className}>
      {!onAuthRoute && (
        <>
          <header className="variant-shellbar">
            <NavLink to="/" className="variant-brand">
              <span className="variant-brand-mark">TQA</span>
              <span>
                <strong>{UX_VARIANT.title}</strong>
                <em>{UX_VARIANT.short}</em>
              </span>
            </NavLink>
            {user && activeHorse && (
              <NavLink to={`/horses/${activeHorse.id}`} className="variant-active-horse">
                <span>
                  <small>Active horse</small>
                  <strong>{activeHorse.name}</strong>
                </span>
                <HorseAvatar name={activeHorse.name} tone={hashTone(activeHorse.name)} />
              </NavLink>
            )}
            {user && (
              <NavLink to="/settings" className="variant-settings" aria-label="Settings">
                Settings
              </NavLink>
            )}
          </header>
          {user && UX_VARIANT.nav !== "mobile" && (
            <aside className="variant-nav-panel" aria-label="Primary navigation">
              <div className="variant-nav-label">Workspace</div>
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={item.active ? "is-active" : ""}>
                  <span className="variant-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </aside>
          )}
        </>
      )}

      <main className="variant-main">{children}</main>

      {user && !onAuthRoute && UX_VARIANT.nav === "mobile" && (
        <nav className="variant-mobile-tabs" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={item.active ? "is-active" : ""}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
