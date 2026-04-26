import { Navigate, useOutletContext } from "react-router-dom";
import type { NavigationTournament } from "../lib/types";
import { t } from "../lib/i18n";

export function ScorePage() {
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();

  const latestRound = navigation[0]?.rounds[0];

  if (latestRound) {
    return <Navigate replace to={`/round/${latestRound.id}/entry`} />;
  }

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">{t('score.eyebrow')}</p>
          <h2>{t('score.noActiveRound')}</h2>
          <p className="hero-subtitle">
            {t('score.noActiveRoundHint', "You haven't been added to a tournament yet. Ask your tournament admin to add you to the roster.")}
          </p>
        </div>
      </section>
    </div>
  );
}
