import { adminHandler, requireId } from '@/lib/api';
import {
  ServiceError,
  awardWalkover,
  confirmResult,
  resetMatch,
  saveLiveScore,
  scheduleMatch,
} from '@/lib/service';

export const dynamic = 'force-dynamic';

/**
 * POST { action: 'schedule', matchId, scheduled_at?, venue_id? }
 * POST { action: 'live', matchId, games }
 * POST { action: 'confirm', matchId, games, cascade? }
 * POST { action: 'walkover', matchId, winnerId, reason?, cascade? }
 * POST { action: 'reset', matchId, cascade? }
 */
export const POST = adminHandler(async (ctx, body) => {
  const matchId = requireId(body, 'matchId');
  const cascade = body.cascade === true;
  switch (body.action) {
    case 'schedule': {
      const input: { scheduled_at?: string | null; venue_id?: string | null } = {};
      if ('scheduled_at' in body) input.scheduled_at = body.scheduled_at;
      if ('venue_id' in body) input.venue_id = body.venue_id;
      return scheduleMatch(ctx, matchId, input);
    }
    case 'live':
      return saveLiveScore(ctx, matchId, body.games);
    case 'confirm':
      return confirmResult(ctx, matchId, body.games, cascade);
    case 'walkover':
      return awardWalkover(ctx, matchId, requireId(body, 'winnerId'), body.reason, cascade);
    case 'reset':
      return resetMatch(ctx, matchId, cascade);
    default:
      throw new ServiceError(400, 'Unknown action');
  }
});
