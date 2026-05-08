import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PlayerResponse } from "../lib/types";
import { t, parseErrorMessage } from "../lib/i18n";

const initialForm = { name: "", username: "", email: "", password: "", hcp: 18, role: "player", may_edit_pins: false };

const playerInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export function AdminPlayersPage() {
  const { token } = useAuth();
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [form, setForm] = useState(initialForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    hcp: 18,
    role: "player",
    is_active: true,
    may_edit_pins: false,
    password: "",
    age: "" as number | "",
    bio: "",
    signature_move: "",
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
      may_edit_pins: selectedPlayer.may_edit_pins,
      password: "",
      age: selectedPlayer.age ?? "",
      bio: selectedPlayer.bio ?? "",
      signature_move: selectedPlayer.signature_move ?? "",
    });
  }, [selectedPlayer]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCreateError(null);
    try {
      await api.createAdminPlayer(form, token);
      setForm(initialForm);
      await load();
    } catch (err) {
      setCreateError(parseErrorMessage(err));
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!token || !selectedPlayerId) return;
    await api.uploadPlayerPhoto(selectedPlayerId, file, token);
    await load();
  };

  const updateSelectedPlayer = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedPlayerId) return;
    setEditError(null);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      if (!editForm.password) delete payload.password;
      if (editForm.age === "") delete payload.age;
      if (!editForm.bio) delete payload.bio;
      if (!editForm.signature_move) delete payload.signature_move;
      await api.updateAdminPlayer(selectedPlayerId, payload, token);
      setEditForm((f) => ({ ...f, password: "" }));
      await load();
    } catch (err) {
      setEditError(parseErrorMessage(err));
    }
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Player setup</p>
        <h2>{t('players.createTitle')}</h2>
        <form className="stack-form" onSubmit={submit}>
          <input placeholder={t('players.name')} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <input placeholder={t('auth.email')} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input placeholder={t('auth.password')} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <input placeholder={t('players.hcp')} type="number" value={form.hcp} onChange={(event) => setForm({ ...form, hcp: Number(event.target.value) })} />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="player">{t('players.player')}</option>
            <option value="admin">{t('players.admin')}</option>
          </select>
          <label className="selection-row">
            <input
              checked={form.may_edit_pins}
              onChange={(event) => setForm({ ...form, may_edit_pins: event.target.checked })}
              type="checkbox"
            />
            <span>May edit pins</span>
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button className="button-primary" type="submit">{t('players.create')}</button>
        </form>
      </section>

      <section className="detail-panel">
        <p className="eyebrow">Roster</p>
        <h2>{t('players.existingPlayers')}</h2>
        <div className="list-stack">
          {players.map((player) => (
            <label className="selection-row player-selection-row" key={player.id}>
              <input
                checked={selectedPlayerId === player.id}
                onChange={() => setSelectedPlayerId(player.id)}
                type="radio"
              />
              {player.photo_avatar_url ? (
                <img className="player-selection-row__thumb" src={player.photo_avatar_url} alt={player.name} />
              ) : (
                <span className="player-selection-row__thumb player-selection-row__thumb--fallback" aria-hidden="true">
                  {playerInitials(player.name)}
                </span>
              )}
              <span className="player-selection-row__copy">
                <span>{player.name}</span>
                <small>{player.role} · {t('players.hcp')} {player.hcp}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="upload-box">
          {t('players.photoUpload')}
          <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadPhoto(event.target.files[0])} />
        </label>
        {selectedPlayer ? (
          <form className="stack-form" onSubmit={updateSelectedPlayer}>
            <label className="field-label">{t('players.name')}<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
            <label className="field-label">{t('auth.email')}<input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></label>
            <label className="field-label">{t('players.newPassword')}<input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /></label>
            <label className="field-label">{t('players.hcp')}<input type="number" value={editForm.hcp} onChange={(event) => setEditForm({ ...editForm, hcp: Number(event.target.value) })} /></label>
            <label className="field-label">Role
              <select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
                <option value="player">{t('players.player')}</option>
                <option value="admin">{t('players.admin')}</option>
              </select>
            </label>
            <label className="selection-row">
              <input checked={editForm.is_active} onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })} type="checkbox" />
              <span>{t('players.active')}</span>
            </label>
            <label className="selection-row">
              <input checked={editForm.may_edit_pins} onChange={(event) => setEditForm({ ...editForm, may_edit_pins: event.target.checked })} type="checkbox" />
              <span>May edit pins</span>
            </label>
            <label className="field-label">Age
              <input type="number" min={1} max={120} value={editForm.age} onChange={(event) => setEditForm({ ...editForm, age: event.target.value === "" ? "" : Number(event.target.value) })} />
            </label>
            <label className="field-label">Bio
              <textarea value={editForm.bio} rows={3} onChange={(event) => setEditForm({ ...editForm, bio: event.target.value })} />
            </label>
            <label className="field-label">Signature move
              <input value={editForm.signature_move} onChange={(event) => setEditForm({ ...editForm, signature_move: event.target.value })} />
            </label>
            {editError && <p className="form-error">{editError}</p>}
            <button className="button-secondary" type="submit">{t('players.update')}</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
