import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseResponse } from "../lib/types";

const blankHole = (index: number) => ({ hole_number: index + 1, par: 4, stroke_index: index + 1, distance: 320 });

export function AdminCoursesPage() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [name, setName] = useState("");
  const [slope, setSlope] = useState(113);
  const [rating, setRating] = useState(72);
  const [holes, setHoles] = useState(Array.from({ length: 18 }, (_, index) => blankHole(index)));
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setCourses(await api.adminCourses(token));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    try {
      const course = await api.createCourse({ name, slope_rating: slope, course_rating: rating }, token);
      await api.replaceCourseHoles(course.id, holes, token);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    }
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Course architect</p>
        <h2>Create course</h2>
        <form className="stack-form" onSubmit={submit}>
          <label className="field-label">
            Course name
            <input placeholder="e.g. Augusta National" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field-label">
            Slope rating (55–155)
            <input type="number" min={55} max={155} value={slope} onChange={(event) => setSlope(Number(event.target.value))} />
          </label>
          <label className="field-label">
            Course rating (50–85)
            <input type="number" min={50} max={85} step={0.1} value={rating} onChange={(event) => setRating(Number(event.target.value))} />
          </label>
          <div className="hole-grid">
            {holes.map((hole, index) => (
              <div className="hole-grid__cell" key={hole.hole_number}>
                <strong>Hole {hole.hole_number}</strong>
                <label className="field-label">
                  Par
                  <input type="number" min={3} max={7} value={hole.par} onChange={(event) => setHoles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, par: Number(event.target.value) } : item))} />
                </label>
                <label className="field-label">
                  Stroke index
                  <input type="number" min={1} max={18} value={hole.stroke_index} onChange={(event) => setHoles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, stroke_index: Number(event.target.value) } : item))} />
                </label>
                <label className="field-label">
                  Distance (m)
                  <input type="number" min={1} value={hole.distance} onChange={(event) => setHoles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, distance: Number(event.target.value) } : item))} />
                </label>
              </div>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button-primary" type="submit">Save course</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Library</p>
        <h2>Configured courses</h2>
        <div className="list-stack">
          {courses.map((course) => (
            <article className="selection-row" key={course.id}>
              <span>{course.name}</span>
              <small>{course.holes.length} holes · slope {course.slope_rating}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
