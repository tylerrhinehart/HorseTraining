import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./auth/RequireAuth";
import Dashboard from "./pages/Dashboard";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
import HorseDetail from "./pages/HorseDetail";
import NewTQA from "./pages/NewTQA";
import TQADetail from "./pages/TQADetail";
import PhasesList from "./pages/PhasesList";
import PhaseDetail from "./pages/PhaseDetail";
import Resources from "./pages/Resources";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import UpdatePrompt from "./components/UpdatePrompt";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/horses"
          element={
            <RequireAuth>
              <HorsesList />
            </RequireAuth>
          }
        />
        <Route
          path="/horses/new"
          element={
            <RequireAuth>
              <HorseNew />
            </RequireAuth>
          }
        />
        <Route
          path="/horses/:id"
          element={
            <RequireAuth>
              <HorseDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/horses/:id/report"
          element={
            <RequireAuth>
              <Report />
            </RequireAuth>
          }
        />
        <Route
          path="/horses/:horseId/tqa/new"
          element={
            <RequireAuth>
              <NewTQA />
            </RequireAuth>
          }
        />
        <Route
          path="/tqa/:id"
          element={
            <RequireAuth>
              <TQADetail />
            </RequireAuth>
          }
        />
        <Route
          path="/phases"
          element={
            <RequireAuth>
              <PhasesList />
            </RequireAuth>
          }
        />
        <Route
          path="/phases/:id"
          element={
            <RequireAuth>
              <PhaseDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/resources"
          element={
            <RequireAuth>
              <Resources />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdatePrompt />
    </AppShell>
  );
}
