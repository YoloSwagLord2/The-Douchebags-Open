import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { NotificationResponse } from "../lib/types";

export function NotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationResponse[]>([]);

  const refresh = async () => {
    if (!token) return;
    const data = await api.notifications(token);
    setItems(data);
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [token]);

  const markRead = async (id: string) => {
    if (!token) return;
    await api.markNotificationRead(id, token);
    await refresh();
  };

  return (
    <div className="stack-layout">
      <section className="masthead-panel">
        <div>
          <p className="eyebrow">Notification centre</p>
          <h2>Messages and event alerts</h2>
        </div>
        <button className="button-ghost" onClick={() => token && api.markAllNotificationsRead(token).then(refresh)} type="button">
          Mark all read
        </button>
      </section>
      <div className="list-stack">
        {items.map((item) => (
          <article className={`detail-panel ${item.recipient?.read_at ? "" : "detail-panel--unread"}`} key={item.id}>
            <div className="detail-panel__row">
              <strong>{item.title}</strong>
              {!item.recipient?.read_at ? (
                <button className="button-ghost" onClick={() => markRead(item.id)} type="button">
                  Read
                </button>
              ) : null}
            </div>
            <p>{item.body}</p>
            <small>{new Date(item.created_at).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

