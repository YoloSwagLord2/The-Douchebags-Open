import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type {
  AchievementPopupResponse,
  BonusUnlockResponse,
  NotificationPopupResponse,
  NotificationResponse,
} from "./types";

type PopupItem =
  | { kind: "bonus"; payload: BonusUnlockResponse }
  | { kind: "achievement"; payload: AchievementPopupResponse }
  | { kind: "notification"; payload: NotificationPopupResponse };

interface PopupContextValue {
  queue: PopupItem[];
  dismiss: () => void;
  pushBonusPopups: (items: BonusUnlockResponse[]) => void;
  pushAchievementPopups: (items: AchievementPopupResponse[]) => void;
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
}

const PopupContext = createContext<PopupContextValue | undefined>(undefined);

export function PopupProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [queue, setQueue] = useState<PopupItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const intervalMs = Number(import.meta.env.VITE_NOTIFICATION_POLL_INTERVAL_MS || 15000);

  const pushBonusPopups = (items: BonusUnlockResponse[]) =>
    setQueue((current) => [...current, ...items.map((payload) => ({ kind: "bonus" as const, payload }))]);

  const pushAchievementPopups = (items: AchievementPopupResponse[]) =>
    setQueue((current) => [
      ...current,
      ...items.map((payload) => ({ kind: "achievement" as const, payload })),
    ]);

  const pushNotificationPopups = (items: NotificationResponse[]) =>
    setQueue((current) => [
      ...current,
      ...items.map((item) => ({
        kind: "notification" as const,
        payload: {
          notification_id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          priority: item.priority,
        },
      })),
    ]);

  const refreshNotifications = async () => {
    if (!token) return;
    const [count, notifications] = await Promise.all([api.unreadCount(token), api.notifications(token)]);
    setUnreadCount(count.unread_count);
    const unseen = notifications.filter(
      (item) => !item.recipient?.popup_seen_at && !seenIdsRef.current.has(item.id),
    );
    unseen.forEach((item) => seenIdsRef.current.add(item.id));
    if (unseen.length) {
      pushNotificationPopups(unseen);
      await Promise.all(unseen.map((item) => api.markNotificationPopupSeen(item.id, token)));
    }
  };

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    refreshNotifications().catch(() => undefined);
    const handle = window.setInterval(() => {
      refreshNotifications().catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(handle);
  }, [token, intervalMs]);

  const dismiss = () => setQueue((current) => current.slice(1));

  const value = useMemo(
    () => ({
      queue,
      dismiss,
      pushBonusPopups,
      pushAchievementPopups,
      unreadCount,
      refreshNotifications,
    }),
    [queue, unreadCount],
  );

  return <PopupContext.Provider value={value}>{children}</PopupContext.Provider>;
}

export function usePopups() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error("usePopups must be used within PopupProvider");
  }
  return context;
}
