import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { CameraIcon } from "../components/CameraIcon";
import { GalleryUploadModal } from "../components/GalleryUploadModal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePopups } from "../lib/popups";
import type { HoleScorecardResponse, LeaderboardEntry, NavigationTournament, ScorecardResponse } from "../lib/types";
import { t } from "../lib/i18n";

const ROUND_TRACKER_REFRESH_MS = 25000;

type RoundTrackerPlayer = {
  entry: LeaderboardEntry;
  holes: HoleScorecardResponse[];
};

function scoreBadgeClass(strokes: number | null | undefined, par: number) {
  if (strokes == null) return "";
  const diff = strokes - par;
  return diff <= -2 ? " score-eagle" :
    diff === -1 ? " score-birdie" :
    diff === 1 ? " score-bogey" :
    diff >= 2 ? " score-dbl-bogey" : "";
}

// Vincenty inverse formula on WGS84 ellipsoid — accurate to ~0.5mm
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const a = 6378137.0;
  const b = 6356752.314245;
  const f = 1 / 298.257223563;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const L = toRad(lng2 - lng1);
  const tanU1 = (1 - f) * Math.tan(φ1), cosU1 = 1 / Math.sqrt(1 + tanU1 ** 2), sinU1 = tanU1 * cosU1;
  const tanU2 = (1 - f) * Math.tan(φ2), cosU2 = 1 / Math.sqrt(1 + tanU2 ** 2), sinU2 = tanU2 * cosU2;

  let λ = L, λʹ = 0, iter = 0;
  let sinλ: number, cosλ: number, sinσ: number, cosσ: number, σ: number;
  let sinα: number, cos2α: number, cos2σm: number, C: number;

  do {
    sinλ = Math.sin(λ); cosλ = Math.cos(λ);
    sinσ = Math.sqrt((cosU2 * sinλ) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2);
    if (sinσ === 0) return 0;
    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cos2α = 1 - sinα ** 2;
    cos2σm = cos2α !== 0 ? cosσ - (2 * sinU1 * sinU2) / cos2α : 0;
    C = (f / 16) * cos2α * (4 + f * (4 - 3 * cos2α));
    λʹ = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm ** 2)));
  } while (Math.abs(λ - λʹ) > 1e-12 && ++iter < 1000);

  const u2 = cos2α! * (a ** 2 - b ** 2) / b ** 2;
  const A2 = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B2 = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const Δσ = B2 * sinσ! * (cos2σm! + (B2 / 4) * (cosσ! * (-1 + 2 * cos2σm! ** 2) -
    (B2 / 6) * cos2σm! * (-3 + 4 * sinσ! ** 2) * (-3 + 4 * cos2σm! ** 2)));
  return b * A2 * (σ! - Δσ);
}

