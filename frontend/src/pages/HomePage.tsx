import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function HomePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token) return;
    api.navigation(token).then((items) => {
      if (user?.role === "admin") {
        navigate("/admin/players", { replace: true });
        return;
      }
      const latestTournament = items[0];
      const latestRound = latestTournament?.rounds[0];
      if (latestRound) {
        navigate(`/round/${latestRound.id}/entry`, { replace: true });
      } else if (latestTournament) {
        navigate(`/leaderboard/tournament/${latestTournament.id}`, { replace: true });
      } else {
        navigate("/notifications", { replace: true });
      }
    });
  }, [navigate, token, user?.role]);

  return <div className="loading-state">Loading your tournament deck…</div>;
}

