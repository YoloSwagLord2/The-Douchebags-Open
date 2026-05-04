import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { GalleryUploadModal } from "../components/GalleryUploadModal";
import { Modal } from "../components/Modal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { GalleryComment, GalleryMedia, GalleryMediaType, HoleScorecardResponse, NavigationTournament } from "../lib/types";

function formatDuration(seconds?: number | null) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function GalleryPage() {
  const { token, user } = useAuth();
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();
  const latestRound = navigation[0]?.rounds[0];
  const [items, setItems] = useState<GalleryMedia[]>([]);
  const [selected, setSelected] = useState<GalleryMedia | null>(null);
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [mediaType, setMediaType] = useState<GalleryMediaType | "">("");
  const [roundFilter, setRoundFilter] = useState("");
  const [uploadHoles, setUploadHoles] = useState<HoleScorecardResponse[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rounds = useMemo(() => navigation.flatMap((tournament) => tournament.rounds.map((round) => ({
    ...round,
    tournamentName: tournament.name,
  }))), [navigation]);
  const uploadRoundId = roundFilter || latestRound?.id || "";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.galleryMedia(token, {
        round_id: roundFilter || undefined,
        media_type: mediaType || undefined,
        limit: 72,
      });
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [mediaType, roundFilter, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !selected) {
      setComments([]);
      return;
    }
    api.galleryComments(selected.id, token).then(setComments).catch(() => setComments([]));
  }, [selected, token]);

  useEffect(() => {
    if (!token || !uploadOpen || !uploadRoundId) {
      setUploadHoles([]);
      return;
    }
    api.myScorecard(uploadRoundId, token)
      .then((scorecard) => setUploadHoles(scorecard.holes))
      .catch(() => setUploadHoles([]));
  }, [token, uploadOpen, uploadRoundId]);

  const replaceMedia = (media: GalleryMedia) => {
    setItems((current) => current.map((item) => item.id === media.id ? media : item));
    setSelected((current) => current?.id === media.id ? media : current);
  };

  const toggleLike = async (media: GalleryMedia) => {
    if (!token) return;
    const updated = media.liked_by_me
      ? await api.unlikeGalleryMedia(media.id, token)
      : await api.likeGalleryMedia(media.id, token);
    replaceMedia(updated);
  };

  const postComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selected || !commentDraft.trim()) return;
    const comment = await api.createGalleryComment(selected.id, commentDraft, token);
    setComments((current) => [...current, comment]);
    setCommentDraft("");
    replaceMedia({ ...selected, comment_count: selected.comment_count + 1 });
  };

  const deleteSelected = async () => {
    if (!token || !selected || user?.role !== "admin") return;
    await api.deleteAdminGalleryMedia(selected.id, token);
    setItems((current) => current.filter((item) => item.id !== selected.id));
    setSelected(null);
  };

  const deleteComment = async (commentId: string) => {
    if (!token || !selected || user?.role !== "admin") return;
    await api.deleteAdminGalleryComment(commentId, token);
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    replaceMedia({ ...selected, comment_count: Math.max(0, selected.comment_count - 1) });
  };

  return (
    <div className="stack-layout gallery-page">
      <section className="masthead-panel gallery-masthead">
        <div>
          <p className="eyebrow">Event gallery</p>
          <h2>Photos and videos</h2>
          <p className="hero-subtitle">Player moments from the course, collected as they happen.</p>
        </div>
        {uploadRoundId ? (
          <button className="button-primary" type="button" onClick={() => setUploadOpen(true)}>
            Add media
          </button>
        ) : null}
      </section>

      <section className="gallery-toolbar" aria-label="Gallery filters">
        <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}>
          <option value="">All rounds</option>
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.tournamentName} · {round.name || `Round ${round.round_number}`}
            </option>
          ))}
        </select>
        <div className="segmented-control gallery-type-switch">
          <button className={mediaType === "" ? "is-active" : ""} type="button" onClick={() => setMediaType("")}>All</button>
          <button className={mediaType === "photo" ? "is-active" : ""} type="button" onClick={() => setMediaType("photo")}>Photos</button>
          <button className={mediaType === "video" ? "is-active" : ""} type="button" onClick={() => setMediaType("video")}>Videos</button>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <div className="loading-state">Loading gallery...</div> : null}
      {!loading && !items.length ? (
        <section className="detail-panel">
          <h3>No media yet</h3>
          <p className="hero-subtitle">The first upload will appear here for every logged-in player.</p>
        </section>
      ) : null}

      <section className="gallery-grid">
        {items.map((item) => (
          <button className="gallery-tile" key={item.id} type="button" onClick={() => setSelected(item)}>
            <img src={item.thumbnail_url || item.display_url} alt={item.caption || `Gallery item by ${item.uploader.name}`} />
            <span className="gallery-tile__shade" />
            <span className="gallery-tile__meta">
              <strong>{item.uploader.name}</strong>
              <span>{item.hole_number ? `Hole ${item.hole_number}` : item.round_name}</span>
            </span>
            <span className="gallery-tile__counts">
              {item.media_type === "video" ? <span>{formatDuration(item.duration_seconds) || "Video"}</span> : null}
              <span>{item.like_count} likes</span>
            </span>
          </button>
        ))}
      </section>

      {uploadRoundId ? (
        <GalleryUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          token={token || ""}
          roundId={uploadRoundId}
          holes={uploadHoles}
          onUploaded={(media) => setItems((current) => [media, ...current])}
        />
      ) : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.caption || selected?.round_name || "Gallery media"}
        footer={
          selected ? (
            <>
              {user?.role === "admin" ? (
                <button className="button-ghost" type="button" onClick={deleteSelected}>
                  Delete media
                </button>
              ) : null}
              <button className="button-secondary" type="button" onClick={() => toggleLike(selected)}>
                {selected.liked_by_me ? "Unlike" : "Like"} · {selected.like_count}
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="gallery-detail">
            {selected.media_type === "video" ? (
              <video controls playsInline poster={selected.thumbnail_url || undefined} src={selected.display_url} />
            ) : (
              <img src={selected.display_url} alt={selected.caption || `Gallery item by ${selected.uploader.name}`} />
            )}
            <div className="gallery-detail__meta">
              <strong>{selected.uploader.name}</strong>
              <span>{selected.tournament_name} · {selected.round_name}{selected.hole_number ? ` · Hole ${selected.hole_number}` : ""}</span>
            </div>
            <div className="gallery-comments">
              {comments.map((comment) => (
                <div className="gallery-comment" key={comment.id}>
                  <div>
                    <strong>{comment.author.name}</strong>
                    <p>{comment.body}</p>
                  </div>
                  {user?.role === "admin" ? (
                    <button className="button-ghost" type="button" onClick={() => deleteComment(comment.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}
              <form className="gallery-comment-form" onSubmit={postComment}>
                <input
                  value={commentDraft}
                  maxLength={500}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add a comment"
                />
                <button className="button-primary" type="submit" disabled={!commentDraft.trim()}>
                  Post
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