export function RoundEntryPage() {
  const { token, user } = useAuth();
  const canEditPins = user?.may_edit_pins === true;
  const { pushAchievementPopups, pushBonusPopups, refreshNotifications } = usePopups();
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { navigation } = useOutletContext<{ navigation: NavigationTournament[] }>();
  const allRounds = navigation.flatMap((tn) => tn.rounds.map((r) => ({ ...r, tournamentName: tn.name })));
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftStroke, setDraftStroke] = useState<number>(4);
  const [draftTouched, setDraftTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [roundTrackerPlayers, setRoundTrackerPlayers] = useState<RoundTrackerPlayer[]>([]);
  const [roundTrackerLoading, setRoundTrackerLoading] = useState(false);
  const [roundTrackerError, setRoundTrackerError] = useState(false);
  const [isHoleImageOpen, setIsHoleImageOpen] = useState(false);
  const [isGalleryUploadOpen, setIsGalleryUploadOpen] = useState(false);
  const [capturedMediaFile, setCapturedMediaFile] = useState<File | null>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const isAndroid = /android/i.test(navigator.userAgent);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const scorecardScrollRef = useRef<HTMLDivElement>(null);
  const [gpsEnabled, setGpsEnabled] = useState(() => localStorage.getItem("gps_enabled") === "true");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isLocked = scorecard?.round.status === "locked";

  useEffect(() => {
    localStorage.setItem("gps_enabled", String(gpsEnabled));
    if (!gpsEnabled) { setUserLocation(null); setGpsError(null); return; }
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by this browser");
      return;
    }
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsError(null);
        },
        (err) => setGpsError(`${err.message} (code ${err.code})`),
        { enableHighAccuracy: true, timeout: 4000 },
      );
    };
    poll();
    const id = setInterval(poll, 5000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [gpsEnabled]);

  useEffect(() => {
    if (!token || !roundId) return;
    api.myScorecard(roundId, token).then((response) => {
      setScorecard(response);
      const firstOpen = response.holes.findIndex((hole) => hole.strokes == null);
      const nextIndex = firstOpen === -1 ? 0 : firstOpen;
      setCurrentIndex(nextIndex);
      setDraftStroke(response.holes[nextIndex]?.strokes ?? 4);
    });
  }, [roundId, token]);

  const refreshRoundTracker = useCallback(async (showLoading = false) => {
    if (!token || !roundId) {
      setRoundTrackerPlayers([]);
      return;
    }
    if (showLoading) setRoundTrackerLoading(true);
    setRoundTrackerError(false);
    try {
      const response = await api.roundLeaderboard(roundId, token);
      const entries = response.official_entries.filter((entry) => entry.player_id !== user?.id);
      const players = await Promise.all(
        entries.map(async (entry) => {
          try {
            const scorecardResponse = await api.playerRoundScorecard(roundId, entry.player_id, token);
            return { entry, holes: scorecardResponse.holes };
          } catch {
            return { entry, holes: [] };
          }
        }),
      );
      setRoundTrackerPlayers(players);
    } catch {
      setRoundTrackerError(true);
    } finally {
      if (showLoading) setRoundTrackerLoading(false);
    }
  }, [roundId, token, user?.id]);

  useEffect(() => {
    if (!token || !roundId) {
      setRoundTrackerPlayers([]);
      return;
    }
    setRoundTrackerPlayers([]);
    void refreshRoundTracker(true);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRoundTracker(false);
    }, ROUND_TRACKER_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshRoundTracker, roundId, token]);

  const hole = scorecard?.holes[currentIndex];

  useEffect(() => {
    if (!hole) return;
    setDraftStroke(hole.strokes ?? Math.max(1, hole.par));
    setDraftTouched(hole.strokes != null);
  }, [hole]);

  useEffect(() => {
    const container = scorecardScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".scorecard-table__col--active");
    if (active) active.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  const saveCurrentHole = async () => {
    if (!token || !roundId || !hole || !draftTouched) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await api.saveScorecard(roundId, [{ hole_id: hole.hole_id, strokes: draftStroke }], token);
      setScorecard(response);
      if (response.newly_unlocked_bonuses.length) {
        pushBonusPopups(response.newly_unlocked_bonuses);
      }
      if (response.new_achievements.length) {
        pushAchievementPopups(response.new_achievements);
      }
      await Promise.all([refreshNotifications(), refreshRoundTracker(false)]);
      setCurrentIndex((index) => Math.min(index + 1, response.holes.length - 1));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save score");
    } finally {
      setSaving(false);
    }
  };

  const currentHole = hole as HoleScorecardResponse | undefined;
  const totals = scorecard?.totals;
  const hasPreviousHole = currentIndex > 0;
  const hasNextHole = scorecard ? currentIndex < scorecard.holes.length - 1 : false;
  const roundName = scorecard?.round.name?.trim() || `Round ${scorecard?.round.round_number ?? ""}`;
  const courseName = scorecard?.round.course_name;

  const openHoleCamera = () => {
    if (isAndroid) {
      setMediaMenuOpen(true);
    } else if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
      cameraInputRef.current.click();
    }
  };

  const closeGalleryUpload = () => {
    setIsGalleryUploadOpen(false);
    setCapturedMediaFile(null);
  };

  return (
    <div className="stack-layout score-entry-layout">
      {currentHole ? (
        <section className="hole-stage">
          <div className="hole-stage__topbar">
            {allRounds.length > 1 ? (
              <div className="score-round-picker">
                <span className="score-round-picker__label">
                  {scorecard?.round.tournament_name ?? "—"} · {roundName}{courseName ? ` • ${courseName}` : ""}
                </span>
                <span className="score-round-picker__arrow">▾</span>
                <select
                  className="score-round-picker__select"
                  value={roundId ?? ""}
                  onChange={(e) => navigate(`/round/${e.target.value}/entry`)}
                  aria-label="Switch round"
                >
                  {allRounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.tournamentName} · {r.name?.trim() || `Round ${r.round_number}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              courseName && <p className="score-course-label">{roundName} • {courseName}</p>
            )}
          </div>
          {currentHole.image_url ? (
            <button
              className="hole-image-wrap"
              type="button"
              onClick={() => setIsHoleImageOpen(true)}
              aria-label={`Open full image for hole ${currentHole.hole_number}`}
            >
              <img
                className="hole-image"
                src={currentHole.image_url}
                alt={`Hole ${currentHole.hole_number}`}
              />
            </button>
          ) : null}
          <div className="hole-stage__header">
            <div className="hole-stage__info">
              <h3>{t('score.hole')} {currentHole.hole_number}</h3>
              <div className="hole-stage__meta hole-stage__meta--stack">
                <span>
                  {t('score.par')} {currentHole.par}
                  {currentHole.handicap_strokes > 0 && (
                    <sup style={{ color: "var(--gold)", marginLeft: "0.15em" }}>
                      +{currentHole.handicap_strokes}
                    </sup>
                  )}
                </span>
                <span>{t('score.si')} {currentHole.stroke_index}</span>
                <span>{currentHole.distance}m</span>
              </div>
            </div>
            <div className="hole-stage__gps">
              <button
                type="button"
                className={`gps-toggle${gpsEnabled ? " gps-toggle--on" : ""}`}
                onClick={() => setGpsEnabled((v) => !v)}
                aria-label="Toggle distance to pin"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="8" r="3"/>
                  <line x1="8" y1="0" x2="8" y2="4"/>
                  <line x1="8" y1="12" x2="8" y2="16"/>
                  <line x1="0" y1="8" x2="4" y2="8"/>
                  <line x1="12" y1="8" x2="16" y2="8"/>
                </svg>
              </button>
              {gpsEnabled && (
                <div className="gps-distance">
                  {userLocation && currentHole.pin_lat != null && currentHole.pin_lng != null ? (
                    <span className="gps-distance__pin">
                      {(() => { const d = distanceMeters(userLocation.lat, userLocation.lng, currentHole.pin_lat, currentHole.pin_lng); return d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)}m`; })()} to pin
                    </span>
                  ) : (
                    <span className="gps-distance__pin gps-distance__pin--waiting">
                      {gpsError ? "err" : currentHole.pin_lat == null ? "no pin" : "…"}
                    </span>
                  )}
                  <span className="gps-distance__coords">↔ {userLocation ? userLocation.lng.toFixed(5) : "—"}</span>
                  <span className="gps-distance__coords">↕ {userLocation ? userLocation.lat.toFixed(5) : "—"}</span>
                </div>
              )}
              {canEditPins && gpsEnabled && userLocation !== null && (
                <button
                  type="button"
                  className={`pin-set-btn${pinSaving === "saving" ? " pin-set-btn--saving" : pinSaving === "saved" ? " pin-set-btn--saved" : pinSaving === "error" ? " pin-set-btn--error" : ""}`}
                  disabled={pinSaving === "saving"}
                  onClick={async () => {
                    if (!currentHole || pinSaving === "saving") return;
                    setPinSaving("saving");
                    try {
                      await api.updateHolePin(currentHole.hole_id, userLocation.lat, userLocation.lng, token!);
                      setScorecard((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          holes: prev.holes.map((h) =>
                            h.hole_id === currentHole.hole_id
                              ? { ...h, pin_lat: userLocation.lat, pin_lng: userLocation.lng }
                              : h,
                          ),
                        };
                      });
                      setPinSaving("saved");
                      setTimeout(() => setPinSaving("idle"), 2000);
                    } catch {
                      setPinSaving("error");
                      setTimeout(() => setPinSaving("idle"), 2000);
                    }
                  }}
                >
                  {pinSaving === "saving" ? "…" : pinSaving === "saved" ? "Saved" : pinSaving === "error" ? "Error" : "Set pin here"}
                </button>
              )}
            </div>
          </div>
          <div className="stroke-controls">
            <button type="button" disabled={isLocked} onClick={() => {
              if (!draftTouched) { setDraftTouched(true); setDraftStroke(currentHole.par); }
              else setDraftStroke((v) => Math.max(1, v - 1));
            }}>
              -
            </button>
            <input
              inputMode="numeric"
              type="number"
              min={1}
              max={25}
              disabled={isLocked}
              value={draftTouched ? draftStroke : ""}
              placeholder="?"
              onChange={(event) => {
                const nextValue = event.target.value;
                if (!nextValue) {
                  setDraftTouched(false);
                  setDraftStroke(currentHole.par);
                  return;
                }
                const parsed = Number(nextValue);
                if (isNaN(parsed) || parsed < 1 || parsed > 25) return;
                setDraftTouched(true);
                setDraftStroke(parsed);
              }}
            />
            <button type="button" disabled={isLocked} onClick={() => {
              if (!draftTouched) { setDraftTouched(true); setDraftStroke(currentHole.par); }
              else setDraftStroke((v) => Math.min(25, v + 1));
            }}>
              +
            </button>
          </div>
          {isLocked && (
            <p className="round-locked-notice">{t('score.roundLocked')}</p>
          )}
          {saveError && <p className="form-error">{saveError}</p>}
          <div className="hole-stage__footer">
            <button
              type="button"
              className="button-ghost"
              onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
              disabled={!hasPreviousHole}
            >
              {t('score.previous')}
            </button>
            <button
              aria-label={t("gallery.openCameraForHole")}
              type="button"
              className="button-secondary icon-button"
              title={t("gallery.openCameraForHole")}
              onClick={openHoleCamera}
            >
              <CameraIcon className="icon-button__icon" />
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setCurrentIndex((value) => Math.min(value + 1, (scorecard?.holes.length ?? 1) - 1))}
              disabled={!hasNextHole}
            >
              {t('score.next')}
            </button>
          </div>
          <button type="button" className="button-primary hole-stage__save" onClick={saveCurrentHole} disabled={saving || !draftTouched || isLocked}>
            {saving ? "Saving…" : t('score.saveAndContinue')}
          </button>
        </section>
      ) : (
        <div className="loading-state">{t('score.loading')}</div>
      )}

      {currentHole && isHoleImageOpen && currentHole.image_url ? (
        <div className="hole-image-viewer" role="dialog" aria-modal="true" aria-label={`Hole ${currentHole.hole_number} image`}>
          <button
            className="hole-image-viewer__close"
            type="button"
            onClick={() => setIsHoleImageOpen(false)}
            aria-label="Close hole image"
          >
            ×
          </button>
          <img
            className="hole-image-viewer__image"
            src={currentHole.image_url}
            alt={`Hole ${currentHole.hole_number}`}
          />
        </div>
      ) : null}

      <input
        ref={cameraInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={(event) => {
          const nextFile = event.target.files?.[0] ?? null;
          if (!nextFile) return;
          setCapturedMediaFile(nextFile);
          setIsGalleryUploadOpen(true);
        }}
      />
      {mediaMenuOpen && (
        <div className="media-menu-backdrop" onClick={() => setMediaMenuOpen(false)}>
          <div className="media-menu" onClick={(e) => e.stopPropagation()}>
            <label className="button-secondary media-menu__option">
              📷 Photo
              <input
                className="visually-hidden"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  setMediaMenuOpen(false);
                  const nextFile = event.target.files?.[0] ?? null;
                  if (!nextFile) return;
                  setCapturedMediaFile(nextFile);
                  setIsGalleryUploadOpen(true);
                }}
              />
            </label>
            <label className="button-secondary media-menu__option">
              🎥 Video
              <input
                className="visually-hidden"
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(event) => {
                  setMediaMenuOpen(false);
                  const nextFile = event.target.files?.[0] ?? null;
                  if (!nextFile) return;
                  setCapturedMediaFile(nextFile);
                  setIsGalleryUploadOpen(true);
                }}
              />
            </label>
            <label className="button-secondary media-menu__option">
              🖼️ Gallery
              <input
                className="visually-hidden"
                type="file"
                accept="image/*,video/*"
                onChange={(event) => {
                  setMediaMenuOpen(false);
                  const nextFile = event.target.files?.[0] ?? null;
                  if (!nextFile) return;
                  setCapturedMediaFile(nextFile);
                  setIsGalleryUploadOpen(true);
                }}
              />
            </label>
            <button type="button" className="button-ghost" onClick={() => setMediaMenuOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {scorecard && roundId && token ? (
        <GalleryUploadModal
          open={isGalleryUploadOpen}
          onClose={closeGalleryUpload}
          token={token}
          roundId={roundId}
          holes={scorecard.holes}
          defaultHoleId={currentHole?.hole_id}
          initialFile={capturedMediaFile}
          showSourceActions={false}
          onUploaded={closeGalleryUpload}
        />
      ) : null}

      <section className="totals-card">
        <div className="totals-strip">
          <div>
            <span>{t('score.gross')}</span>
            <strong>{totals?.gross_strokes ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.net')}</span>
            <strong>{totals?.net_strokes ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.stableford')}</span>
            <strong>{totals?.official_stableford ?? 0}</strong>
          </div>
          <div>
            <span>{t('score.bonus')}</span>
            <strong>{totals?.bonus_points ?? 0}</strong>
          </div>
        </div>
        {scorecard && (() => {
          const sorted = [...scorecard.holes].sort((a, b) => a.hole_number - b.hole_number);
          return (
            <div className="scorecard-summary" ref={scorecardScrollRef}>
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th className="scorecard-table__label"></th>
                    {sorted.map((h, i) => (
                      <th key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                        {h.hole_number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="scorecard-table__label">{t('score.par')}</td>
                    {sorted.map((h, i) => (
                      <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>{h.par}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="scorecard-table__label">{t('score.scoreLabel')}</td>
                    {sorted.map((h, i) => {
                      const badge = scoreBadgeClass(h.strokes, h.par);
                      return (
                        <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                          {h.strokes != null
                            ? <span className={`score-badge${badge}`}>{h.strokes}</span>
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="scorecard-table__label">{t('score.stb')}</td>
                    {sorted.map((h, i) => (
                      <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>{h.stableford_points ?? "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="round-tracker">
          <div className="round-tracker__header">
            <div>
              <p className="round-tracker__eyebrow">{t('score.roundTracker')}</p>
              <h3>{t('score.roundTrackerTitle')}</h3>
            </div>
            <span className={`round-tracker__status${roundTrackerError ? " round-tracker__status--error" : ""}`}>
              {roundTrackerLoading
                ? t('score.roundTrackerLoading')
                : roundTrackerError
                  ? t('score.roundTrackerOffline')
                  : t('score.roundTrackerLive')}
            </span>
          </div>
          {roundTrackerPlayers.length > 0 ? (
            <div className="round-tracker__scorecards">
              {roundTrackerPlayers.map(({ entry, holes }) => {
                const holesById = new Map(holes.map((item) => [item.hole_id, item]));
                const sorted = scorecard?.holes.slice().sort((a, b) => a.hole_number - b.hole_number) ?? [];
                return (
                  <div className="round-tracker__player-scorecard" key={entry.player_id}>
                    <div className="round-tracker__player-heading">
                      <strong>{entry.player_name}</strong>
                      <span>#{entry.official_position} · {entry.holes_played} {t('leaderboard.holesLogged')}</span>
                    </div>
                    <div className="scorecard-summary round-tracker__table">
                      <table className="scorecard-table">
                        <thead>
                          <tr>
                            <th className="scorecard-table__label"></th>
                            {sorted.map((h, i) => (
                              <th key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                                {h.hole_number}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="scorecard-table__label">{t('score.par')}</td>
                            {sorted.map((h, i) => (
                              <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>{h.par}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="scorecard-table__label">{t('score.scoreLabel')}</td>
                            {sorted.map((h, i) => {
                              const trackedHole = holesById.get(h.hole_id);
                              const badge = scoreBadgeClass(trackedHole?.strokes, h.par);
                              return (
                                <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                                  {trackedHole?.strokes != null
                                    ? <span className={`score-badge${badge}`}>{trackedHole.strokes}</span>
                                    : "—"}
                                </td>
                              );
                            })}
                          </tr>
                          <tr>
                            <td className="scorecard-table__label">{t('score.stb')}</td>
                            {sorted.map((h, i) => {
                              const trackedHole = holesById.get(h.hole_id);
                              return (
                                <td key={h.hole_id} className={i === currentIndex ? "scorecard-table__col--active" : ""}>
                                  {trackedHole?.stableford_points ?? "—"}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="round-tracker__empty">
              {roundTrackerLoading ? t('score.roundTrackerLoading') : t('score.roundTrackerEmpty')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
