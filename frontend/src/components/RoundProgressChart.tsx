import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import type { LeaderboardEntry } from "../lib/types";

type Series = {
  playerId: string;
  playerName: string;
  color: string;
  cumulative: (number | null)[];
};

type RoundOption = { id: string; label: string };

const COLORS = ["#ff6b9d", "#98a9b5", "#d4a14a"];

export function RoundProgressChart({
  roundId,
  rounds,
  token,
  entries,
  onClose,
}: {
  roundId?: string;
  rounds?: RoundOption[];
  token: string;
  entries: LeaderboardEntry[];
  onClose: () => void;
}) {
  const initialRound = roundId ?? rounds?.[0]?.id ?? "";
  const [selectedRoundId, setSelectedRoundId] = useState(initialRound);
  const [series, setSeries] = useState<Series[]>([]);
  const [holeCount, setHoleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const top3 = entries.slice(0, 3);
    if (top3.length === 0 || !selectedRoundId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      top3.map((entry) => api.playerRoundScorecard(selectedRoundId, entry.player_id, token)),
    )
      .then((scorecards) => {
        if (cancelled) return;
        const maxHoles = Math.max(...scorecards.map((s) => s.holes.length));
        setHoleCount(maxHoles);
        const next: Series[] = scorecards.map((sc, idx) => {
          let running = 0;
          const cumulative = sc.holes
            .sort((a, b) => a.hole_number - b.hole_number)
            .map((h) => {
              if (h.stableford_points == null) return null;
              running += h.stableford_points;
              return running;
            });
          return {
            playerId: top3[idx].player_id,
            playerName: top3[idx].player_name,
            color: COLORS[idx],
            cumulative,
          };
        });
        setSeries(next);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoundId, token, entries]);

  const allValues = series.flatMap((s) => s.cumulative.filter((v): v is number => v != null));
  const maxY = allValues.length > 0 ? Math.max(...allValues, 4) : 4;
  const yMax = Math.ceil(maxY / 4) * 4;

  const width = 320;
  const height = 240;
  const padLeft = 38;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xFor = (holeIndex: number) =>
    padLeft + (holeCount <= 1 ? 0 : (holeIndex / (holeCount - 1)) * plotW);
  const yFor = (value: number) => padTop + plotH - (value / yMax) * plotH;

  const yTicks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax].map((v) => Math.round(v));

  return (
    <div className="progress-chart-backdrop" onClick={onClose}>
      <div className="progress-chart" onClick={(e) => e.stopPropagation()}>
        <div className="progress-chart__head">
          <h3>{t('leaderboard.progressTitle')}</h3>
          <button type="button" className="progress-chart__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {rounds && rounds.length > 1 && (
          <select
            className="progress-chart__round-select"
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}
        {loading ? (
          <p className="progress-chart__loading">{t('leaderboard.progressLoading')}</p>
        ) : error ? (
          <p className="progress-chart__loading">{t('leaderboard.progressError')}</p>
        ) : series.length === 0 || holeCount === 0 ? (
          <p className="progress-chart__loading">{t('leaderboard.progressNoData')}</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} className="progress-chart__svg" preserveAspectRatio="xMidYMid meet">
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={padLeft} x2={width - padRight}
                    y1={yFor(tick)} y2={yFor(tick)}
                    stroke="currentColor" strokeOpacity="0.12" strokeWidth="1"
                  />
                  <text x={padLeft - 4} y={yFor(tick) + 3} fontSize="9" textAnchor="end" fill="currentColor" opacity="0.6">{tick}</text>
                </g>
              ))}
              {Array.from({ length: holeCount }).map((_, i) => (
                <text key={i} x={xFor(i)} y={padTop + plotH + 12} fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">
                  {i + 1}
                </text>
              ))}
              <text x={padLeft + plotW / 2} y={height - 4} fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.75" fontWeight="600">
                {t('leaderboard.progressXAxis')}
              </text>
              <text
                x={10}
                y={padTop + plotH / 2}
                fontSize="10"
                textAnchor="middle"
                fill="currentColor"
                opacity="0.75"
                fontWeight="600"
                transform={`rotate(-90 10 ${padTop + plotH / 2})`}
              >
                {t('leaderboard.progressYAxis')}
              </text>
              {series.map((s) => {
                const points = s.cumulative
                  .map((v, i) => (v == null ? null : `${xFor(i)},${yFor(v)}`))
                  .filter((p): p is string => p != null);
                if (points.length === 0) return null;
                return (
                  <g key={s.playerId}>
                    <polyline
                      points={points.join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {s.cumulative.map((v, i) =>
                      v == null ? null : (
                        <circle key={i} cx={xFor(i)} cy={yFor(v)} r="2.4" fill={s.color} />
                      ),
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="progress-chart__legend">
              {series.map((s) => (
                <span key={s.playerId} className="progress-chart__legend-item" style={{ color: s.color }}>
                  ● <span style={{ color: "var(--text)" }}>{s.playerName}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
