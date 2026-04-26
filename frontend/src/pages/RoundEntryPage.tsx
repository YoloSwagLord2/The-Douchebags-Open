import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePopups } from "../lib/popups";
import type { HoleScorecardResponse, ScorecardResponse } from "../lib/types";
import { t } from "../lib/i18n";

export function RoundEntryPage() {
  const { token } = useAuth();
  const { pushAchievementPopups, pushBonusPopups, refreshNotifications } = usePopups();
  const { roundId } = useParams();
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftStroke, setDraftStroke] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !roundId) return;
    api.myScorecard(roundId, token).then((response) => {
      setScorecard(response);
      const firstOpen = response.holes.findIndex((hole) => hole.strokes == null);
      const nextIndex = firstOpen === -1 ? 0 : firstOpen;
      setCurrentIndex(nextIndex);
      setDraftStroke(response.holes[nextIndex]?.strokes ?? 4);
    });
  }, [roundId, token]);

  const hole = scorecard?.holes[currentIndex];

  useEffect(() => {
    if (!hole) return;
    setDraftStroke(hole.strokes ?? Math.max(1, hole.par));
  }, [hole?.hole_id]);

  const saveCurrentHole = async () => {
    if (!token || !roundId || !hole) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await api.saveScorecard(roundId, [{ hole_id: hole.hole_id, strokes: draftStroke }], token);
      setScorecard(response);
      if (response.newly_unlocked_bonuses.length) {
        pushBonusPopups(response.newly_unlocked_bonuses);
      }
      if (response.new_achievements.length) {
        pushAchievementPopups(response.new_achievements);
      }
      await refreshNotifications();
      setCurrentIndex((index) => Math.min(index + 1, response.holes.length - 1));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save score");
    } finally {
      setSaving(false);
    }
  };

  const currentHole = hole as HoleScorecardResponse | undefined;
  const progress = scorecard ? `${currentIndex + 1}/${scorecard.holes.length}` : "0/0";
  const totals = scorecard?.totals;

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{scorecard?.round.tournament_name} • Round {scorecard?.round.round_number}</p>
          <h2>{t('score.enterScores')}</h2>
          <p className="hero-subtitle">
            Tap + or − to set your strokes, then press Save and continue after each hole.
          </p>
        </div>
        <div className="score-chip">{progress}</div>
      </section>

      {currentHole ? (
        <section className="hole-stage">
          <div className="hole-image-wrap">
            <img
              className="hole-image"
              src="https://i.ibb.co/chnG1ZzQ/brudenell-hole-1.webp"
              alt={`Hole ${currentHole.hole_number}`}
            />
          </div>
          <div className="hole-stage__header">
            <h3>{t('score.hole')} {currentHole.hole_number}</h3>
            <div className="hole-stage__meta">
              <span>{t('score.par')} {currentHole.par}</span>
              <span>{t('score.si')} {currentHole.stroke_index}</span>
              <span>{currentHole.distance}m</span>
            </div>
          </div>
          <div className="stroke-display">{draftStroke}</div>
          <div className="stroke-controls">
            <button type="button" onClick={() => setDraftStroke((value) => Math.max(1, value - 1))}>
              -
            </button>
            <input
              inputMode="numeric"
              type="number"
              value={draftStroke}
              onChange={(event) => setDraftStroke(Number(event.target.value))}
            />
            <button type="button" onClick={() => setDraftStroke((value) => value + 1)}>
              +
            </button>
          </div>
          {saveError && <p className="form-error">{saveError}</p>}
          <div className="hole-stage__footer">
            <button type="button" className="button-ghost" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>
              {t('score.previous')}
            </button>
            <button type="button" className="button-primary" onClick={saveCurrentHole} disabled={saving}>
              {saving ? "Saving…" : t('score.saveAndContinue')}
            </button>
          </div>
        </section>
      ) : (
        <div className="loading-state">{t('score.loading')}</div>
      )}

      <section className="totals-strip">
        <div>
          <span>{t('score.gross')}</span>
          <strong>{totals?.gross_strokes ?? 0}</strong>
        </div>
        <div>
          <span>{t('score.official')}</span>
          <strong>{totals?.official_stableford ?? 0}</strong>
        </div>
        <div>
          <span>{t('score.bonus')}</span>
          <strong>{totals?.bonus_points ?? 0}</strong>
        </div>
        <div>
          <span>{t('score.adj')}</span>
          <strong>{totals?.bonus_adjusted_stableford ?? 0}</strong>
        </div>
      </section>
    </div>
  );
}
