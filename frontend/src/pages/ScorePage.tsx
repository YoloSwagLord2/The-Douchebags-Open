import { Navigate, useOutletContext } from "react-router-dom";
import type { NavigationTournament } from "../lib/types";

export function ScorePage() {
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();

  const latestRound = navigation[0]?.rounds[0];

  if (latestRound) {
    return <Navigate replace to={`/round/${latestRound.id}/entry`} />;
  }

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">Score entry</p>
          <h2>No active round</h2>
          <p className="hero-subtitle">
            You haven't been added to a tournament yet. Ask your tournament admin to add you to the roster.
          </p>
        </div>
      </section>
    </div>
  );
}
