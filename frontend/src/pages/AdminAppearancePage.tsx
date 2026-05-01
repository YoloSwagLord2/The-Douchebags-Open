import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { applyAppearance } from "../lib/appearance";
import { useAuth } from "../lib/auth";
import type { AppearanceResponse } from "../lib/types";
import { t } from "../lib/i18n";

type BackgroundSlot = "login" | "admin-hero";

const slots: Array<{
  key: BackgroundSlot;
  title: string;
  description: string;
  imageKey: keyof AppearanceResponse;
}> = [
  {
    key: "login",
    title: "Login background",
    description: "Shown behind the sign-in panel.",
    imageKey: "login_background_url",
  },
  {
    key: "admin-hero",
    title: "Admin hero background",
    description: "Shown in the admin header.",
    imageKey: "admin_hero_background_url",
  },
];

function BackgroundField({
  slot,
  token,
  appearance,
  onUpdate,
}: {
  slot: (typeof slots)[number];
  token: string;
  appearance: AppearanceResponse;
  onUpdate: (next: AppearanceResponse) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageUrl = appearance[slot.imageKey];

  const updateAppearance = (next: AppearanceResponse) => {
    applyAppearance(next);
    onUpdate(next);
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      updateAppearance(await api.uploadAppearanceBackground(slot.key, file, token));
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
      updateAppearance(await api.deleteAppearanceBackground(slot.key, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="appearance-field">
      <div className="appearance-field__preview">
        {imageUrl ? <img src={imageUrl} alt={slot.title} /> : <span>No image set</span>}
      </div>
      <div className="appearance-field__copy">
        <strong>{slot.title}</strong>
        <small>{slot.description}</small>
        <div className="hole-image-field__actions">
          <button className="button-secondary" disabled={busy} onClick={() => inputRef.current?.click()} type="button">
            {busy ? "..." : imageUrl ? "Replace image" : "Upload image"}
          </button>
          {imageUrl ? (
            <button className="button-ghost" disabled={busy} onClick={remove} type="button">
              Remove
            </button>
          ) : null}
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
    </div>
  );
}

export function AdminAppearancePage() {
  const { token } = useAuth();
  const [appearance, setAppearance] = useState<AppearanceResponse>({});

  useEffect(() => {
    if (!token) return;
    api.adminAppearance(token).then((next) => {
      applyAppearance(next);
      setAppearance(next);
    }).catch(() => undefined);
  }, [token]);

  if (!token) return null;

  return (
    <section className="detail-panel">
      <p className="eyebrow">{t('appearance.eyebrow')}</p>
      <h2>{t('appearance.title')}</h2>
      <div className="appearance-grid">
        {slots.map((slot) => (
          <BackgroundField
            key={slot.key}
            slot={slot}
            token={token}
            appearance={appearance}
            onUpdate={setAppearance}
          />
        ))}
      </div>
    </section>
  );
}
