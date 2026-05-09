import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import type { BonusAnimationPreset } from "../lib/types";

interface Props {
  preset: BonusAnimationPreset;
  lottieUrl?: string | null;
}

const DEFAULT_LOTTIE_URL = "/lotties/zaad.json";

export function LottieOrPreset({ preset, lottieUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedLottieUrl = lottieUrl || DEFAULT_LOTTIE_URL;

  useEffect(() => {
    if (!resolvedLottieUrl || !containerRef.current) return;
    let animation: ReturnType<typeof lottie.loadAnimation> | undefined;
    fetch(resolvedLottieUrl)
      .then((response) => response.json())
      .then((data) => {
        if (!containerRef.current) return;
        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          autoplay: true,
          loop: resolvedLottieUrl !== DEFAULT_LOTTIE_URL,
          animationData: data,
        });
      })
      .catch(() => undefined);
    return () => {
      animation?.destroy();
    };
  }, [resolvedLottieUrl]);

  if (resolvedLottieUrl) {
    return <div className={`lottie-shell lottie-shell--${preset}`} ref={containerRef} />;
  }

  return (
    <div className={`preset-animation preset-animation--${preset}`}>
      <div className="preset-animation__ring" />
      <div className="preset-animation__ring preset-animation__ring--alt" />
      <div className="preset-animation__spark" />
    </div>
  );
}
