import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import type { BonusAnimationPreset } from "../lib/types";

interface Props {
  preset: BonusAnimationPreset;
  lottieUrl?: string | null;
}

export function LottieOrPreset({ preset, lottieUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lottieUrl || !containerRef.current) return;
    let animation: ReturnType<typeof lottie.loadAnimation> | undefined;
    fetch(lottieUrl)
      .then((response) => response.json())
      .then((data) => {
        if (!containerRef.current) return;
        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          autoplay: true,
          loop: true,
          animationData: data,
        });
      })
      .catch(() => undefined);
    return () => {
      animation?.destroy();
    };
  }, [lottieUrl]);

  if (lottieUrl) {
    return <div className="lottie-shell" ref={containerRef} />;
  }

  return (
    <div className={`preset-animation preset-animation--${preset}`}>
      <div className="preset-animation__ring" />
      <div className="preset-animation__ring preset-animation__ring--alt" />
      <div className="preset-animation__spark" />
    </div>
  );
}

