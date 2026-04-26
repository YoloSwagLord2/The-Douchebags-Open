import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseResponse, RoundResponse, TournamentResponse } from "../lib/types";
import { t } from "../lib/i18n";

export function AdminRoundsPage() {
  const { token } = useAuth();
  const [rounds, setRounds] = useState<RoundResponse[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [form, setForm] = useState({ tournament_id: "", course_id: "", round_number: 1, date: "" });

  const load = async () => {
    if (!token) return;
    const [roundData, tournamentData, courseData] = await Promise.all([
      api.adminRounds(token),
      api.adminTournaments(token),
      api.adminCourses(token),
    ]);
    setRounds(roundData);
    setTournaments(tournamentData);
    setCourses(courseData);
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
              <strong>{t('rounds.round')} {round.round_number}</strong>
              <p>{round.date}</p>
              <button className="button-ghost" onClick={() => token && api.lockRound(round.id, token).then(load)} type="button">
                {round.status === "locked" ? t('rounds.locked') : t('rounds.lock')}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
