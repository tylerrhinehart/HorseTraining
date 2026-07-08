import React, { Suspense, useEffect } from "react";
import { Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./auth/RequireAuth";
import Today from "./pages/Today";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
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

const guarded = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>;

function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navType]);
  return null;
}

export default function App() {
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

            <Route path="/" element={guarded(<Today />)} />
            <Route path="/horses" element={guarded(<HorsesList />)} />
            <Route path="/horses/new" element={guarded(<HorseNew />)} />
            <Route path="/horses/:id" element={guarded(<HorseDetail />)} />
            <Route path="/horses/:id/sessions/new" element={guarded(<SessionNew />)} />
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
