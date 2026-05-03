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

function initials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
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

function RoundMatrix({ overview }: { overview: TournamentOverviewResponse }) {
  if (overview.rounds.length === 0) {
    return (
      <section className="detail-panel">
        <p className="eyebrow">Scoreboard</p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted, #8899aa)" }}>
          {t('leaderboard.noRoundsYet')}
        </p>
      </section>
    );
  }
  if (overview.entries.length === 0) {
    return (
      <section className="detail-panel">
        <p className="eyebrow">Scoreboard</p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted, #8899aa)" }}>
          {t('leaderboard.noPlayersYet')}
        </p>
      </section>
    );
  }
  return (
    <section className="detail-panel">
      <p className="eyebrow">{t('leaderboard.scoreboardPerRound')}</p>
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
                      <img
                        alt={entry.player_name}
                        className="leaderboard-avatar"
                        src={entry.avatar_url}
                        style={{ width: 28, height: 28 }}
                      />
                    ) : (
                      <div
                        className="leaderboard-avatar leaderboard-avatar--fallback"
                        style={{ width: 28, height: 28, fontSize: "0.65rem" }}
                      >
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
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{t('leaderboard.tournamentLeaderboard')}</p>
          <h2>{overview?.tournament_name ?? selectedTournament?.name ?? "Leaderboard"}</h2>
          <p className="hero-subtitle">{t('leaderboard.subtitle')}</p>
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

      <section className="detail-panel">
        <label className="field-label">
          {t('leaderboard.selectEvent')}
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {navigation.length === 0 && <option value="">{t('leaderboard.noTournaments')}</option>}
            {navigation.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.date}
              </option>
            ))}
          </select>
        </label>
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
          <RoundMatrix overview={overview} />
          {entries.length > 0 && (
            <>
              <FeaturedLeader entry={leader} />
              <LeaderboardTable entries={entries} mode={mode} />
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
