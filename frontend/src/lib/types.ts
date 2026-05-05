export type UserRole = "player" | "admin";
export type RoundStatus = "open" | "locked";
export type ScopeType = "round" | "tournament";
export type NotificationType = "admin_message" | "achievement" | "bonus" | "system";
export type NotificationPriority = "low" | "normal" | "high";
export type BonusAnimationPreset = "confetti" | "fireworks" | "spotlight" | "chaos";
export type AchievementIconPreset = "star" | "ace" | "flame" | "trophy";
export type GalleryMediaType = "photo" | "video";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hcp: number;
  photo_avatar_url?: string | null;
  photo_feature_url?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: UserSummary;
}

export interface NavigationRound {
  id: string;
  round_number: number;
  name?: string | null;
  date: string;
  status: RoundStatus;
  course_name: string;
}

export interface NavigationTournament {
  id: string;
  name: string;
  date: string;
  rounds: NavigationRound[];
}

export interface AppearanceResponse {
  login_background_url?: string | null;
  admin_hero_background_url?: string | null;
}

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  avatar_url?: string | null;
  feature_photo_url?: string | null;
  holes_played: number;
  gross_strokes: number;
  net_strokes: number;
  official_stableford: number;
  bonus_points: number;
  bonus_adjusted_stableford: number;
  official_position: number;
  bonus_position: number;
}

export interface LeaderboardResponse {
  scope_type: ScopeType;
  tournament: {
    id: string;
    name: string;
    date: string;
  };
  round?: {
    id: string;
    round_number: number;
    name?: string | null;
    date: string;
    status: RoundStatus;
  } | null;
  official_entries: LeaderboardEntry[];
  bonus_entries: LeaderboardEntry[];
}

export interface HoleScorecardResponse {
  hole_id: string;
  hole_number: number;
  par: number;
  stroke_index: number;
  distance: number;
  strokes?: number | null;
  net_strokes?: number | null;
  stableford_points?: number | null;
  handicap_strokes: number;
  image_url?: string | null;
}

export interface BonusUnlockResponse {
  bonus_rule_id: string;
  rule_name: string;
  points: number;
  message: string;
  animation_preset: BonusAnimationPreset;
  animation_lottie_url?: string | null;
}

export interface AchievementPopupResponse {
  achievement_event_id: string;
  rule_name: string;
  title: string;
  message: string;
  icon: AchievementIconPreset;
}

export interface NotificationPopupResponse {
  notification_id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
}

export interface ScorecardResponse {
  round: {
    id: string;
    tournament_id: string;
    tournament_name: string;
    course_id: string;
    course_name: string;
    round_number: number;
    name?: string | null;
    date: string;
    status: RoundStatus;
  };
  player: UserSummary;
  holes: HoleScorecardResponse[];
  totals: {
    gross_strokes: number;
    net_strokes: number;
    official_stableford: number;
    bonus_points: number;
    bonus_adjusted_stableford: number;
    holes_played: number;
  };
  active_bonuses: BonusUnlockResponse[];
  newly_unlocked_bonuses: BonusUnlockResponse[];
  new_achievements: AchievementPopupResponse[];
  new_notifications: NotificationPopupResponse[];
}

export interface BonusAward {
  id: string;
  bonus_rule_id: string;
  player_id: string;
  points_snapshot: number;
  message_snapshot: string;
  animation_preset_snapshot: BonusAnimationPreset;
  animation_lottie_url_snapshot?: string | null;
  awarded_at: string;
  revoked_at?: string | null;
}

export interface AchievementEvent {
  id: string;
  achievement_rule_id: string;
  player_id: string;
  title_snapshot: string;
  message_snapshot: string;
  icon_snapshot: AchievementIconPreset;
  triggered_at: string;
  revoked_at?: string | null;
}

export interface GalleryAuthor {
  id: string;
  name: string;
  photo_avatar_url?: string | null;
}

