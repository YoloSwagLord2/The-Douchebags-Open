import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AchievementEvent } from "../lib/types";

export function AchievementsPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<AchievementEvent[]>([]);

  useEffect(() => {
    if (!token) return;
    api.myAchievements(token).then(setEvents).catch(() => undefined);
  }, [token]);

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">Exceptional moments</p>
          <h2>Achievement history</h2>
        </div>
      </section>
      <div className="list-stack">
        {events.map((event) => (
          <article className="detail-panel" key={event.id}>
            <strong>{event.title_snapshot}</strong>
            <p>{event.message_snapshot}</p>
            <small>{new Date(event.triggered_at).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

