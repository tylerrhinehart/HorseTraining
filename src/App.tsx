import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./auth/RequireAuth";
import Today from "./pages/Today";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
import HorseDetail from "./pages/HorseDetail";
import SessionNew from "./pages/SessionNew";
import SessionDetail from "./pages/SessionDetail";
import Reference from "./pages/Reference";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import HorseFinish from "./pages/HorseFinish";
import HorseReport from "./pages/HorseReport";
import UpdatePrompt from "./components/UpdatePrompt";

const guarded = (element: React.ReactNode) => <RequireAuth>{element}</RequireAuth>;

export default function App() {
  return (
    <AppShell>
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
      <UpdatePrompt />
    </AppShell>
  );
}
