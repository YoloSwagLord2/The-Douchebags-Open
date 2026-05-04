import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import type { GalleryMedia, HoleScorecardResponse } from "../lib/types";
import { Modal } from "./Modal";

interface GalleryUploadModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  roundId: string;
  holes?: HoleScorecardResponse[];
  defaultHoleId?: string;
  initialFile?: File | null;
  showSourceActions?: boolean;
  onUploaded: (media: GalleryMedia) => void;
}

export function GalleryUploadModal({
  open,
  onClose,
  token,
  roundId,
  holes = [],
  defaultHoleId,
  initialFile = null,
  showSourceActions = true,
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
    if (!open) return;
    setHoleId(defaultHoleId ?? "");
    setFile(initialFile);
  }, [defaultHoleId, initialFile, open]);

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
      setError(err instanceof Error ? err.message : t("gallery.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title={t("gallery.addToGallery")}
      footer={
        <>
          <button className="button-ghost" type="button" onClick={resetAndClose}>
            {t("gallery.cancel")}
          </button>
          <button className="button-primary" type="button" onClick={upload} disabled={!file || busy}>
            {busy ? t("gallery.uploading") : t("gallery.publish")}
          </button>
        </>
      }
    >
      <div className="gallery-upload">
        {showSourceActions ? (
          <div className="gallery-upload__actions">
            <button className="button-secondary" type="button" onClick={() => cameraInputRef.current?.click()}>
              {t("gallery.camera")}
            </button>
            <button className="button-secondary" type="button" onClick={() => pickerInputRef.current?.click()}>
              {t("gallery.chooseFile")}
            </button>
          </div>
        ) : null}
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
            {t("gallery.hole")}
            <select value={holeId} onChange={(event) => setHoleId(event.target.value)}>
              <option value="">{t("gallery.roundMoment")}</option>
              {holes.map((hole) => (
                <option key={hole.hole_id} value={hole.hole_id}>
                  {t("score.hole")} {hole.hole_number}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field-label">
          {t("gallery.caption")}
          <textarea
            rows={3}
            maxLength={280}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder={t("gallery.optionalCaption")}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
