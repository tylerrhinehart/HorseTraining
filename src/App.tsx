import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./auth/RequireAuth";
import Dashboard from "./pages/Dashboard";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
import HorseDetail from "./pages/HorseDetail";
import EngagementNew from "./pages/EngagementNew";
import EngagementDetail from "./pages/EngagementDetail";
import SessionNew from "./pages/SessionNew";
import SessionDetail from "./pages/SessionDetail";
import Riders from "./pages/Riders";
import PhasesList from "./pages/PhasesList";
import PhaseDetail from "./pages/PhaseDetail";
import Resources from "./pages/Resources";
import FoundationDoctrine from "./pages/FoundationDoctrine";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import UpdatePrompt from "./components/UpdatePrompt";

const guarded = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>;

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

        <Route path="/" element={guarded(<Dashboard />)} />
        <Route path="/horses" element={guarded(<HorsesList />)} />
        <Route path="/horses/new" element={guarded(<HorseNew />)} />
        <Route path="/horses/:id" element={guarded(<HorseDetail />)} />
        <Route
          path="/horses/:id/engagements/new"
          element={guarded(<EngagementNew />)}
        />

        <Route path="/engagements/:id" element={guarded(<EngagementDetail />)} />
        <Route path="/engagements/:id/report" element={guarded(<Report />)} />
        <Route
          path="/horses/:id/sessions/new"
          element={guarded(<SessionNew />)}
        />
        <Route
          path="/engagements/:id/weeks/:weekId/sessions/new"
          element={guarded(<SessionNew />)}
        />

        <Route path="/sessions/:id" element={guarded(<SessionDetail />)} />

        <Route path="/riders" element={guarded(<Riders />)} />
        <Route path="/phases" element={guarded(<PhasesList />)} />
        <Route path="/phases/:id" element={guarded(<PhaseDetail />)} />
        <Route path="/foundation" element={guarded(<FoundationDoctrine />)} />
        <Route path="/resources" element={guarded(<Resources />)} />
        <Route path="/settings" element={guarded(<Settings />)} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdatePrompt />
    </AppShell>
  );
}
