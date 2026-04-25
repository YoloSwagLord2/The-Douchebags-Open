import { useEffect, useRef, useState, type CSSProperties } from "react";
import lottie from "lottie-web";

const demoBonus = {
  ruleName: "Secret Splash Bonus",
  points: 7,
  message: "You unlocked the hidden bonus for landing the first net eagle of the round.",
};

const paintSplatters = [
  { x: "15%", y: "42%", size: "2.3rem", delay: "0.66s" },
  { x: "38%", y: "54%", size: "1.6rem", delay: "0.92s" },
  { x: "62%", y: "47%", size: "2rem", delay: "0.78s" },
  { x: "84%", y: "59%", size: "1.7rem", delay: "1s" },
];

function customProperties(values: Record<string, string>) {
  return values as CSSProperties;
}

function PaintMeltSheet() {
  return (
    <svg aria-hidden="true" className="bonus-demo__melt-sheet" preserveAspectRatio="none" viewBox="0 0 1440 760">
      <path
        d="M0 0H1440V250C1426 261 1430 286 1433 320C1439 412 1359 420 1349 324C1343 267 1350 242 1323 238C1288 235 1265 288 1232 260C1202 234 1167 205 1125 253C1093 290 1048 283 1018 240C990 202 944 214 931 262C922 297 943 346 909 374C878 400 832 379 838 326C845 256 799 227 760 252C724 276 684 276 651 239C617 202 570 220 557 274C545 325 567 392 520 412C480 429 440 385 454 323C470 253 430 226 391 252C354 277 327 275 300 238C271 199 218 217 211 273C204 335 224 392 183 413C139 436 103 400 113 325C122 255 84 221 42 250C22 264 10 254 0 250V0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg aria-hidden="true" className="bonus-demo__trophy-icon" viewBox="0 0 160 160">
      <path
        d="M48 31h64v20c0 24-12 42-32 48-20-6-32-24-32-48V31Z"
        fill="#f1b64a"
        stroke="#17120a"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M48 43H24v8c0 20 12 35 30 40M112 43h24v8c0 20-12 35-30 40"
        fill="none"
        stroke="#17120a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M80 99v25M57 133h46M45 145h70"
        fill="none"
        stroke="#17120a"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M64 48h32M66 63h28"
        fill="none"
        opacity="0.5"
        stroke="#fff4c4"
        strokeLinecap="round"
        strokeWidth="7"
      />
    </svg>
  );
}

export function BonusAnimationDemoPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const animation = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: "/animations/white-paint-drip-demo.json",
      rendererSettings: {
        preserveAspectRatio: "xMidYMid slice",
      },
    });

    return () => animation.destroy();
  }, [playKey]);

  return (
    <main className="bonus-demo" aria-label="Bonus unlock animation demo">
      <div className="bonus-demo__photo" />
      <div className="bonus-demo__shade" />
      <div className="bonus-demo__prelude">
        <p>Bonus unlocked</p>
        <strong>{demoBonus.ruleName}</strong>
      </div>
      <div className="bonus-demo__paint" ref={containerRef} aria-hidden="true" />
      <div className="bonus-demo__paint-effects" key={`paint-${playKey}`} aria-hidden="true">
        <PaintMeltSheet />
        {paintSplatters.map((splatter, index) => (
          <span
            className="bonus-demo__splatter"
            key={`splatter-${index}`}
            style={customProperties({
              "--splatter-x": splatter.x,
              "--splatter-y": splatter.y,
              "--splatter-size": splatter.size,
              "--splatter-delay": splatter.delay,
            })}
          />
        ))}
      </div>
      <section className="bonus-demo__award" key={playKey}>
        <div className="bonus-demo__trophy">
          <TrophyIcon />
        </div>
        <p className="bonus-demo__kicker">Bonus received</p>
        <h1>{demoBonus.ruleName}</h1>
        <p className="bonus-demo__points">+{demoBonus.points} bonus Stableford</p>
        <p className="bonus-demo__message">{demoBonus.message}</p>
        <button className="bonus-demo__button" onClick={() => setPlayKey((current) => current + 1)} type="button">
          Replay
        </button>
      </section>
    </main>
  );
}
