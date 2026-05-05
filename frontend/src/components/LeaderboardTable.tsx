import { t } from "../lib/i18n";
import type { LeaderboardEntry } from "../lib/types";

interface Props {
  entries: LeaderboardEntry[];
  mode: "official" | "bonus";
  onPlayerClick: (playerId: string) => void;
  onScoreClick?: (playerId: string) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LeaderboardTable({ entries, mode, onPlayerClick, onScoreClick }: Props) {
  const sorted = [...entries].sort((a, b) =>
    mode === "official"
      ? b.official_stableford - a.official_stableford
      : b.bonus_adjusted_stableford - a.bonus_adjusted_stableford,
  );

  return (
    <div className="leaderboard-table">
      {sorted.map((entry) => (
        <article className="leaderboard-row" key={`${mode}-${entry.player_id}`}>
          <div className="leaderboard-row__position">
            <span className="leaderboard-row__position-hash">#</span>{mode === "official" ? entry.official_position : entry.bonus_position}
          </div>
          <button
            type="button"
            className="leaderboard-row__avatar"
            onClick={() => onPlayerClick(entry.player_id)}
            aria-label={`View ${entry.player_name} profile`}
          >
            {entry.avatar_url ? (
              <img alt={entry.player_name} className="leaderboard-avatar leaderboard-avatar--fill" src={entry.avatar_url} />
            ) : (
              <div className="leaderboard-avatar leaderboard-avatar--fallback leaderboard-avatar--fill">{initials(entry.player_name)}</div>
            )}
          </button>
          <div className="leaderboard-row__body">
            <div className="leaderboard-row__header">
              <span className="leaderboard-row__name">{entry.player_name}</span>
              <span className="leaderboard-row__meta">{entry.holes_played} {t('leaderboard.holesLogged')}</span>
            </div>
            <div className="leaderboard-row__stats">
              <div className="leaderboard-row__stat">
                <span className="leaderboard-row__label">{t('leaderboard.gross')}</span>
                <strong>{entry.gross_strokes}</strong>
              </div>
              <div className="leaderboard-row__stat">
                <span className="leaderboard-row__label">{t('leaderboard.net')}</span>
                <strong>{entry.net_strokes}</strong>
              </div>
              <div
                className={`leaderboard-row__stat${mode === "official" ? " leaderboard-row__stat--primary" : ""}${onScoreClick ? " leaderboard-row__stat--tappable" : ""}`}
                onClick={onScoreClick ? () => onScoreClick(entry.player_id) : undefined}
              >
                <span className="leaderboard-row__label">{t('leaderboard.official')}</span>
                <strong>{entry.official_stableford}</strong>
              </div>
              {mode === "bonus" && (
                <>
                  <div className="leaderboard-row__stat">
                    <span className="leaderboard-row__label">{t('leaderboard.bonus')}</span>
                    <strong>{entry.bonus_points}</strong>
                  </div>
                  <div
                    className={`leaderboard-row__stat leaderboard-row__stat--primary${onScoreClick ? " leaderboard-row__stat--tappable" : ""}`}
                    onClick={onScoreClick ? () => onScoreClick(entry.player_id) : undefined}
                  >
                    <span className="leaderboard-row__label">{t('leaderboard.bonusAdj')}</span>
                    <strong>{entry.bonus_adjusted_stableford}</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
