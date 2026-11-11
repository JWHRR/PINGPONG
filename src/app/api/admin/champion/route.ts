import { adminHandler, requireId } from '@/lib/api';
import { ServiceError, declareChampion, reopenCategory } from '@/lib/service';

export const dynamic = 'force-dynamic';

/** POST { action: 'declare' | 'reopen', categoryId } */
export const POST = adminHandler(async (ctx, body) => {
  const categoryId = requireId(body, 'categoryId');
  if (body.action === 'declare') return declareChampion(ctx, categoryId);
  if (body.action === 'reopen') return reopenCategory(ctx, categoryId);
  throw new ServiceError(400, 'Unknown action');
});
