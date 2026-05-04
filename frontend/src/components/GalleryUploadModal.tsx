import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { GalleryMedia, HoleScorecardResponse } from "../lib/types";
import { Modal } from "./Modal";

interface GalleryUploadModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  roundId: string;
  holes?: HoleScorecardResponse[];
  defaultHoleId?: string;
  onUploaded: (media: GalleryMedia) => void;
}

export function GalleryUploadModal({
  open,
  onClose,
  token,
  roundId,
  holes = [],
  defaultHoleId,
  onUploaded,
}: GalleryUploadModalProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [holeId, setHoleId] = useState(defaultHoleId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setHoleId(defaultHoleId ?? "");
  }, [defaultHoleId, open]);

  const resetAndClose = () => {
    setFile(null);
    setCaption("");
    setError(null);
    onClose();
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const media = await api.uploadGalleryMedia(roundId, { file, holeId: holeId || undefined, caption }, token);
      onUploaded(media);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Add to gallery"
      footer={
        <>
          <button className="button-ghost" type="button" onClick={resetAndClose}>
            Cancel
          </button>
          <button className="button-primary" type="button" onClick={upload} disabled={!file || busy}>
            {busy ? "Uploading..." : "Publish"}
          </button>
        </>
      }
    >
      <div className="gallery-upload">
        <div className="gallery-upload__actions">
          <button className="button-secondary" type="button" onClick={() => cameraInputRef.current?.click()}>
            Camera
          </button>
          <button className="button-secondary" type="button" onClick={() => pickerInputRef.current?.click()}>
            Choose file
          </button>
        </div>
        <input
          ref={cameraInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={pickerInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="gallery-upload__selected">
            <strong>{file.name}</strong>
            <span>{Math.round(file.size / 1024 / 1024 * 10) / 10} MB</span>
          </div>
        ) : null}
        {holes.length ? (
          <label className="field-label">
            Hole
            <select value={holeId} onChange={(event) => setHoleId(event.target.value)}>
              <option value="">Round moment</option>
              {holes.map((hole) => (
                <option key={hole.hole_id} value={hole.hole_id}>
                  Hole {hole.hole_number}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field-label">
          Caption
          <textarea
            rows={3}
            maxLength={280}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Optional caption"
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
