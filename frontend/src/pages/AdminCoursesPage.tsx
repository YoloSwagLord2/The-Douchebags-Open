import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseResponse } from "../lib/types";
import { t } from "../lib/i18n";

type HoleRow = {
  id?: string;
  hole_number: number;
  par: number;
  stroke_index: number;
  distance: number;
  image_url?: string | null;
};

const blankHole = (index: number): HoleRow => ({ hole_number: index + 1, par: 4, stroke_index: index + 1, distance: 320 });

const normalizeHoleRows = (rows: HoleRow[], count: number): HoleRow[] =>
  Array.from({ length: count }, (_, index) => {
    const existing = rows[index];
    return {
      ...(existing ?? blankHole(index)),
      hole_number: index + 1,
      stroke_index: Math.min(existing?.stroke_index ?? index + 1, count),
    };
  });

function HoleImageField({
  hole,
  token,
  onCourseUpdate,
}: {
  hole: HoleRow;
  token: string;
  onCourseUpdate: (course: CourseResponse) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hole.id) {
    return <p className="hole-image-hint">{t('courses.holeImageSaveFirst')}</p>;
  }

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.uploadHoleImage(hole.id!, file, token);
      onCourseUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.deleteHoleImage(hole.id!, token);
      onCourseUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hole-image-field">
      {hole.image_url ? (
        <img className="hole-image-field__thumb" src={hole.image_url} alt={`Hole ${hole.hole_number}`} />
      ) : (
        <div className="hole-image-field__empty">{t('courses.holeImageNone')}</div>
      )}
      <div className="hole-image-field__actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "…" : hole.image_url ? t('courses.holeImageReplace') : t('courses.holeImageUpload')}
        </button>
        {hole.image_url && (
          <button type="button" className="button-ghost" onClick={remove} disabled={busy}>
            {t('courses.holeImageRemove')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function HoleEditor({
  holes,
  setHoles,
  token,
  onCourseUpdate,
}: {
  holes: HoleRow[];
  setHoles: React.Dispatch<React.SetStateAction<HoleRow[]>>;
  token?: string | null;
  onCourseUpdate?: (course: CourseResponse) => void;
}) {
  return (
    <div className="hole-grid">
      {holes.map((hole, index) => (
        <div className="hole-grid__cell" key={hole.hole_number}>
          <strong>{t('courses.hole')} {hole.hole_number}</strong>
          <label className="field-label">
            {t('courses.holePar')}
            <input
              type="number" min={3} max={7} value={hole.par}
              onChange={(e) => setHoles((cur) => cur.map((h, i) => i === index ? { ...h, par: Number(e.target.value) } : h))}
            />
          </label>
          <label className="field-label">
            {t('courses.holeStrokeIndex')}
            <input
              type="number" min={1} max={holes.length} value={hole.stroke_index}
              onChange={(e) => setHoles((cur) => cur.map((h, i) => i === index ? { ...h, stroke_index: Number(e.target.value) } : h))}
            />
          </label>
          <label className="field-label">
            {t('courses.holeDistance')}
            <input
              type="number" min={1} value={hole.distance}
              onChange={(e) => setHoles((cur) => cur.map((h, i) => i === index ? { ...h, distance: Number(e.target.value) } : h))}
            />
          </label>
          {token && onCourseUpdate && (
            <HoleImageField hole={hole} token={token} onCourseUpdate={onCourseUpdate} />
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminCoursesPage() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<CourseResponse[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [slope, setSlope] = useState(113);
  const [rating, setRating] = useState(72);
  const [holes, setHoles] = useState<HoleRow[]>(Array.from({ length: 18 }, (_, i) => blankHole(i)));
  const [holeCount, setHoleCount] = useState(18);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editSlope, setEditSlope] = useState(113);
  const [editRating, setEditRating] = useState(72);
  const [editHoles, setEditHoles] = useState<HoleRow[]>([]);
  const [editHoleCount, setEditHoleCount] = useState(18);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setCourses(await api.adminCourses(token));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;
    setEditName(course.name);
    setEditSlope(course.slope_rating);
    setEditRating(course.course_rating);
    const courseHoles = [...course.holes]
      .sort((a, b) => a.hole_number - b.hole_number)
      .map((h) => ({
        id: h.id,
        hole_number: h.hole_number,
        par: h.par,
        stroke_index: h.stroke_index,
        distance: h.distance,
        image_url: h.image_url ?? null,
      }));
    setEditHoleCount(courseHoles.length || 18);
    setEditHoles(courseHoles);
    setEditError(null);
    setDeleteError(null);
    setEditSuccess(false);
  }, [selectedCourseId]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCreateError(null);
    try {
      const course = await api.createCourse({ name, slope_rating: slope, course_rating: rating }, token);
      await api.replaceCourseHoles(course.id, holes, token);
      setName("");
      setHoleCount(18);
      setHoles(Array.from({ length: 18 }, (_, i) => blankHole(i)));
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to save course");
    }
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedCourseId) return;
    setEditError(null);
    setEditSuccess(false);
    try {
      await api.updateCourse(selectedCourseId, { name: editName, slope_rating: editSlope, course_rating: editRating }, token);
      const holesPayload = editHoles.map(({ hole_number, par, stroke_index, distance }) => ({
        hole_number,
        par,
        stroke_index,
        distance,
      }));
      await api.replaceCourseHoles(selectedCourseId, holesPayload, token);
      setEditSuccess(true);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update course");
    }
  };

  const applyCourseUpdate = (updated: CourseResponse) => {
    const courseHoles = [...updated.holes]
      .sort((a, b) => a.hole_number - b.hole_number)
      .map((h) => ({
        id: h.id,
        hole_number: h.hole_number,
        par: h.par,
        stroke_index: h.stroke_index,
        distance: h.distance,
        image_url: h.image_url ?? null,
      }));

    setCourses((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
    setEditHoleCount(courseHoles.length || 18);
    setEditHoles(courseHoles);
  };

  const deleteSelectedCourse = async () => {
    if (!token || !selectedCourseId) return;
    const confirmed = window.confirm(t('courses.deleteConfirm'));
    if (!confirmed) return;
    setDeleteError(null);
    setEditError(null);
    setEditSuccess(false);
    try {
      await api.deleteCourse(selectedCourseId, token);
      setSelectedCourseId("");
      setEditHoles([]);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">{t('courses.eyebrow')}</p>
        <h2>{t('courses.createTitle')}</h2>
        <form className="stack-form" onSubmit={create}>
          <label className="field-label">
            Course name
            <input placeholder="e.g. Augusta National" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">
            Slope rating (55–155)
            <input type="number" min={55} max={155} value={slope} onChange={(e) => setSlope(Number(e.target.value))} />
          </label>
          <label className="field-label">
            Course rating (50–85)
            <input type="number" min={50} max={85} step={0.1} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          </label>
          <label className="field-label">
            {t('courses.holeCount')}
            <select
              value={holeCount}
              onChange={(event) => {
                const nextCount = Number(event.target.value);
                setHoleCount(nextCount);
                setHoles((cur) => normalizeHoleRows(cur, nextCount));
              }}
            >
              <option value={9}>{t('courses.nineHoles')}</option>
              <option value={18}>{t('courses.eighteenHoles')}</option>
            </select>
          </label>
          <HoleEditor holes={holes} setHoles={setHoles} />
          {createError && <p className="form-error">{createError}</p>}
          <button className="button-primary" type="submit">{t('courses.save')}</button>
        </form>
      </section>

      <section className="detail-panel">
        <p className="eyebrow">{t('courses.libraryEyebrow')}</p>
        <h2>{t('courses.libraryTitle')}</h2>
        <div className="list-stack">
          {courses.map((course) => (
            <label className="selection-row" key={course.id}>
              <input
                checked={selectedCourseId === course.id}
                onChange={() => setSelectedCourseId(course.id)}
                type="radio"
              />
              <span>{course.name}</span>
              <small>{course.holes.length} holes · slope {course.slope_rating}</small>
            </label>
          ))}
        </div>
      </section>

      {selectedCourse && (
        <section className="detail-panel" style={{ gridColumn: "1 / -1" }}>
          <p className="eyebrow">Editing</p>
          <h2>{selectedCourse.name}</h2>
          <form className="stack-form" onSubmit={submitEdit}>
            <label className="field-label">
              Course name
              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label className="field-label">
              Slope rating (55–155)
              <input type="number" min={55} max={155} value={editSlope} onChange={(e) => setEditSlope(Number(e.target.value))} />
            </label>
            <label className="field-label">
              Course rating (50–85)
              <input type="number" min={50} max={85} step={0.1} value={editRating} onChange={(e) => setEditRating(Number(e.target.value))} />
            </label>
            <label className="field-label">
              {t('courses.holeCount')}
              <select
                value={editHoleCount}
                onChange={(event) => {
                  const nextCount = Number(event.target.value);
                  setEditHoleCount(nextCount);
                  setEditHoles((cur) => normalizeHoleRows(cur, nextCount));
                }}
              >
                <option value={9}>{t('courses.nineHoles')}</option>
                <option value={18}>{t('courses.eighteenHoles')}</option>
              </select>
            </label>
            <HoleEditor holes={editHoles} setHoles={setEditHoles} token={token} onCourseUpdate={applyCourseUpdate} />
            {editError && <p className="form-error">{editError}</p>}
            {deleteError && <p className="form-error">{deleteError}</p>}
            {editSuccess && <p className="form-success">{t('courses.updated')}</p>}
            <div className="form-actions">
              <button className="button-secondary" type="submit">{t('courses.update')}</button>
              <button className="button-ghost" onClick={deleteSelectedCourse} type="button">{t('courses.delete')}</button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
