import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PlayerResponse, TournamentResponse } from "../lib/types";

export function AdminTournamentsPage() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const load = async () => {
    if (!token) return;
    const [nextTournaments, nextPlayers] = await Promise.all([api.adminTournaments(token), api.adminPlayers(token)]);
    setTournaments(nextTournaments);
    setPlayers(nextPlayers.filter((item) => item.role === "player"));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createTournament({ name, date }, token);
    setName("");
    setDate("");
    await load();
  };

  const saveRoster = async () => {
    if (!token || !selectedTournament) return;
    await api.updateRoster(selectedTournament, selectedPlayers, token);
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Event desk</p>
        <h2>Create tournament</h2>
        <form className="stack-form" onSubmit={create}>
          <input placeholder="Tournament name" value={name} onChange={(event) => setName(event.target.value)} />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="button-primary" type="submit">Create event</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Roster</p>
        <h2>Assign players</h2>
        <select value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)}>
          <option value="">Select tournament</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
          ))}
        </select>
        <div className="list-stack">
          {players.map((player) => (
            <label className="selection-row" key={player.id}>
              <input
                checked={selectedPlayers.includes(player.id)}
                onChange={() =>
                  setSelectedPlayers((current) =>
                    current.includes(player.id)
                      ? current.filter((item) => item !== player.id)
                      : [...current, player.id],
                  )
                }
                type="checkbox"
              />
              <span>{player.name}</span>
            </label>
          ))}
        </div>
        <button className="button-primary" type="button" onClick={saveRoster}>Save roster</button>
      </section>
    </div>
  );
}
