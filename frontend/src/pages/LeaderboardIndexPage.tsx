import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
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

function initials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
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
        <p className="eyebrow">{t('leaderboard.currentLeader')}</p>
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

function RoundMatrix({ overview, mode, onPlayerClick, onScoreClick }: { overview: TournamentOverviewResponse; mode: "official" | "bonus"; onPlayerClick: (id: string) => void; onScoreClick: (playerId: string, roundId: string) => void }) {
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
    <section className="detail-panel">
      <p className="eyebrow">{title}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="round-matrix__table">
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingLeft: "0.25rem" }}>#</th>
              <th className="round-matrix__player-col">{t('leaderboard.player')}</th>
              {overview.rounds.map((r) => (
                <th key={r.id}>
                  {displayRoundName(r)}
                  <br />
                  <small>{r.course_name}</small>
                </th>
              ))}
              <th>{t('leaderboard.total')}</th>
            </tr>
          </thead>
          <tbody>
            {overview.entries.map((entry, pos) => (
              <tr key={entry.player_id}>
                <td style={{ textAlign: "center", color: "var(--text-muted, #8899aa)", fontSize: "0.8rem" }}>
                  {pos + 1}
                </td>
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
                      <button
                        type="button"
                        className="round-matrix__score-btn"
                        onClick={() => onScoreClick(entry.player_id, result.round_id)}
                      >
                        {result.stableford}
                      </button>
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "center" }}>
                  <strong>{entry.total_stableford || "—"}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LeaderboardIndexPage() {
  const { token } = useAuth();
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();
  const [selectedId, setSelectedId] = useState("");
  const [overview, setOverview] = useState<TournamentOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [mode, setMode] = useState<"official" | "bonus">("official");
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [scorecardTarget, setScorecardTarget] = useState<{ playerId: string; roundId: string } | null>(null);

  // Auto-select the first (latest) tournament once navigation loads
  useEffect(() => {
    if (navigation.length > 0 && !selectedId) {
      setSelectedId(navigation[0].id);
    }
  }, [navigation, selectedId]);

  useEffect(() => {
    if (!token || !selectedId) return;
    setOverview(null);
    setData(null);
    setOverviewLoading(true);
    api.tournamentOverview(selectedId, token)
      .then(setOverview)
      .catch(() => undefined)
      .finally(() => setOverviewLoading(false));
    api.tournamentLeaderboard(selectedId, token)
      .then(setData)
      .catch(() => undefined);
  }, [selectedId, token]);

  const entries = mode === "official" ? data?.official_entries ?? [] : data?.bonus_entries ?? [];
  const leader = useMemo(() => entries[0], [entries]);
  const selectedTournament = navigation.find((t) => t.id === selectedId);

  return (
    <div className="stack-layout">
      <PlayerCardModal playerId={activePlayerId} onClose={() => setActivePlayerId(null)} />
      <ScorecardModal
        roundId={scorecardTarget?.roundId ?? null}
        playerId={scorecardTarget?.playerId ?? null}
        onClose={() => setScorecardTarget(null)}
      />
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{t('leaderboard.tournamentLeaderboard')}</p>
          <div className="masthead-tournament-picker">
            <span className="masthead-tournament-picker__name">
              {overview?.tournament_name ?? selectedTournament?.name ?? "Leaderboard"}
            </span>
            <span className="masthead-tournament-picker__arrow">▾</span>
            <select
              className="masthead-tournament-picker__select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label={t('leaderboard.selectEvent')}
            >
              {navigation.length === 0 && <option value="">{t('leaderboard.noTournaments')}</option>}
              {navigation.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="segmented-control">
          <button
            className={mode === "official" ? "is-active" : ""}
            onClick={() => setMode("official")}
            type="button"
          >
            Stableford
          </button>
          <button
            className={mode === "bonus" ? "is-active" : ""}
            onClick={() => setMode("bonus")}
            type="button"
          >
            Bonus
          </button>
        </div>
      </section>

      {!selectedId ? (
        <section className="detail-panel">
          <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>
            {t('leaderboard.selectToView')}
          </p>
        </section>
      ) : overviewLoading ? (
        <section className="detail-panel">
          <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>{t('leaderboard.loading')}</p>
        </section>
      ) : overview ? (
        <>
          <RoundMatrix overview={overview} mode={mode} onPlayerClick={setActivePlayerId} onScoreClick={(playerId, roundId) => setScorecardTarget({ playerId, roundId })} />
          {entries.length > 0 && (
            <>
              <FeaturedLeader entry={leader} onPlayerClick={setActivePlayerId} />
              <LeaderboardTable entries={entries} mode={mode} onPlayerClick={setActivePlayerId} />
            </>
          )}
        </>
      ) : (
        <section className="detail-panel">
          <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>
            {t('leaderboard.loadError')}
          </p>
        </section>
      )}
    </div>
  );
}
