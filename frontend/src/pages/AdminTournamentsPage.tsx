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
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterSuccess, setRosterSuccess] = useState(false);

  const load = async () => {
    if (!token) return;
    const [nextTournaments, nextPlayers] = await Promise.all([api.adminTournaments(token), api.adminPlayers(token)]);
    setTournaments(nextTournaments);
    setPlayers(nextPlayers.filter((item) => item.role === "player"));
    return nextTournaments;
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    const tournament = tournaments.find((t) => t.id === selectedTournamentId);
    setSelectedPlayers(tournament ? tournament.player_ids : []);
    setRosterSuccess(false);
    setRosterError(null);
  }, [selectedTournamentId, tournaments]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCreateError(null);
    try {
      await api.createTournament({ name, date }, token);
      setName("");
      setDate("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create tournament");
    }
  };

  const saveRoster = async () => {
    if (!token || !selectedTournamentId) return;
    setRosterError(null);
    setRosterSuccess(false);
    try {
      await api.updateRoster(selectedTournamentId, selectedPlayers, token);
      const nextTournaments = await load();
      const updated = nextTournaments?.find((t) => t.id === selectedTournamentId);
      if (updated) setSelectedPlayers(updated.player_ids);
      setRosterSuccess(true);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Failed to save roster");
    }
  };

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId);

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Event desk</p>
        <h2>Create tournament</h2>
        <form className="stack-form" onSubmit={create}>
          <label className="field-label">
            Tournament name
            <input placeholder="e.g. The Douchebags Open 2025" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field-label">
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button className="button-primary" type="submit">Create event</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Roster</p>
        <h2>Assign players</h2>
        <label className="field-label">
          Tournament
          <select value={selectedTournamentId} onChange={(event) => setSelectedTournamentId(event.target.value)}>
            <option value="">Select tournament</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
            ))}
          </select>
        </label>
        {selectedTournament && (
          <>
            <p className="eyebrow" style={{ marginTop: "1rem" }}>
              {selectedPlayers.length} of {players.length} players assigned
            </p>
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
                  <small>hcp {player.hcp}</small>
                </label>
              ))}
            </div>
            {rosterError && <p className="form-error">{rosterError}</p>}
            {rosterSuccess && <p className="form-success">Roster saved</p>}
            <button className="button-primary" type="button" onClick={saveRoster}>Save roster</button>
          </>
        )}
      </section>
    </div>
  );
}
