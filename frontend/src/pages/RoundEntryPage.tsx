import { useEffect, useRef, useState } from "react";
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
  const [draftTouched, setDraftTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isHoleImageOpen, setIsHoleImageOpen] = useState(false);
  const scorecardScrollRef = useRef<HTMLDivElement>(null);

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
    setDraftTouched(hole.strokes != null);
  }, [hole?.hole_id]);

  useEffect(() => {
    const container = scorecardScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".scorecard-table__col--active");
    if (active) active.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

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
  const hasPreviousHole = currentIndex > 0;
  const hasNextHole = scorecard ? currentIndex < scorecard.holes.length - 1 : false;
  const roundName = scorecard?.round.name?.trim() || `Round ${scorecard?.round.round_number ?? ""}`;
  const courseName = scorecard?.round.course_name;

  return (
    <div className="stack-layout score-entry-layout">
      <section className="masthead-panel score-entry-masthead">
        <div>
          <p className="eyebrow">{scorecard?.round.tournament_name} • {roundName}</p>
          <h2>{t('score.enterScores')}</h2>
          <p className="hero-subtitle">
            Tap + or − to set your strokes, then press Save and continue after each hole.
          </p>
        </div>
        <div className="score-chip">{progress}</div>
      </section>

      {currentHole ? (
        <section className="hole-stage">
          {courseName && (
            <p className="score-course-label">{roundName} • {courseName}</p>
          )}
          {currentHole.image_url ? (
            <button
              className="hole-image-wrap"
              type="button"
              onClick={() => setIsHoleImageOpen(true)}
              aria-label={`Open full image for hole ${currentHole.hole_number}`}
            >
              <img
                className="hole-image"
                src={currentHole.image_url}
                alt={`Hole ${currentHole.hole_number}`}
              />
            </button>
          ) : null}
          <div className="hole-stage__header">
            <h3>{t('score.hole')} {currentHole.hole_number}</h3>
            <div className="hole-stage__meta hole-stage__meta--stack">
              <span>
                {t('score.par')} {currentHole.par}
                {currentHole.handicap_strokes > 0 && (
                  <sup style={{ color: "var(--gold)", marginLeft: "0.15em" }}>
                    +{currentHole.handicap_strokes}
                  </sup>
                )}
              </span>
              <span>{t('score.si')} {currentHole.stroke_index}</span>
              <span>{currentHole.distance}m</span>
            </div>
          </div>
          <div className="stroke-display">{draftTouched ? draftStroke : "?"}</div>
          <div className="stroke-controls">
            <button type="button" onClick={() => {
              if (!draftTouched) { setDraftTouched(true); setDraftStroke(currentHole.par); }
              else setDraftStroke((v) => Math.max(1, v - 1));
            }}>
              -
            </button>
            <input
              inputMode="numeric"
              type="number"
              value={draftTouched ? draftStroke : ""}
              placeholder={String(currentHole.par)}
              onChange={(event) => { setDraftTouched(true); setDraftStroke(Number(event.target.value)); }}
            />
            <button type="button" onClick={() => {
              if (!draftTouched) { setDraftTouched(true); setDraftStroke(currentHole.par); }
              else setDraftStroke((v) => v + 1);
            }}>
              +
            </button>
          </div>
          {saveError && <p className="form-error">{saveError}</p>}
          <div className="hole-stage__footer">
            <button
              type="button"
              className="button-ghost"
              onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
              disabled={!hasPreviousHole}
            >
              {t('score.previous')}
            </button>
            {hasNextHole ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setCurrentIndex((value) => Math.min(value + 1, (scorecard?.holes.length ?? 1) - 1))}
              >
                {t('score.next')}
              </button>
            ) : null}
            <button type="button" className="button-primary" onClick={saveCurrentHole} disabled={saving}>
              {saving ? "Saving…" : t('score.saveAndContinue')}
            </button>
          </div>
        </section>
      ) : (
        <div className="loading-state">{t('score.loading')}</div>
      )}

      {currentHole && isHoleImageOpen && currentHole.image_url ? (
        <div className="hole-image-viewer" role="dialog" aria-modal="true" aria-label={`Hole ${currentHole.hole_number} image`}>
          <button
            className="hole-image-viewer__close"
            type="button"
            onClick={() => setIsHoleImageOpen(false)}
            aria-label="Close hole image"
          >
            ×
          </button>
          <img
            className="hole-image-viewer__image"
            src={currentHole.image_url}
            alt={`Hole ${currentHole.hole_number}`}
          />
        </div>
      ) : null}

      <section className="totals-card">
        <div className="totals-strip">
          <div>
            <span>{t('score.gross')}</span>
            <strong>{totals?.gross_strokes ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.net')}</span>
            <strong>{totals?.net_strokes ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.stableford')}</span>
            <strong>{totals?.official_stableford ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.bonus')}</span>
            <strong>{totals?.bonus_points ?? 0}</strong>
          </div>
        </div>
        {scorecard && (() => {
          const sorted = [...scorecard.holes].sort((a, b) => a.hole_number - b.hole_number);
          return (
            <div className="scorecard-summary" ref={scorecardScrollRef}>
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th className="scorecard-table__label"></th>
                    {sorted.map((h, i) => (
                      <th key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                        {h.hole_number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="scorecard-table__label">{t('score.par')}</td>
                    {sorted.map((h, i) => (
                      <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>{h.par}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="scorecard-table__label">{t('score.scoreLabel')}</td>
                    {sorted.map((h, i) => (
                      <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                        {h.strokes ?? "?"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="scorecard-table__label">{t('score.stb')}</td>
                    {sorted.map((h, i) => (
                      <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>{h.stableford_points ?? "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
