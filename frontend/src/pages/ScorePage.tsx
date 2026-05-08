import { Navigate, useOutletContext } from "react-router-dom";
import type { NavigationTournament } from "../lib/types";
import { t } from "../lib/i18n";

export function ScorePage() {
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();

  const today = new Date().toISOString().slice(0, 10);
  const allRounds = navigation.flatMap((tn) => tn.rounds.map((r) => ({ ...r, tournamentId: tn.id })));
  const pastOrToday = allRounds.filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const future = allRounds.filter((r) => r.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const bestRound = pastOrToday[0] ?? future[0];

  if (bestRound) {
    return <Navigate replace to={`/round/${bestRound.id}/entry`} />;
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
