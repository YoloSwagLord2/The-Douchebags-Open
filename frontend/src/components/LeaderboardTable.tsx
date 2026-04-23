import type { LeaderboardEntry } from "../lib/types";

interface Props {
  entries: LeaderboardEntry[];
  mode: "official" | "bonus";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LeaderboardTable({ entries, mode }: Props) {
  return (
    <div className="leaderboard-table">
      {entries.map((entry) => (
        <article className="leaderboard-row" key={`${mode}-${entry.player_id}`}>
          <div className="leaderboard-row__position">
            {mode === "official" ? entry.official_position : entry.bonus_position}
          </div>
          <div className="leaderboard-row__identity">
            {entry.avatar_url ? (
              <img alt={entry.player_name} className="leaderboard-avatar" src={entry.avatar_url} />
            ) : (
              <div className="leaderboard-avatar leaderboard-avatar--fallback">{initials(entry.player_name)}</div>
            )}
            <div>
              <div className="leaderboard-row__name">{entry.player_name}</div>
              <div className="leaderboard-row__meta">{entry.holes_played} holes logged</div>
            </div>
          </div>
          <div className="leaderboard-row__stat">
            <span className="leaderboard-row__label">Gross</span>
            <strong>{entry.gross_strokes}</strong>
          </div>
          <div className="leaderboard-row__stat">
            <span className="leaderboard-row__label">Net</span>
            <strong>{entry.net_strokes}</strong>
          </div>
          <div className="leaderboard-row__stat leaderboard-row__stat--primary">
            <span className="leaderboard-row__label">
              {mode === "official" ? "Stableford" : "Bonus adj."}
            </span>
            <strong>
              {mode === "official" ? entry.official_stableford : entry.bonus_adjusted_stableford}
            </strong>
          </div>
        </article>
      ))}
    </div>
  );
}

