import { adminHandler, requireId } from '@/lib/api';
import { createVenue, deleteVenue, updateVenue } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = adminHandler((ctx, body) => createVenue(ctx, body));
export const PATCH = adminHandler((ctx, body) => updateVenue(ctx, requireId(body), body));
export const DELETE = adminHandler(async (ctx, body) => {
  await deleteVenue(ctx, requireId(body));
  return { ok: true };
});
