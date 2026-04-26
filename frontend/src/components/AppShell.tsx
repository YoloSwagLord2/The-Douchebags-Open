import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { usePopups } from "../lib/popups";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { NavigationTournament } from "../lib/types";
import { Modal } from "./Modal";
import { LottieOrPreset } from "./LottieOrPreset";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { t } from "../lib/i18n";

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
      <LanguageSwitcher />
      {user?.role === "admin" && (
        <header className="top-hero">
          <div className="top-hero__copy">
            <p className="eyebrow">{t('app.eyebrow')}</p>
            <h1>{t('app.title')}</h1>
          </div>
          <div className="top-hero__actions">
            <Link className="button-primary" to="/leaderboard">
              {t('nav.board')}
            </Link>
            {latestRound ? (
              <Link className="button-secondary" to={`/round/${latestRound.id}/entry`}>
                {t('score.enterScores')}
              </Link>
            ) : null}
            <button className="button-ghost" onClick={logout} type="button">
              {t('app.signOut')}
            </button>
          </div>
        </header>
      )}
      {user?.role !== "admin" && (
        <div className="player-bar">
          <button className="button-ghost" onClick={logout} type="button">{t('app.signOut')}</button>
        </div>
      )}

      <main className="page-shell">
        <Outlet context={{ navigation }} />
      </main>

      <nav className="bottom-nav">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/admin/players">{t('nav.players')}</NavLink>
            <NavLink to="/admin/courses">{t('nav.courses')}</NavLink>
            <NavLink to="/admin/tournaments">{t('nav.events')}</NavLink>
            <NavLink to="/leaderboard">{t('nav.board')}</NavLink>
            <NavLink to="/admin/bonus-rules">{t('nav.rules')}</NavLink>
            <NavLink to="/admin/notifications">{t('nav.inbox')}</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/leaderboard">{t('nav.board')}</NavLink>
            <NavLink to="/score">{t('nav.scores')}</NavLink>
            <NavLink to="/me/bonuses">{t('nav.bonuses')}</NavLink>
            <NavLink to="/me/achievements">{t('nav.achievements')}</NavLink>
            <NavLink to="/notifications">
              {t('nav.inbox')}
              {unreadCount ? <span className="badge">{unreadCount}</span> : null}
            </NavLink>
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
