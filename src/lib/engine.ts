import type { Match, Slot } from './types';

export class ConflictError extends Error {
  code = 'DOWNSTREAM_PLAYED';
}

const RESULT_STATUSES = new Set(['completed', 'walkover']);
const ACTIVE_STATUSES = new Set(['in_progress', 'completed', 'walkover']);

export const hasResult = (m: Pick<Match, 'status'>) => RESULT_STATUSES.has(m.status);
export const isActive = (m: Pick<Match, 'status'>) => ACTIVE_STATUSES.has(m.status);
export const idleStatus = (m: Pick<Match, 'scheduled_at'>) => (m.scheduled_at ? 'scheduled' : 'pending');

/**
 * In-memory view of one bracket. All mutations are recorded so the caller can
 * persist exactly the matches that changed.
 */
export class BracketState {
  private byId = new Map<string, Match>();
  private changed = new Set<string>();

  constructor(matches: Match[], readonly rounds: number) {
    for (const m of matches) this.byId.set(m.id, { ...m, games: [...(m.games ?? [])] });
  }

  get(id: string): Match {
    const m = this.byId.get(id);
    if (!m) throw new Error(`Match ${id} not found in bracket`);
    return m;
  }

  at(round: number, position: number): Match | undefined {
    for (const m of this.byId.values()) if (m.round === round && m.position === position) return m;
    return undefined;
  }

  next(m: Match): { match: Match; slot: Slot } | null {
    if (m.round >= this.rounds) return null;
    const match = this.at(m.round + 1, Math.floor(m.position / 2));
    if (!match) return null;
    return { match, slot: m.position % 2 === 0 ? 'a' : 'b' };
  }

  set(m: Match, patch: Partial<Match>) {
    Object.assign(m, patch);
    this.changed.add(m.id);
  }

  changes(): Match[] {
    return [...this.changed].map((id) => this.byId.get(id)!);
  }

  all(): Match[] {
    return [...this.byId.values()];
  }

  /** Clear a match result (and anything downstream that depended on its winner). */
  clearResult(m: Match) {
    const hadWinner = !!m.winner_id;
    this.set(m, {
      games: [],
      winner_id: null,
      status: idleStatus(m),
      started_at: null,
      completed_at: null,
      validated_at: null,
      validated_by: null,
    });
    if (hadWinner) this.removeFromNext(m);
  }

  /** Remove this match's winner from the next round's slot, clearing that match if it was played. */
  removeFromNext(m: Match) {
    const n = this.next(m);
    if (!n) return;
    if (isActive(n.match) || n.match.winner_id) this.clearResult(n.match);
    this.set(n.match, n.slot === 'a' ? { participant_a: null } : { participant_b: null });
  }

  placeInNext(m: Match, participantId: string) {
    const n = this.next(m);
    if (!n) return;
    this.set(n.match, n.slot === 'a' ? { participant_a: participantId } : { participant_b: participantId });
  }

  /** True when the match feeding forward has a next match that has already started or finished. */
  downstreamStarted(m: Match): boolean {
    const n = this.next(m);
    return !!n && isActive(n.match);
  }

  /**
   * Record a validated result and advance the winner.
   * If this corrects an earlier result with a different winner and the next match has
   * already started, `cascade` must be true — the dependent results are then cleared.
   */
  applyResult(m: Match, winnerId: string, patch: Partial<Match>, cascade: boolean) {
    if (winnerId !== m.participant_a && winnerId !== m.participant_b) {
      throw new Error('Winner must be one of the two participants of the match');
    }
    const previous = m.winner_id;
    if (previous && previous !== winnerId) {
      if (this.downstreamStarted(m) && !cascade) {
        throw new ConflictError(
          'The next-round match has already started or finished. Changing this winner will reset those dependent results.',
        );
      }
      this.removeFromNext(m);
    }
    this.set(m, { ...patch, winner_id: winnerId });
    this.placeInNext(m, winnerId);
  }

  /** Undo a result entirely. */
  resetResult(m: Match, cascade: boolean) {
    if (m.winner_id && this.downstreamStarted(m) && !cascade) {
      throw new ConflictError(
        'The next-round match has already started or finished. Resetting this result will also reset those results.',
      );
    }
    this.clearResult(m);
  }

  final(): Match | undefined {
    return this.at(this.rounds, 0);
  }
}

export function slotOf(m: Pick<Match, 'participant_a' | 'participant_b'>, participantId: string): Slot | null {
  if (m.participant_a === participantId) return 'a';
  if (m.participant_b === participantId) return 'b';
  return null;
}
