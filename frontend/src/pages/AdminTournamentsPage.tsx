import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseResponse, PlayerResponse, RoundResponse, TournamentResponse } from "../lib/types";
import { t } from "../lib/i18n";

type RoundDraft = {
  name: string;
  course_id: string;
  date: string;
  player_ids: string[];
};

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function roundLabel(round: Pick<RoundResponse, "round_number" | "name">) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

export function AdminTournamentsPage() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [rounds, setRounds] = useState<RoundResponse[]>([]);

  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  // Create tournament form
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Roster
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterSuccess, setRosterSuccess] = useState(false);

  // Rounds
  const [roundForm, setRoundForm] = useState<RoundDraft>({ name: "", course_id: "", date: "", player_ids: [] });
  const [roundDrafts, setRoundDrafts] = useState<Record<string, RoundDraft>>({});
  const [roundError, setRoundError] = useState<string | null>(null);
  const [roundSuccess, setRoundSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    const [nextTournaments, nextPlayers, nextCourses, nextRounds] = await Promise.all([
      api.adminTournaments(token),
      api.adminPlayers(token),
      api.adminCourses(token),
      api.adminRounds(token),
    ]);
    setTournaments(nextTournaments);
    setPlayers(nextPlayers.filter((p) => p.role === "player"));
    setCourses(nextCourses);
    setRounds(nextRounds);
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
    setRoundError(null);
    setRoundSuccess(null);
    setRoundForm({ name: "", course_id: "", date: "", player_ids: tournament ? tournament.player_ids : [] });
  }, [selectedTournamentId, tournaments]);

  useEffect(() => {
    setRoundForm((current) => ({ ...current, player_ids: selectedPlayers }));
  }, [selectedPlayers]);

  useEffect(() => {
    setRoundDrafts(() => {
      const next: Record<string, RoundDraft> = {};
      rounds
        .filter((round) => round.tournament_id === selectedTournamentId)
        .forEach((round) => {
          next[round.id] = {
            name: round.name ?? "",
            course_id: round.course_id,
            date: round.date,
            player_ids: round.player_ids?.length ? round.player_ids : selectedPlayers,
          };
        });
      return next;
    });
  }, [rounds, selectedTournamentId, selectedPlayers]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCreateError(null);
    try {
      const created = await api.createTournament({ name, date }, token);
      setName("");
      setDate("");
      const next = await load();
      if (next) setSelectedTournamentId(created.id);
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
      const next = await load();
      const updated = next?.find((t) => t.id === selectedTournamentId);
      if (updated) setSelectedPlayers(updated.player_ids);
      setRosterSuccess(true);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Failed to save roster");
    }
  };

  const createRound = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedTournamentId) return;
    setRoundError(null);
    setRoundSuccess(null);
    const tournamentRounds = rounds.filter((r) => r.tournament_id === selectedTournamentId);
    try {
      await api.createRound({
        tournament_id: selectedTournamentId,
        course_id: roundForm.course_id,
        round_number: tournamentRounds.length + 1,
        name: roundForm.name || null,
        date: roundForm.date,
        player_ids: roundForm.player_ids,
      }, token);
      setRoundForm({ name: "", course_id: "", date: "", player_ids: selectedPlayers });
      await load();
    } catch (err) {
      setRoundError(err instanceof Error ? err.message : "Failed to create round");
    }
  };

  const saveRound = async (roundId: string) => {
    if (!token) return;
    const draft = roundDrafts[roundId];
    if (!draft) return;
    setRoundError(null);
    setRoundSuccess(null);
    try {
      await api.updateRound(roundId, {
        name: draft.name || null,
        course_id: draft.course_id,
        date: draft.date,
        player_ids: draft.player_ids,
      }, token);
      setRoundSuccess("Round saved");
      await load();
    } catch (err) {
      setRoundError(err instanceof Error ? err.message : "Failed to save round");
    }
  };

  const lockRound = async (roundId: string) => {
    if (!token) return;
    try {
      await api.lockRound(roundId, token);
      await load();
    } catch (err) {
      setRoundError(err instanceof Error ? err.message : "Failed to lock round");
    }
  };

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId);
  const tournamentRounds = rounds
    .filter((r) => r.tournament_id === selectedTournamentId)
    .sort((a, b) => a.round_number - b.round_number);
  const rosterPlayers = players.filter((player) => selectedPlayers.includes(player.id));

  return (
    <div className="admin-grid">

      {/* Tournament selector — full width at the top */}
      <section className="detail-panel" style={{ gridColumn: "1 / -1" }}>
        <p className="eyebrow">{t('tournaments.workingEyebrow')}</p>
        <label className="field-label">
          Select tournament to manage
          <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)}>
            <option value="">— choose a tournament —</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.date})</option>
            ))}
          </select>
        </label>
      </section>

      {/* Left: Create new tournament */}
      <section className="detail-panel">
        <p className="eyebrow">{t('tournaments.eyebrow')}</p>
        <h2>{t('tournaments.createTitle')}</h2>
        <form className="stack-form" onSubmit={create}>
          <label className="field-label">
            Tournament name
            <input placeholder="e.g. The Douchebags Open 2025" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button className="button-primary" type="submit">{t('tournaments.create')}</button>
        </form>
      </section>

      {/* Right: Roster for selected tournament */}
      {selectedTournament ? (
        <section className="detail-panel">
          <p className="eyebrow">{t('tournaments.rosterEyebrow')} — {selectedTournament.name}</p>
          <h2>{t('tournaments.rosterTitle')}</h2>
          <p className="eyebrow" style={{ marginTop: "0.5rem" }}>
            {selectedPlayers.length} of {players.length} players assigned
          </p>
          <div className="list-stack">
            {players.map((player) => (
              <label className="selection-row" key={player.id}>
                <input
                  checked={selectedPlayers.includes(player.id)}
                  onChange={() =>
                    setSelectedPlayers((cur) =>
                      cur.includes(player.id) ? cur.filter((id) => id !== player.id) : [...cur, player.id],
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
          {rosterSuccess && <p className="form-success">{t('tournaments.rosterSaved')}</p>}
          <button className="button-primary" type="button" onClick={saveRoster}>{t('tournaments.saveRoster')}</button>
        </section>
      ) : (
        <section className="detail-panel">
          <p className="eyebrow">{t('tournaments.rosterEyebrow')}</p>
          <h2>{t('tournaments.rosterTitle')}</h2>
          <p style={{ color: "var(--text-muted, #8899aa)", margin: "0.5rem 0 0" }}>
            Select a tournament above to manage its roster.
          </p>
        </section>
      )}

      {/* Full-width: Rounds for selected tournament */}
      {selectedTournament && (
        <section className="detail-panel" style={{ gridColumn: "1 / -1" }}>
          <p className="eyebrow">Rounds — {selectedTournament.name}</p>
          <h2>Manage rounds</h2>
          <div className="admin-grid" style={{ padding: 0 }}>
            <div>
              <h3 style={{ marginBottom: "0.75rem" }}>Add round {tournamentRounds.length + 1}</h3>
              <form className="stack-form" onSubmit={createRound}>
                <label className="field-label">
                  Round name
                  <input
                    placeholder={`e.g. Day 1, Front 9, Sunday final`}
                    value={roundForm.name}
                    onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                  />
                </label>
                <label className="field-label">
                  Course
                  <select
                    value={roundForm.course_id}
                    onChange={(e) => setRoundForm({ ...roundForm, course_id: e.target.value })}
                    required
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Date
                  <input
                    type="date"
                    value={roundForm.date}
                    onChange={(e) => setRoundForm({ ...roundForm, date: e.target.value })}
                    required
                  />
                </label>
                <div className="field-label">
                  Players for this round
                  <div className="list-stack" style={{ marginTop: "0.5rem" }}>
                    {rosterPlayers.length === 0 ? (
                      <p style={{ margin: 0, color: "var(--text-muted, #8899aa)" }}>Add players to the tournament roster first.</p>
                    ) : (
                      rosterPlayers.map((player) => (
                        <label className="selection-row" key={player.id}>
                          <input
                            checked={roundForm.player_ids.includes(player.id)}
                            onChange={() => setRoundForm({ ...roundForm, player_ids: toggleId(roundForm.player_ids, player.id) })}
                            type="checkbox"
                          />
                          <span>{player.name}</span>
                          <small>hcp {player.hcp}</small>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                {roundError && <p className="form-error">{roundError}</p>}
                {roundSuccess && <p className="form-success">{roundSuccess}</p>}
                <button className="button-primary" disabled={roundForm.player_ids.length === 0} type="submit">Add round</button>
              </form>
            </div>
            <div>
              <h3 style={{ marginBottom: "0.75rem" }}>
                {tournamentRounds.length === 0 ? "No rounds yet" : `${tournamentRounds.length} round${tournamentRounds.length > 1 ? "s" : ""}`}
              </h3>
              <div className="list-stack">
                {tournamentRounds.map((round) => {
                  const course = courses.find((c) => c.id === round.course_id);
                  const draft = roundDrafts[round.id] ?? {
                    name: round.name ?? "",
                    course_id: round.course_id,
                    date: round.date,
                    player_ids: round.player_ids ?? [],
                  };
                  return (
                    <article className="detail-panel detail-panel--nested" key={round.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div>
                          <strong>{roundLabel(round)}</strong>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--text-muted, #8899aa)" }}>
                            {round.date} · {course?.name ?? "Unknown course"}
                          </p>
                        </div>
                        {round.status === "locked" ? (
                          <span className="button-ghost" style={{ cursor: "default", opacity: 0.5 }}>Locked</span>
                        ) : (
                          <button className="button-ghost" onClick={() => lockRound(round.id)} type="button">
                            Lock round
                          </button>
                        )}
                      </div>
                      <div className="stack-form" style={{ marginTop: "1rem" }}>
                        <label className="field-label">
                          Round name
                          <input
                            value={draft.name}
                            onChange={(e) => setRoundDrafts({
                              ...roundDrafts,
                              [round.id]: { ...draft, name: e.target.value },
                            })}
                          />
                        </label>
                        <label className="field-label">
                          Course
                          <select
                            value={draft.course_id}
                            onChange={(e) => setRoundDrafts({
                              ...roundDrafts,
                              [round.id]: { ...draft, course_id: e.target.value },
                            })}
                          >
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field-label">
                          Date
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) => setRoundDrafts({
                              ...roundDrafts,
                              [round.id]: { ...draft, date: e.target.value },
                            })}
                          />
                        </label>
                        <div className="field-label">
                          Players in this round
                          <div className="list-stack" style={{ marginTop: "0.5rem" }}>
                            {rosterPlayers.map((player) => (
                              <label className="selection-row" key={player.id}>
                                <input
                                  checked={draft.player_ids.includes(player.id)}
                                  onChange={() => setRoundDrafts({
                                    ...roundDrafts,
                                    [round.id]: { ...draft, player_ids: toggleId(draft.player_ids, player.id) },
                                  })}
                                  type="checkbox"
                                />
                                <span>{player.name}</span>
                                <small>hcp {player.hcp}</small>
                              </label>
                            ))}
                          </div>
                        </div>
                        <button className="button-secondary" disabled={draft.player_ids.length === 0} onClick={() => saveRound(round.id)} type="button">
                          Save round
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
