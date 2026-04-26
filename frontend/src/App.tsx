import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./lib/auth";
import { AchievementsPage } from "./pages/AchievementsPage";
import { AdminAchievementRulesPage } from "./pages/AdminAchievementRulesPage";
import { AdminBonusRulesPage } from "./pages/AdminBonusRulesPage";
import { AdminCoursesPage } from "./pages/AdminCoursesPage";
import { AdminNotificationsPage } from "./pages/AdminNotificationsPage";
import { AdminPlayersPage } from "./pages/AdminPlayersPage";
import { AdminRoundsPage } from "./pages/AdminRoundsPage";
import { AdminTournamentsPage } from "./pages/AdminTournamentsPage";
import { BonusAnimationDemoPage } from "./pages/BonusAnimationDemoPage";
import { BonusesPage } from "./pages/BonusesPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardIndexPage } from "./pages/LeaderboardIndexPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RoundEntryPage } from "./pages/RoundEntryPage";
import { ScorePage } from "./pages/ScorePage";

function RequireAuth({ children }: { children: ReactElement }) {
  const { ready, token } = useAuth();
  if (!ready) return <div className="loading-state">Loading session…</div>;
  if (!token) return <Navigate replace to="/login" />;
  return children;
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate replace to="/" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bonus-demo" element={<BonusAnimationDemoPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="leaderboard" element={<LeaderboardIndexPage />} />
        <Route path="leaderboard/tournament/:tournamentId" element={<LeaderboardPage scope="tournament" />} />
        <Route path="leaderboard/round/:roundId" element={<LeaderboardPage scope="round" />} />
        <Route path="score" element={<ScorePage />} />
        <Route path="round/:roundId/entry" element={<RoundEntryPage />} />
        <Route path="me/bonuses" element={<BonusesPage />} />
        <Route path="me/achievements" element={<AchievementsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="admin/players"
          element={
            <RequireAdmin>
              <AdminPlayersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/courses"
          element={
            <RequireAdmin>
              <AdminCoursesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/tournaments"
          element={
            <RequireAdmin>
              <AdminTournamentsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/rounds"
          element={
            <RequireAdmin>
              <AdminRoundsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/bonus-rules"
          element={
            <RequireAdmin>
              <AdminBonusRulesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/achievement-rules"
          element={
            <RequireAdmin>
              <AdminAchievementRulesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/notifications"
          element={
            <RequireAdmin>
              <AdminNotificationsPage />
            </RequireAdmin>
          }
        />
      </Route>
    </Routes>
  );
}
