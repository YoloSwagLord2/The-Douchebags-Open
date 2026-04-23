CREATE TYPE user_role AS ENUM ('player', 'admin');

CREATE TYPE round_status AS ENUM ('open', 'locked');

CREATE TYPE score_change_source AS ENUM ('player_save', 'admin_override', 'system_recompute');

CREATE TYPE scope_type AS ENUM ('round', 'tournament');

CREATE TYPE bonus_animation_preset AS ENUM ('confetti', 'fireworks', 'spotlight', 'chaos');

CREATE TYPE bonus_animation_snapshot_preset AS ENUM ('confetti', 'fireworks', 'spotlight', 'chaos');

CREATE TYPE achievement_scope_type AS ENUM ('round', 'tournament');

CREATE TYPE achievement_icon_preset AS ENUM ('star', 'ace', 'flame', 'trophy');

CREATE TYPE achievement_icon_snapshot_preset AS ENUM ('star', 'ace', 'flame', 'trophy');

CREATE TYPE notification_type AS ENUM ('admin_message', 'achievement', 'bonus', 'system');

CREATE TYPE notification_source_type AS ENUM ('admin_message', 'achievement_event', 'bonus_award', 'system');

CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high');

CREATE TABLE users (
	name VARCHAR(120) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash TEXT NOT NULL, 
	hcp NUMERIC(4, 1) NOT NULL, 
	role user_role NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	photo_original_path VARCHAR(255), 
	photo_avatar_path VARCHAR(255), 
	photo_feature_path VARCHAR(255), 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_users PRIMARY KEY (id), 
	CONSTRAINT ck_users_hcp_nonnegative CHECK (hcp >= 0), 
	CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE courses (
	name VARCHAR(120) NOT NULL, 
	slope_rating INTEGER NOT NULL, 
	course_rating NUMERIC(4, 1) NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_courses PRIMARY KEY (id), 
	CONSTRAINT uq_courses_name UNIQUE (name)
);

CREATE TABLE tournaments (
	name VARCHAR(160) NOT NULL, 
	date DATE NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_tournaments PRIMARY KEY (id)
);

CREATE TABLE holes (
	course_id UUID NOT NULL, 
	hole_number INTEGER NOT NULL, 
	par INTEGER NOT NULL, 
	stroke_index INTEGER NOT NULL, 
	distance INTEGER NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_holes PRIMARY KEY (id), 
	CONSTRAINT uq_holes_course_id_hole_number UNIQUE (course_id, hole_number), 
	CONSTRAINT uq_holes_course_id_stroke_index UNIQUE (course_id, stroke_index), 
	CONSTRAINT fk_holes_course_id_courses FOREIGN KEY(course_id) REFERENCES courses (id) ON DELETE CASCADE
);

CREATE TABLE rounds (
	tournament_id UUID NOT NULL, 
	course_id UUID NOT NULL, 
	round_number INTEGER NOT NULL, 
	date DATE NOT NULL, 
	status round_status NOT NULL, 
	locked_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_rounds PRIMARY KEY (id), 
	CONSTRAINT uq_rounds_tournament_round_number UNIQUE (tournament_id, round_number), 
	CONSTRAINT fk_rounds_tournament_id_tournaments FOREIGN KEY(tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE, 
	CONSTRAINT fk_rounds_course_id_courses FOREIGN KEY(course_id) REFERENCES courses (id)
);

CREATE TABLE tournament_players (
	tournament_id UUID NOT NULL, 
	player_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_tournament_players PRIMARY KEY (id), 
	CONSTRAINT uq_tournament_players_pair UNIQUE (tournament_id, player_id), 
	CONSTRAINT fk_tournament_players_tournament_id_tournaments FOREIGN KEY(tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE, 
	CONSTRAINT fk_tournament_players_player_id_users FOREIGN KEY(player_id) REFERENCES users (id)
);

CREATE TABLE notifications (
	type notification_type NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	body TEXT NOT NULL, 
	source_type notification_source_type NOT NULL, 
	source_id UUID, 
	priority notification_priority NOT NULL, 
	created_by_user_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID NOT NULL, 
	CONSTRAINT pk_notifications PRIMARY KEY (id), 
	CONSTRAINT fk_notifications_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id)
);

CREATE TABLE scores (
	round_id UUID NOT NULL, 
	player_id UUID NOT NULL, 
	hole_id UUID NOT NULL, 
	strokes INTEGER NOT NULL, 
	updated_by_user_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_scores PRIMARY KEY (id), 
	CONSTRAINT uq_scores_round_player_hole UNIQUE (round_id, player_id, hole_id), 
	CONSTRAINT fk_scores_round_id_rounds FOREIGN KEY(round_id) REFERENCES rounds (id) ON DELETE CASCADE, 
	CONSTRAINT fk_scores_player_id_users FOREIGN KEY(player_id) REFERENCES users (id), 
	CONSTRAINT fk_scores_hole_id_holes FOREIGN KEY(hole_id) REFERENCES holes (id), 
	CONSTRAINT fk_scores_updated_by_user_id_users FOREIGN KEY(updated_by_user_id) REFERENCES users (id)
);

CREATE TABLE bonus_rules (
	name VARCHAR(120) NOT NULL, 
	scope_type scope_type NOT NULL, 
	tournament_id UUID, 
	round_id UUID, 
	points INTEGER NOT NULL, 
	winner_message TEXT NOT NULL, 
	definition_jsonb JSONB NOT NULL, 
	animation_preset bonus_animation_preset NOT NULL, 
	animation_lottie_url TEXT, 
	enabled BOOLEAN NOT NULL, 
	created_by_user_id UUID NOT NULL, 
	updated_by_user_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_bonus_rules PRIMARY KEY (id), 
	CONSTRAINT ck_bonus_rules_bonus_points_positive CHECK (points > 0), 
	CONSTRAINT ck_bonus_rules_bonus_scope_reference_match CHECK ((scope_type = 'round' AND round_id IS NOT NULL AND tournament_id IS NULL) OR (scope_type = 'tournament' AND tournament_id IS NOT NULL AND round_id IS NULL)), 
	CONSTRAINT fk_bonus_rules_tournament_id_tournaments FOREIGN KEY(tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE, 
	CONSTRAINT fk_bonus_rules_round_id_rounds FOREIGN KEY(round_id) REFERENCES rounds (id) ON DELETE CASCADE, 
	CONSTRAINT fk_bonus_rules_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	CONSTRAINT fk_bonus_rules_updated_by_user_id_users FOREIGN KEY(updated_by_user_id) REFERENCES users (id)
);

CREATE TABLE achievement_rules (
	name VARCHAR(120) NOT NULL, 
	scope_type achievement_scope_type NOT NULL, 
	tournament_id UUID, 
	round_id UUID, 
	title_template VARCHAR(160) NOT NULL, 
	message_template TEXT NOT NULL, 
	definition_jsonb JSONB NOT NULL, 
	icon_preset achievement_icon_preset NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	created_by_user_id UUID NOT NULL, 
	updated_by_user_id UUID NOT NULL, 
	id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_achievement_rules PRIMARY KEY (id), 
	CONSTRAINT ck_achievement_rules_achievement_scope_reference_match CHECK ((scope_type = 'round' AND round_id IS NOT NULL AND tournament_id IS NULL) OR (scope_type = 'tournament' AND tournament_id IS NOT NULL AND round_id IS NULL)), 
	CONSTRAINT fk_achievement_rules_tournament_id_tournaments FOREIGN KEY(tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE, 
	CONSTRAINT fk_achievement_rules_round_id_rounds FOREIGN KEY(round_id) REFERENCES rounds (id) ON DELETE CASCADE, 
	CONSTRAINT fk_achievement_rules_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id), 
	CONSTRAINT fk_achievement_rules_updated_by_user_id_users FOREIGN KEY(updated_by_user_id) REFERENCES users (id)
);

CREATE TABLE notification_recipients (
	notification_id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	read_at TIMESTAMP WITH TIME ZONE, 
	popup_seen_at TIMESTAMP WITH TIME ZONE, 
	dismissed_at TIMESTAMP WITH TIME ZONE, 
	id UUID NOT NULL, 
	CONSTRAINT pk_notification_recipients PRIMARY KEY (id), 
	CONSTRAINT uq_notification_recipient_pair UNIQUE (notification_id, user_id), 
	CONSTRAINT fk_notification_recipients_notification_id_notifications FOREIGN KEY(notification_id) REFERENCES notifications (id) ON DELETE CASCADE, 
	CONSTRAINT fk_notification_recipients_user_id_users FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE score_revisions (
	score_id UUID NOT NULL, 
	round_id UUID NOT NULL, 
	player_id UUID NOT NULL, 
	hole_id UUID NOT NULL, 
	previous_strokes INTEGER, 
	new_strokes INTEGER NOT NULL, 
	change_source score_change_source NOT NULL, 
	changed_by_user_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	id UUID NOT NULL, 
	CONSTRAINT pk_score_revisions PRIMARY KEY (id), 
	CONSTRAINT fk_score_revisions_score_id_scores FOREIGN KEY(score_id) REFERENCES scores (id) ON DELETE CASCADE, 
	CONSTRAINT fk_score_revisions_round_id_rounds FOREIGN KEY(round_id) REFERENCES rounds (id) ON DELETE CASCADE, 
	CONSTRAINT fk_score_revisions_player_id_users FOREIGN KEY(player_id) REFERENCES users (id), 
	CONSTRAINT fk_score_revisions_hole_id_holes FOREIGN KEY(hole_id) REFERENCES holes (id), 
	CONSTRAINT fk_score_revisions_changed_by_user_id_users FOREIGN KEY(changed_by_user_id) REFERENCES users (id)
);

CREATE TABLE bonus_awards (
	bonus_rule_id UUID NOT NULL, 
	player_id UUID NOT NULL, 
	trigger_score_revision_id UUID NOT NULL, 
	points_snapshot INTEGER NOT NULL, 
	message_snapshot TEXT NOT NULL, 
	animation_preset_snapshot bonus_animation_snapshot_preset NOT NULL, 
	animation_lottie_url_snapshot TEXT, 
	awarded_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	revoked_reason TEXT, 
	id UUID NOT NULL, 
	CONSTRAINT pk_bonus_awards PRIMARY KEY (id), 
	CONSTRAINT fk_bonus_awards_bonus_rule_id_bonus_rules FOREIGN KEY(bonus_rule_id) REFERENCES bonus_rules (id) ON DELETE CASCADE, 
	CONSTRAINT fk_bonus_awards_player_id_users FOREIGN KEY(player_id) REFERENCES users (id), 
	CONSTRAINT fk_bonus_awards_trigger_score_revision_id_score_revisions FOREIGN KEY(trigger_score_revision_id) REFERENCES score_revisions (id) ON DELETE CASCADE
);

CREATE TABLE achievement_events (
	achievement_rule_id UUID NOT NULL, 
	player_id UUID NOT NULL, 
	round_id UUID, 
	tournament_id UUID, 
	trigger_score_revision_id UUID NOT NULL, 
	occurrence_key VARCHAR(255) NOT NULL, 
	title_snapshot VARCHAR(160) NOT NULL, 
	message_snapshot TEXT NOT NULL, 
	icon_snapshot achievement_icon_snapshot_preset NOT NULL, 
	triggered_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	revoked_reason TEXT, 
	id UUID NOT NULL, 
	CONSTRAINT pk_achievement_events PRIMARY KEY (id), 
	CONSTRAINT uq_achievement_events_rule_occurrence UNIQUE (achievement_rule_id, occurrence_key), 
	CONSTRAINT fk_achievement_events_achievement_rule_id_achievement_rules FOREIGN KEY(achievement_rule_id) REFERENCES achievement_rules (id) ON DELETE CASCADE, 
	CONSTRAINT fk_achievement_events_player_id_users FOREIGN KEY(player_id) REFERENCES users (id), 
	CONSTRAINT fk_achievement_events_round_id_rounds FOREIGN KEY(round_id) REFERENCES rounds (id) ON DELETE CASCADE, 
	CONSTRAINT fk_achievement_events_tournament_id_tournaments FOREIGN KEY(tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE, 
	CONSTRAINT fk_achievement_events_trigger_score_revision_id_score_revisions FOREIGN KEY(trigger_score_revision_id) REFERENCES score_revisions (id) ON DELETE CASCADE
);
