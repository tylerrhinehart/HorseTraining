import React, { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { FacilityProvider, RequireFacility, useFacility } from "./auth/FacilityProvider";
import { useAuth } from "./auth/AuthProvider";
import { pendingInvite } from "./facilities/pendingInvite";
import Facilities from "./pages/Facilities";
import FacilitySettings from "./pages/FacilitySettings";
import PlatformAdmin from "./pages/PlatformAdmin";
import AppShell from "./components/AppShell";
import RequireAuth from "./auth/RequireAuth";
import Today from "./pages/Today";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
import HorseWorkflowLayout from "./components/HorseWorkflowLayout";
import HorseDetail from "./pages/HorseDetail";
import SessionNew from "./pages/SessionNew";
import SessionDetail from "./pages/SessionDetail";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import HorseFinish from "./pages/HorseFinish";
import UpdatePrompt from "./components/UpdatePrompt";
import { ToastProvider } from "./components/Toast";
import { SkeletonCard } from "./components/Skeleton";

const Reference = React.lazy(() => import("./pages/Reference"));
const HorseReport = React.lazy(() => import("./pages/HorseReport"));

const guarded = (element: React.ReactNode) => <RequireAuth><RequireFacility>{element}</RequireFacility></RequireAuth>;

function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navType]);
  return null;
}

export default function App() {
  return <FacilityProvider><ScopedApp /></FacilityProvider>;
}

function ScopedApp() {
  const { facility } = useFacility();
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user && ["/", "/sign-up", "/sign-in"].includes(pathname) && pendingInvite()) return <Navigate replace to="/facilities" />;
  return <AppContents key={`${user?.id ?? "guest"}:${facility?.id ?? "none"}`} />;
}

function AppContents() {
  return (
    <ToastProvider>
      <AppShell>
        <ScrollToTop />
        <Suspense
          fallback={
            <div className="view">
              <SkeletonCard lines={4} />
            </div>
          }
        >
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />

            <Route path="/facilities" element={<RequireAuth><Facilities /></RequireAuth>} />
            <Route path="/facility-settings" element={guarded(<FacilitySettings />)} />
            <Route path="/platform" element={<RequireAuth><PlatformAdmin /></RequireAuth>} />
            <Route path="/" element={guarded(<Today />)} />
            <Route path="/horses" element={guarded(<HorsesList />)} />
            <Route path="/horses/new" element={guarded(<HorseNew />)} />
            <Route path="/horses/:id" element={guarded(<HorseWorkflowLayout><HorseDetail /></HorseWorkflowLayout>)} />
            <Route path="/horses/:id/sessions/new" element={guarded(<HorseWorkflowLayout><SessionNew /></HorseWorkflowLayout>)} />
            <Route path="/horses/:id/finish" element={guarded(<HorseFinish />)} />
            <Route path="/horses/:id/report" element={guarded(<HorseReport />)} />
            <Route path="/sessions/:id" element={guarded(<SessionDetail />)} />
            <Route path="/reference" element={guarded(<Reference />)} />
            <Route path="/settings" element={guarded(<Settings />)} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <UpdatePrompt />
      </AppShell>
    </ToastProvider>
  );
}
