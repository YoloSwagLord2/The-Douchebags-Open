import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePopups } from "../lib/popups";
import type { HoleScorecardResponse, ScorecardResponse } from "../lib/types";

export function RoundEntryPage() {
  const { token } = useAuth();
  const { pushAchievementPopups, pushBonusPopups, refreshNotifications } = usePopups();
  const { roundId } = useParams();
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftStroke, setDraftStroke] = useState<number>(4);
  const [saving, setSaving] = useState(false);

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
          <p className="eyebrow">Score entry</p>
          <h2>
            {scorecard?.round.tournament_name} • Round {scorecard?.round.round_number}
          </h2>
          <p className="hero-subtitle">
            One-hole flow for quick mobile entry, with all totals coming straight from the backend.
          </p>
        </div>
        <div className="score-chip">{progress}</div>
      </section>

      {currentHole ? (
        <section className="hole-stage">
          <div className="hole-stage__header">
            <h3>Hole {currentHole.hole_number}</h3>
            <div className="hole-stage__meta">
              <span>Par {currentHole.par}</span>
              <span>SI {currentHole.stroke_index}</span>
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
          <div className="hole-stage__footer">
            <button type="button" className="button-ghost" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>
              Previous
            </button>
            <button type="button" className="button-primary" onClick={saveCurrentHole} disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </section>
      ) : (
        <div className="loading-state">Loading hole data…</div>
      )}

      <section className="totals-strip">
        <div>
          <span>Gross</span>
          <strong>{totals?.gross_strokes ?? 0}</strong>
        </div>
        <div>
          <span>Official</span>
          <strong>{totals?.official_stableford ?? 0}</strong>
        </div>
        <div>
          <span>Bonus</span>
          <strong>{totals?.bonus_points ?? 0}</strong>
        </div>
        <div>
          <span>Adj.</span>
          <strong>{totals?.bonus_adjusted_stableford ?? 0}</strong>
        </div>
      </section>
    </div>
  );
}