export interface GalleryMedia {
  id: string;
  uploader: GalleryAuthor;
  round_id: string;
  tournament_id: string;
  tournament_name: string;
  round_name?: string | null;
  round_number: number;
  hole_id?: string | null;
  hole_number?: number | null;
  media_type: GalleryMediaType;
  display_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  duration_seconds?: number | null;
  size_bytes: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface GalleryMediaPage {
  items: GalleryMedia[];
  total: number;
  limit: number;
  offset: number;
}

export interface GalleryComment {
  id: string;
  media_id: string;
  author: GalleryAuthor;
  body: string;
  created_at: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  created_at: string;
  source_type: string;
  source_id?: string | null;
  recipient?: {
    read_at?: string | null;
    popup_seen_at?: string | null;
    dismissed_at?: string | null;
  } | null;
}

export interface PlayerResponse {
  id: string;
  name: string;
  email: string;
  hcp: number;
  role: UserRole;
  is_active: boolean;
  photo_avatar_url?: string | null;
  photo_feature_url?: string | null;
}

export interface CourseResponse {
  id: string;
  name: string;
  slope_rating: number;
  course_rating: number;
  holes: Array<{
    id: string;
    hole_number: number;
    par: number;
    stroke_index: number;
    distance: number;
    image_url?: string | null;
  }>;
}

export interface TournamentResponse {
  id: string;
  name: string;
  date: string;
  player_ids: string[];
}

export interface RoundResponse {
  id: string;
  tournament_id: string;
  course_id: string;
  round_number: number;
  name?: string | null;
  date: string;
  status: RoundStatus;
  locked_at?: string | null;
  player_ids: string[];
}

export interface BonusRuleResponse {
  id: string;
  name: string;
  scope_type: ScopeType;
  tournament_id?: string | null;
  round_id?: string | null;
  points: number;
  winner_message: string;
  definition_jsonb: RuleNode;
  animation_preset: BonusAnimationPreset;
  animation_lottie_url?: string | null;
  enabled: boolean;
}

export interface AchievementRuleResponse {
  id: string;
  name: string;
  scope_type: ScopeType;
  tournament_id?: string | null;
  round_id?: string | null;
  title_template: string;
  message_template: string;
  definition_jsonb: RuleNode;
  icon_preset: AchievementIconPreset;
  enabled: boolean;
}

export interface RoundSummaryItem {
  id: string;
  round_number: number;
  name?: string | null;
  date: string;
  course_name: string;
}

export interface PlayerRoundResult {
  round_id: string;
  holes_played: number;
  stableford: number;
}

export interface TournamentOverviewEntry {
  player_id: string;
  player_name: string;
  avatar_url?: string | null;
  round_results: PlayerRoundResult[];
  total_stableford: number;
  total_holes_played: number;
}

export interface TournamentOverviewResponse {
  tournament_id: string;
  tournament_name: string;
  rounds: RoundSummaryItem[];
  entries: TournamentOverviewEntry[];
}

export type RuleOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in";
export type RuleField =
  | "strokes"
  | "par"
  | "stroke_index"
  | "hole_number"
  | "distance"
  | "gross_to_par"
  | "net_to_par"
  | "round_holes_played"
  | "round_total_strokes"
  | "round_net_strokes"
  | "round_net_par_streak"
  | "round_stableford"
  | "tournament_holes_played"
  | "tournament_total_strokes"
  | "tournament_net_strokes"
  | "tournament_stableford";

export type RuleNode =
  | {
      op: "and" | "or";
      conditions: RuleNode[];
    }
  | {
      field: RuleField;
      operator: RuleOperator;
      value: string | number | Array<string | number>;
    };

export interface PlayerDetail {
  id: string;
  name: string;
  hcp: number;
  age: number | null;
  signature_move: string | null;
  bio: string | null;
  avatar_url: string | null;
  feature_photo_url: string | null;
}
