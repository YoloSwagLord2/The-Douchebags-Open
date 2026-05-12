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
import { PlayerCardModal } from "../components/PlayerCardModal";
import { ScorecardModal } from "../components/ScorecardModal";
import { RoundProgressChart } from "../components/RoundProgressChart";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FeaturedLeader({ entry, onPlayerClick }: { entry?: LeaderboardEntry; onPlayerClick: (id: string) => void }) {
  if (!entry) return null;
  return (
    <section className="featured-leader">
      <div className="featured-leader__media">
        {entry.feature_photo_url ? (
          <img alt={entry.player_name} src={entry.feature_photo_url} onClick={() => onPlayerClick(entry.player_id)} style={{ cursor: "pointer" }} />
        ) : (
          <div className="featured-leader__placeholder" onClick={() => onPlayerClick(entry.player_id)} style={{ cursor: "pointer" }}>{entry.player_name.slice(0, 1)}</div>
        )}
      </div>
      <div className="featured-leader__copy">
        <p className="eyebrow">{t('leaderboard.currentNumber1')}</p>
        <h2>{entry.player_name}</h2>
        <div className="featured-leader__stats">
          <div className="featured-leader__stat"><span className="featured-leader__stat-label">{t('leaderboard.gross')}</span><span className="featured-leader__stat-value">{entry.gross_strokes}</span></div>
          <div className="featured-leader__stat"><span className="featured-leader__stat-label">{t('leaderboard.net')}</span><span className="featured-leader__stat-value">{entry.net_strokes}</span></div>
          <div className="featured-leader__stat"><span className="featured-leader__stat-label">{t('score.stb')}</span><span className="featured-leader__stat-value">{entry.official_stableford}</span></div>
          <div className="featured-leader__stat"><span className="featured-leader__stat-label">{t('leaderboard.bonus')}</span><span className="featured-leader__stat-value">{entry.bonus_points}</span></div>
        </div>
      </div>
    </section>
  );
}

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

function RoundMatrix({ overview, mode, onPlayerClick }: { overview: TournamentOverviewResponse; mode: "official" | "bonus"; onPlayerClick: (id: string) => void }) {
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
                      <img alt={entry.player_name} className="leaderboard-avatar" src={entry.avatar_url} style={{ width: 28, height: 28, cursor: "pointer" }} onClick={() => onPlayerClick(entry.player_id)} />
                    ) : (
                      <div className="leaderboard-avatar leaderboard-avatar--fallback" style={{ width: 28, height: 28, fontSize: "0.65rem", cursor: "pointer" }} onClick={() => onPlayerClick(entry.player_id)}>
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
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [scorecardPlayerId, setScorecardPlayerId] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
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
      <PlayerCardModal playerId={activePlayerId} onClose={() => setActivePlayerId(null)} />
      <ScorecardModal
        roundId={scope === "round" ? (data?.round?.id ?? currentId ?? null) : null}
        playerId={scorecardPlayerId}
        onClose={() => setScorecardPlayerId(null)}
      />
      {chartOpen && token && (
        scope === "round" && (data?.round?.id || currentId) ? (
          <RoundProgressChart
            roundId={(data?.round?.id ?? currentId)!}
            token={token}
            entries={entries}
            onClose={() => setChartOpen(false)}
          />
        ) : scope === "tournament" && overview && overview.rounds.length > 0 ? (
          <RoundProgressChart
            rounds={overview.rounds.map((r) => ({
              id: r.id,
              label: (r.name?.trim() || `Round ${r.round_number}`) + ` · ${r.course_name}`,
            }))}
            token={token}
            entries={entries}
            onClose={() => setChartOpen(false)}
          />
        ) : null
      )}
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
        <div className="leaderboard-masthead-controls">
          <div className="segmented-control">
            <button className={mode === "official" ? "is-active" : ""} onClick={() => setMode("official")} type="button">
              Stableford
            </button>
            <button className={mode === "bonus" ? "is-active" : ""} onClick={() => setMode("bonus")} type="button">
              Bonus
            </button>
          </div>
          {entries.length > 0 && (scope === "round" || (overview && overview.rounds.length > 0)) && (
            <button
              type="button"
              className="button-secondary icon-button progress-chart-trigger"
              aria-label="Show STB progression chart"
              title="STB progression"
              onClick={() => setChartOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="14 7 21 7 21 14" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {scope === "tournament" ? (
        <>
          {overview ? (
            <RoundMatrix overview={overview} mode={mode} onPlayerClick={setActivePlayerId} />
          ) : (
            <section className="detail-panel">
              <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>{t('leaderboard.loading')}</p>
            </section>
          )}
          {entries.length > 0 && (
            <>
              <FeaturedLeader entry={leader} onPlayerClick={setActivePlayerId} />
              <LeaderboardTable entries={entries} mode={mode} onPlayerClick={setActivePlayerId} />
            </>
          )}
        </>
      ) : (
        <>
          <FeaturedLeader entry={leader} onPlayerClick={setActivePlayerId} />
          <LeaderboardTable entries={entries} mode={mode} onPlayerClick={setActivePlayerId} onScoreClick={setScorecardPlayerId} />
        </>
      )}
    </div>
  );
}
