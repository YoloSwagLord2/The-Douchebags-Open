import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseResponse, PlayerResponse, RoundResponse, ScorecardResponse, TournamentResponse } from "../lib/types";
import { t } from "../lib/i18n";

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

export function AdminRoundsPage() {
  const { token } = useAuth();
  const [rounds, setRounds] = useState<RoundResponse[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [form, setForm] = useState({ tournament_id: "", course_id: "", round_number: 1, name: "", date: "" });
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaving, setScoreSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    const [roundData, tournamentData, courseData, playerData] = await Promise.all([
      api.adminRounds(token),
      api.adminTournaments(token),
      api.adminCourses(token),
      api.adminPlayers(token),
    ]);
    setRounds(roundData);
    setTournaments(tournamentData);
    setCourses(courseData);
    setPlayers(playerData);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createRound(form, token);
    await load();
  };

  const selectedRound = rounds.find((round) => round.id === selectedRoundId);
  const selectedTournament = tournaments.find((item) => item.id === selectedRound?.tournament_id);
  const playerIds = selectedRound?.player_ids.length ? selectedRound.player_ids : selectedTournament?.player_ids ?? [];
  const availablePlayers = players.filter((player) => playerIds.includes(player.id));

  const loadScorecard = async (roundId = selectedRoundId, playerId = selectedPlayerId) => {
    if (!token || !roundId || !playerId) {
      setScorecard(null);
      setDraftScores({});
      return;
    }
    setScoreError(null);
    setScoreSaved(false);
    const next = await api.adminPlayerScorecard(roundId, playerId, token);
    setScorecard(next);
    setDraftScores(
      Object.fromEntries(next.holes.map((hole) => [hole.hole_id, hole.strokes == null ? "" : String(hole.strokes)])),
    );
  };

  useEffect(() => {
    if (selectedPlayerId && !availablePlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId("");
      setScorecard(null);
      setDraftScores({});
    }
  }, [availablePlayers, selectedPlayerId]);

  useEffect(() => {
    loadScorecard().catch((err) => {
      setScorecard(null);
      setDraftScores({});
      setScoreError(err instanceof Error ? err.message : "Failed to load scorecard");
    });
  }, [selectedRoundId, selectedPlayerId, token]);

  const saveScorecard = async () => {
    if (!token || !selectedRoundId || !selectedPlayerId || !scorecard) return;
    const scores = scorecard.holes
      .map((hole) => ({ hole_id: hole.hole_id, strokes: Number(draftScores[hole.hole_id]) }))
      .filter((score) => Number.isInteger(score.strokes) && score.strokes >= 1);
    setScoreSaving(true);
    setScoreError(null);
    setScoreSaved(false);
    try {
      await api.adminOverrideScorecard(selectedRoundId, selectedPlayerId, scores, token);
      await loadScorecard();
      setScoreSaved(true);
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "Failed to save scorecard");
    } finally {
      setScoreSaving(false);
    }
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">{t('rounds.eyebrow')}</p>
        <h2>{t('rounds.createTitle')}</h2>
        <form className="stack-form" onSubmit={submit}>
          <select value={form.tournament_id} onChange={(event) => setForm({ ...form, tournament_id: event.target.value })}>
            <option value="">{t('rounds.selectTournament')}</option>
            {tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })}>
            <option value="">{t('rounds.selectCourse')}</option>
            {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input type="number" value={form.round_number} onChange={(event) => setForm({ ...form, round_number: Number(event.target.value) })} />
          <input placeholder="Round name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <button className="button-primary" type="submit">{t('rounds.create')}</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">{t('rounds.controlEyebrow')}</p>
        <h2>{t('rounds.title')}</h2>
        <div className="list-stack">
          {rounds.map((round) => (
            <article className="detail-panel detail-panel--nested" key={round.id}>
              <strong>{displayRoundName(round)}</strong>
              <p>{round.date}</p>
              <button className="button-ghost" onClick={() => token && api.lockRound(round.id, token).then(load)} type="button">
                {round.status === "locked" ? t('rounds.locked') : t('rounds.lock')}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="detail-panel admin-score-editor">
        <p className="eyebrow">Score corrections</p>
        <h2>Edit player score</h2>
        <div className="stack-form">
          <select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)}>
            <option value="">Select round</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {displayRoundName(round)} - {round.date}
              </option>
            ))}
          </select>
          <select
            value={selectedPlayerId}
            onChange={(event) => setSelectedPlayerId(event.target.value)}
            disabled={!selectedRoundId}
          >
            <option value="">Select player</option>
            {availablePlayers.map((player) => (
              <option key={player.id} value={player.id}>{player.name}</option>
            ))}
          </select>
        </div>

        {scorecard ? (
          <>
            <div className="admin-score-grid">
              {scorecard.holes.map((hole) => (
                <label className="admin-score-cell" key={hole.hole_id}>
                  <span>Hole {hole.hole_number}</span>
                  <small>Par {hole.par} · STB {hole.stableford_points ?? "-"}</small>
                  <input
                    min={1}
                    max={25}
                    type="number"
                    value={draftScores[hole.hole_id] ?? ""}
                    onChange={(event) => setDraftScores({ ...draftScores, [hole.hole_id]: event.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="totals-strip admin-score-totals">
              <div>
                <span>{t('score.gross')}</span>
                <strong>{scorecard.totals.gross_strokes}</strong>
              </div>
              <div>
                <span>{t('score.net')}</span>
                <strong>{scorecard.totals.net_strokes}</strong>
              </div>
              <div>
                <span>{t('score.stableford')}</span>
                <strong>{scorecard.totals.official_stableford}</strong>
              </div>
              <div>
                <span>{t('score.bonus')}</span>
                <strong>{scorecard.totals.bonus_points}</strong>
              </div>
            </div>
            {scoreError ? <p className="form-error">{scoreError}</p> : null}
            {scoreSaved ? <p className="form-success">Scorecard saved</p> : null}
            <button className="button-primary" onClick={saveScorecard} disabled={scoreSaving} type="button">
              {scoreSaving ? "Saving..." : "Save scorecard"}
            </button>
          </>
        ) : (
          <p className="muted-copy">Select a round and player to edit their hole scores.</p>
        )}
      </section>
    </div>
  );
}
