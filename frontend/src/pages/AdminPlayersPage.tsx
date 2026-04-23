import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PlayerResponse } from "../lib/types";

const initialForm = { name: "", email: "", password: "", hcp: 18, role: "player" };

export function AdminPlayersPage() {
  const { token } = useAuth();
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [form, setForm] = useState(initialForm);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    hcp: 18,
    role: "player",
    is_active: true,
  });

  const load = async () => {
    if (!token) return;
    setPlayers(await api.adminPlayers(token));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!selectedPlayer) return;
    setEditForm({
      name: selectedPlayer.name,
      email: selectedPlayer.email,
      hcp: selectedPlayer.hcp,
      role: selectedPlayer.role,
      is_active: selectedPlayer.is_active,
    });
  }, [selectedPlayer]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createAdminPlayer(form, token);
    setForm(initialForm);
    await load();
  };

  const uploadPhoto = async (file: File) => {
    if (!token || !selectedPlayerId) return;
    await api.uploadPlayerPhoto(selectedPlayerId, file, token);
    await load();
  };

  const updateSelectedPlayer = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedPlayerId) return;
    await api.updateAdminPlayer(selectedPlayerId, editForm, token);
    await load();
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Player setup</p>
        <h2>Create player</h2>
        <form className="stack-form" onSubmit={submit}>
          <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <input placeholder="Handicap" type="number" value={form.hcp} onChange={(event) => setForm({ ...form, hcp: Number(event.target.value) })} />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="player">Player</option>
            <option value="admin">Admin</option>
          </select>
          <button className="button-primary" type="submit">Create player</button>
        </form>
      </section>

      <section className="detail-panel">
        <p className="eyebrow">Roster</p>
        <h2>Existing players</h2>
        <div className="list-stack">
          {players.map((player) => (
            <label className="selection-row" key={player.id}>
              <input
                checked={selectedPlayerId === player.id}
                onChange={() => setSelectedPlayerId(player.id)}
                type="radio"
              />
              <span>{player.name}</span>
              <small>{player.role} · hcp {player.hcp}</small>
            </label>
          ))}
        </div>
        <label className="upload-box">
          Upload photo for selected player
          <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadPhoto(event.target.files[0])} />
        </label>
        {selectedPlayer ? (
          <form className="stack-form" onSubmit={updateSelectedPlayer}>
            <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
            <input type="number" value={editForm.hcp} onChange={(event) => setEditForm({ ...editForm, hcp: Number(event.target.value) })} />
            <select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
            <label className="selection-row">
              <input
                checked={editForm.is_active}
                onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })}
                type="checkbox"
              />
              <span>Active</span>
            </label>
            <button className="button-secondary" type="submit">Update selected player</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
