import type { CSSProperties } from "react";

const paintSplatters = [
  { x: "15%", y: "42%", size: "2.3rem", delay: "0.66s" },
  { x: "38%", y: "54%", size: "1.6rem", delay: "0.92s" },
  { x: "62%", y: "47%", size: "2rem", delay: "0.78s" },
  { x: "84%", y: "59%", size: "1.7rem", delay: "1s" },
];

interface BonusCelebrationProps {
  ruleName: string;
  points: number;
  message: string;
  onClose: () => void;
  onReplay?: () => void;
}

function customProperties(values: Record<string, string>) {
  return values as CSSProperties;
}

function PaintMeltSheet() {
  return (
    <svg aria-hidden="true" className="bonus-demo__melt-sheet" preserveAspectRatio="xMidYMin meet" viewBox="0 0 1440 760">
      <path
        d="M0 0H1440V250C1426 261 1430 286 1433 320C1439 412 1359 420 1349 324C1343 267 1350 242 1323 238C1288 235 1265 288 1232 260C1202 234 1167 205 1125 253C1093 290 1048 283 1018 240C990 202 944 214 931 262C922 297 943 346 909 374C878 400 832 379 838 326C845 256 799 227 760 252C724 276 684 276 651 239C617 202 570 220 557 274C545 325 567 392 520 412C480 429 440 385 454 323C470 253 430 226 391 252C354 277 327 275 300 238C271 199 218 217 211 273C204 335 224 392 183 413C139 436 103 400 113 325C122 255 84 221 42 250C22 264 10 254 0 250V0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="bonus-demo__trophy-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 289 406.5"
    >
      <path
        d="M230.88,342.63c-1.35-9.81-9.14-18.34-9.89-28.41-2.46-33,7.38-61.36,15.37-93.29,3.4-13.6,2.88-27.7,7.09-41.11,5.79-18.42,9.26-39.39,18.21-56.95,5.07-9.94,18.52-15.22,16.46-26.92-1.63-9.22-3.92-17.38-3.36-26.85,1.24-21.1,13.4-44.67-16.44-57.84-4.4-1.94-9.11-3.2-14.16-3.52-28.56-1.82-41.68,20.42-54.08,36.35-6.1,7.84-12.69,15.11-16.85,23.76-3.98,8.29-2.9,16.9-6.03,25.3-15.89,42.7-30.52,85.64-38.72,129.71-2.73,14.67-4.69,29.52-6.44,44.27-.81,6.85.69,14.11-3.46,20.48-7.84,12.06-28.62,4.31-41.28,1.99-24.95-4.56-50.51-1.47-61.06,18.96-8.67,16.8-9.54,34.82-3.63,52.16,1.88,5.52,3.56,13.71,9.41,17.58,8.15,5.39,21.65,3.78,31.33,5.99-11.38.53-17.29,3.49-18.15,12.7l185.97-.61c-1.19-11.94-12.73-14.5-22.31-22.05,24.74-.96,34.58-13.05,32.02-31.71Z"
        fill="#ff00bd"
      />
    </svg>
  );
}

export function BonusCelebration({ ruleName, points, message, onClose, onReplay }: BonusCelebrationProps) {
  return (
    <>
      <div className="bonus-demo__shade" />
      <div className="bonus-demo__prelude">
        <p>Bonus unlocked</p>
        <strong>{ruleName}</strong>
      </div>
      <div className="bonus-demo__paint-effects" aria-hidden="true">
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
      <section className="bonus-demo__award">
        <button aria-label="Close bonus message" className="bonus-demo__close" onClick={onClose} type="button">
          X
        </button>
        <div className="bonus-demo__trophy">
          <TrophyIcon />
        </div>
        <p className="bonus-demo__kicker">Bonus received</p>
        <h1>{ruleName}</h1>
        <p className="bonus-demo__points">+{points} bonus Stableford</p>
        <p className="bonus-demo__message">{message}</p>
        <button className="bonus-demo__button" onClick={onReplay ?? onClose} type="button">
          {onReplay ? "Replay" : "Keep going"}
        </button>
      </section>
    </>
  );
}
