import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import type { BonusAnimationPreset } from "../lib/types";

interface Props {
  preset: BonusAnimationPreset;
  lottieUrl?: string | null;
  className?: string;
  onComplete?: () => void;
}

const DEFAULT_LOTTIE_URL = "/lotties/zaad.json";

export function LottieOrPreset({ preset, lottieUrl, className = "", onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const resolvedLottieUrl = lottieUrl || DEFAULT_LOTTIE_URL;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!resolvedLottieUrl || !containerRef.current) {
      onCompleteRef.current?.();
      return;
    }
    let animation: ReturnType<typeof lottie.loadAnimation> | undefined;
    const handleComplete = () => onCompleteRef.current?.();
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
        animation.addEventListener("complete", handleComplete);
      })
      .catch(() => onCompleteRef.current?.());
    return () => {
      animation?.removeEventListener("complete", handleComplete);
      animation?.destroy();
    };
  }, [resolvedLottieUrl]);

  if (resolvedLottieUrl) {
    return <div className={`lottie-shell lottie-shell--${preset} ${className}`.trim()} ref={containerRef} />;
  }

  return (
    <div className={`preset-animation preset-animation--${preset}`}>
      <div className="preset-animation__ring" />
      <div className="preset-animation__ring preset-animation__ring--alt" />
      <div className="preset-animation__spark" />
    </div>
  );
}
