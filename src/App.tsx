import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import HorsesList from "./pages/HorsesList";
import HorseNew from "./pages/HorseNew";
import HorseDetail from "./pages/HorseDetail";
import Evaluate from "./pages/Evaluate";
import Questions from "./pages/Questions";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import UpdatePrompt from "./components/UpdatePrompt";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/horses" element={<HorsesList />} />
        <Route path="/horses/new" element={<HorseNew />} />
        <Route path="/horses/:id" element={<HorseDetail />} />
        <Route path="/horses/:id/report" element={<Report />} />
        <Route path="/evaluate/:horseId" element={<Evaluate />} />
        <Route path="/evaluate/:horseId/:date" element={<Evaluate />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UpdatePrompt />
    </AppShell>
  );
}
