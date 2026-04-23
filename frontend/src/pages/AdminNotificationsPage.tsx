import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { NavigationTournament, NotificationResponse, PlayerResponse } from "../lib/types";

export function AdminNotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [navigation, setNavigation] = useState<NavigationTournament[]>([]);
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal",
    target_type: "all_users",
    user_id: "",
    round_id: "",
    tournament_id: "",
  });

  const load = async () => {
    if (!token) return;
    const [notificationData, playerData, nav] = await Promise.all([
      api.adminNotifications(token),
      api.adminPlayers(token),
      api.navigation(token),
    ]);
    setItems(notificationData);
    setPlayers(playerData);
    setNavigation(nav);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createAdminNotification(form, token);
    setForm({ ...form, title: "", body: "" });
    await load();
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Message centre</p>
        <h2>Push notification</h2>
        <form className="stack-form" onSubmit={submit}>
          <input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <textarea placeholder="Body" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <select value={form.target_type} onChange={(event) => setForm({ ...form, target_type: event.target.value })}>
            <option value="all_users">All users</option>
            <option value="individual">One player</option>
            <option value="round_roster">Round roster</option>
            <option value="tournament_roster">Tournament roster</option>
          </select>
          {form.target_type === "individual" ? (
            <select value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}>
              <option value="">Select player</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          ) : null}
          {form.target_type === "round_roster" ? (
            <select value={form.round_id} onChange={(event) => setForm({ ...form, round_id: event.target.value })}>
              <option value="">Select round</option>
              {navigation.flatMap((item) =>
                item.rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {item.name} • Round {round.round_number}
                  </option>
                )),
              )}
            </select>
          ) : null}
          {form.target_type === "tournament_roster" ? (
            <select value={form.tournament_id} onChange={(event) => setForm({ ...form, tournament_id: event.target.value })}>
              <option value="">Select tournament</option>
              {navigation.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          ) : null}
          <button className="button-primary" type="submit">Send message</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Sent items</p>
        <h2>Admin notification log</h2>
        <div className="list-stack">
          {items.map((item) => (
            <article className="detail-panel detail-panel--nested" key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
