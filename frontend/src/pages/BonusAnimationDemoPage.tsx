import { useState } from "react";
import { BonusCelebration } from "../components/BonusCelebration";

const demoBonus = {
  ruleName: "Secret Splash Bonus",
  points: 7,
  message: "You unlocked the hidden bonus for landing the first net eagle of the round.",
};

function DemoScoreEntryScreen() {
  return (
    <section className="bonus-demo__score-screen" aria-label="Score entry screen">
      <header className="bonus-demo__score-header">
        <div>
          <p>The Douchebags Open • Round 1</p>
          <h1>Enter your scores</h1>
        </div>
        <span>7/18</span>
      </header>

      <section className="bonus-demo__hole-card">
        <div className="bonus-demo__hole-header">
          <div>
            <p>Current hole</p>
            <h2>Hole 7</h2>
          </div>
          <div className="bonus-demo__hole-meta">
            <span>Par 4</span>
            <span>S.I. 9</span>
            <span>374m</span>
          </div>
        </div>

        <div className="bonus-demo__stroke-display">4</div>
        <div className="bonus-demo__stroke-controls" aria-label="Stroke controls">
          <button type="button">-</button>
          <input aria-label="Strokes" inputMode="numeric" readOnly type="number" value="4" />
          <button type="button">+</button>
        </div>

        <div className="bonus-demo__score-actions">
          <button type="button">Previous</button>
          <button type="button">Save and continue</button>
        </div>
      </section>

      <section className="bonus-demo__totals" aria-label="Score totals">
        <div>
          <span>Gross</span>
          <strong>32</strong>
        </div>
        <div>
          <span>Stableford</span>
          <strong>15</strong>
        </div>
        <div>
          <span>Bonus</span>
          <strong>7</strong>
        </div>
        <div>
          <span>Adj.</span>
          <strong>22</strong>
        </div>
      </section>
    </section>
  );
}

export function BonusAnimationDemoPage() {
  const [playKey, setPlayKey] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const replay = () => {
    setDismissed(false);
    setPlayKey((current) => current + 1);
  };

  return (
    <main className="bonus-demo" aria-label="Bonus unlock animation demo">
      <DemoScoreEntryScreen />
      {!dismissed ? (
        <BonusCelebration
          key={playKey}
          ruleName={demoBonus.ruleName}
          points={demoBonus.points}
          message={demoBonus.message}
          onClose={() => setDismissed(true)}
          onReplay={replay}
        />
      ) : (
        <button className="bonus-demo__replay-docked" onClick={replay} type="button">
          Replay demo
        </button>
      )}
    </main>
  );
}
