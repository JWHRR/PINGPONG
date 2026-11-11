export type Sport = 'table_tennis' | 'badminton';
export type Discipline = 'singles' | 'doubles';
export type CategoryStatus = 'registration' | 'draw_preview' | 'in_progress' | 'completed';
export type DrawStatus = 'preview' | 'published' | 'superseded';
export type MatchStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'walkover' | 'bye';
export type Slot = 'a' | 'b';
export type PlayerLevel = 'advanced' | 'intermediate' | 'beginner';

export const PLAYER_LEVELS: PlayerLevel[] = ['advanced', 'intermediate', 'beginner'];
export const LEVEL_LABEL: Record<PlayerLevel, string> = {
  advanced: 'Advanced',
  intermediate: 'Intermediate',
  beginner: 'Beginner',
};
/** Lower = stronger. Used to seed the draw. */
export const LEVEL_RANK: Record<PlayerLevel, number> = { advanced: 0, intermediate: 1, beginner: 2 };

export interface Game {
  a: number;
  b: number;
}

export interface Settings {
  id: number;
  tournament_name: string;
  tagline: string;
  table_tennis_title: string;
  badminton_title: string;
  start_date: string | null;
  end_date: string | null;
  location: string;
  description: string;
  organizer: string;
  updated_at: string;
}

export interface Category {
  id: string;
  sport: Sport;
  discipline: Discipline;
  level: string;
  name: string;
  sort_order: number;
  status: CategoryStatus;
  champion_id: string | null;
  champion_declared_at: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  category_id: string;
  name: string;
  player1: string;
  player2: string | null;
  club: string | null;
  seed: number | null;
  level: PlayerLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  sport: Sport | 'any';
  active: boolean;
  created_at: string;
}

export interface OriginalDrawSlot {
  position: number;
  seed_number: number;
  participant_id: string | null;
  name: string | null;
  seed: number | null;
  level?: PlayerLevel | null;
}

export interface OriginalDraw {
  algorithm: string;
  generated_at: string;
  rng_seed: string;
  bracket_size: number;
  rounds: number;
  participant_count: number;
  byes: number;
  slots: OriginalDrawSlot[];
}

export interface Draw {
  id: string;
  category_id: string;
  version: number;
  status: DrawStatus;
  bracket_size: number;
  rounds: number;
  participant_count: number;
  rng_seed: string;
  original_draw: OriginalDraw;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  published_by: string | null;
  superseded_at: string | null;
}

export interface Match {
  id: string;
  draw_id: string;
  category_id: string;
  round: number;
  position: number;
  number: number;
  participant_a: string | null;
  participant_b: string | null;
  bye: boolean;
  status: MatchStatus;
  games: Game[];
  winner_id: string | null;
  scheduled_at: string | null;
  venue_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  notes: string | null;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  user_id: string | null;
  action: string;
  category_id: string | null;
  details: Record<string, unknown>;
}

export const SPORT_LABEL: Record<Sport, string> = {
  table_tennis: 'Table Tennis',
  badminton: 'Badminton',
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  walkover: 'Walkover',
  bye: 'BYE',
};

export const CATEGORY_STATUS_LABEL: Record<CategoryStatus, string> = {
  registration: 'Registration open',
  draw_preview: 'Draw in preview',
  in_progress: 'In progress',
  completed: 'Completed',
};
