import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PlayerDetail } from "../lib/types";

interface Props {
  playerId: string | null;
  onClose: () => void;
}

export function PlayerCardModal({ playerId, onClose }: Props) {
  const { token } = useAuth();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);

  useEffect(() => {
    if (!playerId || !token) { setPlayer(null); return; }
    api.playerDetail(playerId, token).then(setPlayer).catch(() => setPlayer(null));
  }, [playerId, token]);

  if (!playerId) return null;

  return (
    <div className="player-card-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="player-card" onClick={(e) => e.stopPropagation()}>
        <button className="player-card__close" type="button" onClick={onClose} aria-label="Close">×</button>

        <div className="player-card__photo-wrap">
          {player?.feature_photo_url || player?.avatar_url ? (
            <img
              className="player-card__photo"
              src={player.feature_photo_url ?? player.avatar_url ?? ""}
              alt={player.name}
            />
          ) : (
            <div className="player-card__photo player-card__photo--placeholder">
              {player?.name.slice(0, 1) ?? "?"}
            </div>
          )}
          {player && (
            <div className="player-card__photo-overlay">
              <h2 className="player-card__name">{player.name}</h2>
              <div className="player-card__origin">
                <span className="player-card__flag">🇳🇱</span>
                <span>Nederland</span>
              </div>
            </div>
          )}
        </div>

        {player ? (
          <div className="player-card__body">
            <div className="player-card__stats">
              <div className="player-card__stat">
                <span className="player-card__stat-label">HCP</span>
                <strong>{player.hcp}</strong>
              </div>
              <div className="player-card__stat">
                <span className="player-card__stat-label">Leeftijd</span>
                <strong>{player.age ?? "—"}</strong>
              </div>
              <div className="player-card__stat player-card__stat--text">
                <span className="player-card__stat-label">Signature move</span>
                <strong>{player.signature_move ?? "—"}</strong>
              </div>
            </div>
            {player.bio && (
              <p className="player-card__bio">{player.bio}</p>
            )}
          </div>
        ) : (
          <div className="player-card__body player-card__body--loading">
            <p>Laden…</p>
          </div>
        )}
      </div>
    </div>
  );
}
