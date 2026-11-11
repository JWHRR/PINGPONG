import { adminHandler, requireId } from '@/lib/api';
import { createParticipant, deleteParticipant, updateParticipant } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = adminHandler((ctx, body) => createParticipant(ctx, body));
export const PATCH = adminHandler((ctx, body) => updateParticipant(ctx, requireId(body), body));
export const DELETE = adminHandler(async (ctx, body) => {
  await deleteParticipant(ctx, requireId(body));
  return { ok: true };
});
