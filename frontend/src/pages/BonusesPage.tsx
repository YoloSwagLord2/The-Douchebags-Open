import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { BonusAward } from "../lib/types";

export function BonusesPage() {
  const { token } = useAuth();
  const [awards, setAwards] = useState<BonusAward[]>([]);

  useEffect(() => {
    if (!token) return;
    api.myBonusAwards(token).then(setAwards).catch(() => undefined);
  }, [token]);

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">Secret wins</p>
          <h2>Unlocked bonus rules</h2>
        </div>
      </section>
      <div className="list-stack">
        {awards.map((award) => (
          <article className="detail-panel" key={award.id}>
            <strong>+{award.points_snapshot} Stableford</strong>
            <p>{award.message_snapshot}</p>
            <small>{new Date(award.awarded_at).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

