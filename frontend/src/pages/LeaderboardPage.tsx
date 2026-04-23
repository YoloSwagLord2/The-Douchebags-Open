import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LeaderboardEntry, LeaderboardResponse, NavigationTournament } from "../lib/types";
import { LeaderboardTable } from "../components/LeaderboardTable";

function FeaturedLeader({ entry }: { entry?: LeaderboardEntry }) {
  if (!entry) return null;
  return (
    <section className="featured-leader">
      <div className="featured-leader__media">
        {entry.feature_photo_url ? (
          <img alt={entry.player_name} src={entry.feature_photo_url} />
        ) : (
          <div className="featured-leader__placeholder">{entry.player_name.slice(0, 1)}</div>
        )}
      </div>
      <div className="featured-leader__copy">
        <p className="eyebrow">Current number one</p>
        <h2>{entry.player_name}</h2>
        <div className="featured-leader__stats">
          <span>Official {entry.official_stableford}</span>
          <span>Bonus {entry.bonus_adjusted_stableford}</span>
          <span>Net {entry.net_strokes}</span>
        </div>
      </div>
    </section>
  );
}

export function LeaderboardPage({ scope }: { scope: "round" | "tournament" }) {
  const { token } = useAuth();
  const params = useParams();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [mode, setMode] = useState<"official" | "bonus">("official");
  const outlet = useOutletContext<{ navigation: NavigationTournament[] }>();

  useEffect(() => {
    if (!token) return;
    const id = scope === "round" ? params.id ?? params.roundId : params.id ?? params.tournamentId;
    if (!id) return;
    const call = scope === "round" ? api.roundLeaderboard(id, token) : api.tournamentLeaderboard(id, token);
    call.then(setData).catch(() => undefined);
  }, [params.id, params.roundId, params.tournamentId, scope, token]);

  const entries = mode === "official" ? data?.official_entries ?? [] : data?.bonus_entries ?? [];
  const leader = useMemo(() => entries[0], [entries]);
  const navTournament = outlet.navigation.find((item) => item.id === data?.tournament.id);

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{scope === "round" ? "Round leaderboard" : "Tournament leaderboard"}</p>
          <h2>{data?.tournament.name ?? "Loading leaderboard"}</h2>
          <p className="hero-subtitle">
            {scope === "round"
              ? `Round ${data?.round?.round_number ?? "—"} at ${navTournament?.rounds.find((item) => item.id === data?.round?.id)?.course_name ?? data?.round?.round_number ?? ""}`
              : "Official board plus bonus-adjusted standings with secret side-game impact."}
          </p>
        </div>
        <div className="segmented-control">
          <button className={mode === "official" ? "is-active" : ""} onClick={() => setMode("official")} type="button">
            Official
          </button>
          <button className={mode === "bonus" ? "is-active" : ""} onClick={() => setMode("bonus")} type="button">
            Bonus
          </button>
        </div>
      </section>
      <FeaturedLeader entry={leader} />
      <LeaderboardTable entries={entries} mode={mode} />
    </div>
  );
}

