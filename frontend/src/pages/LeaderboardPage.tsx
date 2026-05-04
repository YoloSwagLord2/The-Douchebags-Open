import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { t } from "../lib/i18n";
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  NavigationTournament,
  TournamentOverviewResponse,
} from "../lib/types";
import { LeaderboardTable } from "../components/LeaderboardTable";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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
        <p className="eyebrow">{t('leaderboard.currentNumber1')}</p>
        <h2>{entry.player_name}</h2>
        <div className="featured-leader__stats">
          <span>{t('leaderboard.gross')} {entry.gross_strokes}</span>
          <span>{t('leaderboard.net')} {entry.net_strokes}</span>
          <span>{t('leaderboard.official')} {entry.official_stableford}</span>
          <span>{t('leaderboard.bonus')} {entry.bonus_points}</span>
        </div>
      </div>
    </section>
  );
}

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

function RoundMatrix({ overview, mode }: { overview: TournamentOverviewResponse; mode: "official" | "bonus" }) {
  const title = `${t('nav.board')} — ${mode === "official" ? "Stableford" : "Bonus"}`;
  if (overview.rounds.length === 0) {
    return (
      <section className="detail-panel">
        <p className="eyebrow">{title}</p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted, #8899aa)" }}>
          {t('leaderboard.noRoundsYet')}
        </p>
      </section>
    );
  }
  if (overview.entries.length === 0) {
    return (
      <section className="detail-panel">
        <p className="eyebrow">{title}</p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted, #8899aa)" }}>
          {t('leaderboard.noPlayersYet')}
        </p>
      </section>
    );
  }
  return (
    <section className="detail-panel round-matrix">
      <p className="eyebrow">{title}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="round-matrix__table">
          <thead>
            <tr>
              <th className="round-matrix__player-col">{t('leaderboard.player')}</th>
              {overview.rounds.map((r) => (
                <th key={r.id}>{displayRoundName(r)}<br /><small>{r.course_name}</small></th>
              ))}
              <th>{t('leaderboard.total')}</th>
            </tr>
          </thead>
          <tbody>
            {overview.entries.map((entry) => (
              <tr key={entry.player_id}>
                <td className="round-matrix__player-col">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {entry.avatar_url ? (
                      <img
                        alt={entry.player_name}
                        className="leaderboard-avatar"
                        src={entry.avatar_url}
                        style={{ width: 28, height: 28 }}
                      />
                    ) : (
                      <div className="leaderboard-avatar leaderboard-avatar--fallback" style={{ width: 28, height: 28, fontSize: "0.65rem" }}>
                        {initials(entry.player_name)}
                      </div>
                    )}
                    <span>{entry.player_name}</span>
                  </div>
                </td>
                {entry.round_results.map((result) => (
                  <td key={result.round_id} style={{ textAlign: "center" }}>
                    {result.holes_played === 0 ? (
                      <span style={{ color: "var(--text-muted, #8899aa)" }}>—</span>
                    ) : (
                      <strong>{result.stableford}</strong>
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "center" }}>
                  <strong>{entry.total_stableford}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LeaderboardPage({ scope }: { scope: "round" | "tournament" }) {
  const { token } = useAuth();
  const params = useParams();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [overview, setOverview] = useState<TournamentOverviewResponse | null>(null);
  const [mode, setMode] = useState<"official" | "bonus">("official");
  const outlet = useOutletContext<{ navigation: NavigationTournament[] }>();

  const currentId = scope === "round"
    ? (params.id ?? params.roundId)
    : (params.id ?? params.tournamentId);

  useEffect(() => {
    if (!token || !currentId) return;
    setData(null);
    if (scope === "round") {
      api.roundLeaderboard(currentId, token).then(setData).catch(() => undefined);
    } else {
      setOverview(null);
      api.tournamentLeaderboard(currentId, token).then(setData).catch(() => undefined);
      api.tournamentOverview(currentId, token).then(setOverview).catch(() => undefined);
    }
  }, [currentId, scope, token]);

  const entries = mode === "official" ? data?.official_entries ?? [] : data?.bonus_entries ?? [];
  const leader = useMemo(() => entries[0], [entries]);

  // Use nav data immediately so the title never shows "Loading…" when nav is already available
  const navTournament = outlet.navigation.find(
    (item) => item.id === currentId || item.id === data?.tournament.id || item.rounds.some((round) => round.id === currentId),
  );
  const tournamentName = overview?.tournament_name
    ?? data?.tournament.name
    ?? navTournament?.name
    ?? "Loading…";
  const navRound = navTournament?.rounds.find((item) => item.id === (data?.round?.id ?? currentId));
  const currentRound = data?.round ?? navRound;

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{scope === "round" ? t('leaderboard.roundLeaderboard') : t('leaderboard.tournamentLeaderboard')}</p>
          <h2>{tournamentName}</h2>
          {scope === "round" && (
            <p className="hero-subtitle">
              {currentRound ? displayRoundName(currentRound) : "Round —"} at {navRound?.course_name ?? ""}
            </p>
          )}
        </div>
        <div className="segmented-control">
          <button className={mode === "official" ? "is-active" : ""} onClick={() => setMode("official")} type="button">
            Stableford
          </button>
          <button className={mode === "bonus" ? "is-active" : ""} onClick={() => setMode("bonus")} type="button">
            Bonus
          </button>
        </div>
      </section>

      {scope === "tournament" ? (
        <>
          {overview ? (
            <RoundMatrix overview={overview} mode={mode} />
          ) : (
            <section className="detail-panel">
              <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>{t('leaderboard.loading')}</p>
            </section>
          )}
          {entries.length > 0 && (
            <>
              <FeaturedLeader entry={leader} />
              <LeaderboardTable entries={entries} mode={mode} />
            </>
          )}
        </>
      ) : (
        <>
          <FeaturedLeader entry={leader} />
          <LeaderboardTable entries={entries} mode={mode} />
        </>
      )}
    </div>
  );
}
