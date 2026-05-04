import type {
  AchievementEvent,
  AchievementRuleResponse,
  AppearanceResponse,
  AuthResponse,
  BonusAward,
  BonusRuleResponse,
  CourseResponse,
  GalleryComment,
  GalleryMedia,
  GalleryMediaPage,
  LeaderboardResponse,
  NavigationTournament,
  NotificationResponse,
  PlayerResponse,
  RoundResponse,
  ScorecardResponse,
  TournamentOverviewResponse,
  TournamentResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.detail ?? message;
    } catch {
      // Keep default message.
    }
    throw new APIError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  appearance: () => request<AppearanceResponse>("/catalog/appearance"),
  adminAppearance: (token: string) => request<AppearanceResponse>("/admin/appearance", {}, token),
  uploadAppearanceBackground: async (slot: "login" | "admin-hero", file: File, token: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/admin/appearance/backgrounds/${slot}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      throw new APIError(response.status, "Background upload failed");
    }
    return (await response.json()) as AppearanceResponse;
  },
  deleteAppearanceBackground: (slot: "login" | "admin-hero", token: string) =>
    request<AppearanceResponse>(`/admin/appearance/backgrounds/${slot}`, { method: "DELETE" }, token),
  me: (token: string) => request<AuthResponse["user"]>("/auth/me", {}, token),
  navigation: (token: string) => request<NavigationTournament[]>("/catalog/navigation", {}, token),
  roundLeaderboard: (id: string, token: string) =>
    request<LeaderboardResponse>(`/leaderboards/rounds/${id}`, {}, token),
  tournamentLeaderboard: (id: string, token: string) =>
    request<LeaderboardResponse>(`/leaderboards/tournaments/${id}`, {}, token),
  myScorecard: (id: string, token: string) => request<ScorecardResponse>(`/rounds/${id}/scorecard/me`, {}, token),
  saveScorecard: (id: string, scores: Array<{ hole_id: string; strokes: number }>, token: string) =>
    request<ScorecardResponse>(
      `/rounds/${id}/scorecard/me`,
      { method: "PUT", body: JSON.stringify({ scores }) },
      token,
    ),
  galleryMedia: (token: string, filters: Record<string, string | number | undefined> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const query = params.toString();
    return request<GalleryMediaPage>(`/gallery/media${query ? `?${query}` : ""}`, {}, token);
  },
  uploadGalleryMedia: async (
    roundId: string,
    payload: { file: File; holeId?: string; caption?: string },
    token: string,
  ) => {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.holeId) formData.append("hole_id", payload.holeId);
    if (payload.caption) formData.append("caption", payload.caption);
    const response = await fetch(`${API_BASE}/rounds/${roundId}/gallery/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      let message = "Media upload failed";
      try {
        const data = await response.json();
        message = data.detail ?? message;
      } catch {
        // Keep default message.
      }
      throw new APIError(response.status, message);
    }
    return (await response.json()) as GalleryMedia;
  },
  likeGalleryMedia: (id: string, token: string) =>
    request<GalleryMedia>(`/gallery/media/${id}/like`, { method: "POST" }, token),
  unlikeGalleryMedia: (id: string, token: string) =>
    request<GalleryMedia>(`/gallery/media/${id}/like`, { method: "DELETE" }, token),
  galleryComments: (id: string, token: string) =>
    request<GalleryComment[]>(`/gallery/media/${id}/comments`, {}, token),
  createGalleryComment: (id: string, body: string, token: string) =>
    request<GalleryComment>(`/gallery/media/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }, token),
  deleteAdminGalleryMedia: (id: string, token: string) =>
    request<{ status: string }>(`/admin/gallery/media/${id}`, { method: "DELETE" }, token),
  deleteAdminGalleryComment: (id: string, token: string) =>
    request<{ status: string }>(`/admin/gallery/comments/${id}`, { method: "DELETE" }, token),
  myBonusAwards: (token: string) => request<BonusAward[]>("/players/me/bonus-awards", {}, token),
  myAchievements: (token: string) => request<AchievementEvent[]>("/players/me/achievements", {}, token),
  notifications: (token: string) => request<NotificationResponse[]>("/notifications", {}, token),
  unreadCount: (token: string) => request<{ unread_count: number }>("/notifications/unread-count", {}, token),
  markNotificationRead: (id: string, token: string) =>
    request<{ status: string }>(`/notifications/${id}/read`, { method: "POST" }, token),
  markAllNotificationsRead: (token: string) =>
    request<{ status: string }>("/notifications/read-all", { method: "POST" }, token),
  adminPlayers: (token: string) => request<PlayerResponse[]>("/admin/players", {}, token),
  createAdminPlayer: (payload: Record<string, unknown>, token: string) =>
    request<PlayerResponse>("/admin/players", { method: "POST", body: JSON.stringify(payload) }, token),
  updateAdminPlayer: (id: string, payload: Record<string, unknown>, token: string) =>
    request<PlayerResponse>(`/admin/players/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  uploadPlayerPhoto: async (id: string, file: File, token: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/admin/players/${id}/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      throw new APIError(response.status, "Photo upload failed");
    }
    return (await response.json()) as PlayerResponse;
  },
  adminCourses: (token: string) => request<CourseResponse[]>("/admin/courses", {}, token),
  createCourse: (payload: Record<string, unknown>, token: string) =>
    request<CourseResponse>("/admin/courses", { method: "POST", body: JSON.stringify(payload) }, token),
  updateCourse: (id: string, payload: Record<string, unknown>, token: string) =>
    request<CourseResponse>(`/admin/courses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  deleteCourse: (id: string, token: string) =>
    request<{ status: string }>(`/admin/courses/${id}`, { method: "DELETE" }, token),
  replaceCourseHoles: (id: string, holes: Array<Record<string, unknown>>, token: string) =>
    request<CourseResponse>(`/admin/courses/${id}/holes`, { method: "PUT", body: JSON.stringify(holes) }, token),
  uploadHoleImage: async (holeId: string, file: File, token: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/admin/holes/${holeId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      throw new APIError(response.status, "Hole image upload failed");
    }
    return (await response.json()) as CourseResponse;
  },
  deleteHoleImage: (holeId: string, token: string) =>
    request<CourseResponse>(`/admin/holes/${holeId}/image`, { method: "DELETE" }, token),
  tournamentOverview: (id: string, token: string) =>
    request<TournamentOverviewResponse>(`/leaderboards/tournaments/${id}/overview`, {}, token),
  adminTournaments: (token: string) => request<TournamentResponse[]>("/admin/tournaments", {}, token),
  createTournament: (payload: Record<string, unknown>, token: string) =>
    request<TournamentResponse>("/admin/tournaments", { method: "POST", body: JSON.stringify(payload) }, token),
  updateTournament: (id: string, payload: Record<string, unknown>, token: string) =>
    request<TournamentResponse>(`/admin/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  updateRoster: (id: string, player_ids: string[], token: string) =>
    request<{ status: string }>(`/admin/tournaments/${id}/players`, { method: "PUT", body: JSON.stringify({ player_ids }) }, token),
  adminRounds: (token: string) => request<RoundResponse[]>("/admin/rounds", {}, token),
  createRound: (payload: Record<string, unknown>, token: string) =>
    request<RoundResponse>("/admin/rounds", { method: "POST", body: JSON.stringify(payload) }, token),
  updateRound: (id: string, payload: Record<string, unknown>, token: string) =>
    request<RoundResponse>(`/admin/rounds/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  lockRound: (id: string, token: string) =>
    request<RoundResponse>(`/admin/rounds/${id}/lock`, { method: "POST" }, token),
  adminOverrideScorecard: (roundId: string, playerId: string, scores: Array<{ hole_id: string; strokes: number }>, token: string) =>
    request<{ status: string }>(
      `/admin/rounds/${roundId}/players/${playerId}/scorecard`,
      { method: "PUT", body: JSON.stringify({ scores }) },
      token,
    ),
  adminBonusRules: (token: string) => request<BonusRuleResponse[]>("/admin/bonus-rules", {}, token),
  createBonusRule: (payload: Record<string, unknown>, token: string) =>
    request<BonusRuleResponse>("/admin/bonus-rules", { method: "POST", body: JSON.stringify(payload) }, token),
  updateBonusRule: (id: string, payload: Record<string, unknown>, token: string) =>
    request<BonusRuleResponse>(`/admin/bonus-rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  adminAchievementRules: (token: string) => request<AchievementRuleResponse[]>("/admin/achievement-rules", {}, token),
  createAchievementRule: (payload: Record<string, unknown>, token: string) =>
    request<AchievementRuleResponse>("/admin/achievement-rules", { method: "POST", body: JSON.stringify(payload) }, token),
  updateAchievementRule: (id: string, payload: Record<string, unknown>, token: string) =>
    request<AchievementRuleResponse>(`/admin/achievement-rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),
  adminNotifications: (token: string) => request<NotificationResponse[]>("/admin/notifications", {}, token),
  createAdminNotification: (payload: Record<string, unknown>, token: string) =>
    request<{ status: string; notification_id: string }>(
      "/admin/notifications",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
};
