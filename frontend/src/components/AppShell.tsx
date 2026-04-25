import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { usePopups } from "../lib/popups";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { NavigationTournament } from "../lib/types";
import { Modal } from "./Modal";
import { LottieOrPreset } from "./LottieOrPreset";

export function AppShell() {
  const { user, token, logout } = useAuth();
  const { queue, dismiss, unreadCount } = usePopups();
  const [navigation, setNavigation] = useState<NavigationTournament[]>([]);

  useEffect(() => {
    if (!token) return;
    api.navigation(token).then(setNavigation).catch(() => undefined);
  }, [token]);

  const currentPopup = queue[0];
  const latestTournament = navigation[0];
  const latestRound = latestTournament?.rounds[0];

  return (
    <div className="app-shell">
      {user?.role === "admin" && (
        <header className="top-hero">
          <div className="top-hero__copy">
            <p className="eyebrow">The Douchebags Open</p>
            <h1>Tournament Control</h1>
          </div>
          <div className="top-hero__actions">
            <Link className="button-primary" to="/leaderboard">
              Open board
            </Link>
            {latestRound ? (
              <Link className="button-secondary" to={`/round/${latestRound.id}/entry`}>
                Enter scores
              </Link>
            ) : null}
            <button className="button-ghost" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </header>
      )}

      <main className="page-shell">
        <Outlet context={{ navigation }} />
      </main>

      <nav className="bottom-nav">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/admin/players">Players</NavLink>
            <NavLink to="/admin/courses">Courses</NavLink>
            <NavLink to="/admin/tournaments">Events</NavLink>
            <NavLink to="/leaderboard">Board</NavLink>
            <NavLink to="/admin/bonus-rules">Rules</NavLink>
            <NavLink to="/admin/notifications">Inbox</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/leaderboard">Board</NavLink>
            {latestRound ? <NavLink to={`/round/${latestRound.id}/entry`}>Score</NavLink> : <span>Score</span>}
            <NavLink to="/me/bonuses">Bonuses</NavLink>
            <NavLink to="/me/achievements">Awards</NavLink>
            <NavLink to="/notifications">
              Inbox
              {unreadCount ? <span className="badge">{unreadCount}</span> : null}
            </NavLink>
            <button onClick={logout} type="button">
              Sign out
            </button>
          </>
        )}
      </nav>

      <Modal
        open={Boolean(currentPopup)}
        onClose={dismiss}
        tone={currentPopup?.kind === "bonus" ? "celebration" : "default"}
        title={
          currentPopup?.kind === "bonus"
            ? currentPopup.payload.rule_name
            : currentPopup?.kind === "achievement"
              ? currentPopup.payload.title
              : currentPopup?.payload.title
        }
        footer={
          <button className="button-primary" onClick={dismiss} type="button">
            Keep going
          </button>
        }
      >
        {currentPopup?.kind === "bonus" ? (
          <div className="celebration-stack">
            <LottieOrPreset
              preset={currentPopup.payload.animation_preset}
              lottieUrl={currentPopup.payload.animation_lottie_url}
            />
            <p className="celebration-points">+{currentPopup.payload.points} bonus Stableford</p>
            <p>{currentPopup.payload.message}</p>
          </div>
        ) : currentPopup?.kind === "achievement" ? (
          <div className="achievement-popup">
            <div className={`achievement-icon achievement-icon--${currentPopup.payload.icon}`} />
            <p className="achievement-rule">{currentPopup.payload.rule_name}</p>
            <p>{currentPopup.payload.message}</p>
          </div>
        ) : currentPopup ? (
          <div className="notification-popup">
            <p className="eyebrow">Message</p>
            <p>{currentPopup.payload.body}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
