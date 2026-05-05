import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { t } from "../lib/i18n";
import type { ScorecardResponse } from "../lib/types";

interface Props {
  roundId: string | null;
  playerId: string | null;
  onClose: () => void;
}

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

export function ScorecardModal({ roundId, playerId, onClose }: Props) {
  const { token } = useAuth();
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roundId || !playerId || !token) { setScorecard(null); return; }
    setLoading(true);
    setScorecard(null);
    api.playerRoundScorecard(roundId, playerId, token)
      .then(setScorecard)
      .catch(() => setScorecard(null))
      .finally(() => setLoading(false));
  }, [roundId, playerId, token]);

  if (!roundId || !playerId) return null;

  const sorted = scorecard ? [...scorecard.holes].sort((a, b) => a.hole_number - b.hole_number) : [];
  const totals = scorecard?.totals;

  return (
    <div className="player-card-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="player-card scorecard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="player-card__close" type="button" onClick={onClose} aria-label="Close">×</button>

        {loading ? (
          <div className="player-card__body player-card__body--loading"><p>Laden…</p></div>
        ) : scorecard ? (
          <>
            <div className="scorecard-modal__header">
              <p className="eyebrow">{scorecard.round.course_name} — {displayRoundName(scorecard.round)}</p>
              <h2>{scorecard.player.name}</h2>
            </div>

            <div className="scorecard-modal__body">
              <div className="scorecard-summary">
                <table className="scorecard-table">
                  <thead>
                    <tr>
                      <th className="scorecard-table__label"></th>
                      {sorted.map((h) => (
                        <th key={h.hole_id}>{h.hole_number}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="scorecard-table__label">{t('score.par')}</td>
                      {sorted.map((h) => (
                        <td key={h.hole_id}>{h.par}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="scorecard-table__label">{t('score.scoreLabel')}</td>
                      {sorted.map((h) => {
                        const diff = h.strokes != null ? h.strokes - h.par : null;
                        const badge =
                          diff === null ? "" :
                          diff <= -2 ? " score-eagle" :
                          diff === -1 ? " score-birdie" :
                          diff === 1 ? " score-bogey" :
                          diff >= 2 ? " score-dbl-bogey" : "";
                        return (
                          <td key={h.hole_id}>
                            {h.strokes != null
                              ? <span className={`score-badge${badge}`}>{h.strokes}</span>
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="scorecard-table__label">{t('score.stb')}</td>
                      {sorted.map((h) => (
                        <td key={h.hole_id}>{h.stableford_points ?? "—"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {totals && (
                <div className="totals-card">
                  <div className="totals-strip">
                    <div>
                      <span>{t('score.gross')}</span>
                      <strong>{totals.gross_strokes}</strong>
                    </div>
                    <div>
                      <span>{t('score.net')}</span>
                      <strong>{totals.net_strokes}</strong>
                    </div>
                    <div>
                      <span>{t('score.stableford')}</span>
                      <strong>{totals.official_stableford}</strong>
                    </div>
                    <div>
                      <span>{t('score.bonus')}</span>
                      <strong>{totals.bonus_points}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="player-card__body player-card__body--loading"><p>Kan scorecard niet laden.</p></div>
        )}
      </div>
    </div>
  );
}
