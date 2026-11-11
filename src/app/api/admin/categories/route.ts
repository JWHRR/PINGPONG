import { adminHandler, requireId } from '@/lib/api';
import { createCategory, deleteCategory, updateCategory } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = adminHandler((ctx, body) => createCategory(ctx, body));
export const PATCH = adminHandler((ctx, body) => updateCategory(ctx, requireId(body), body));
export const DELETE = adminHandler(async (ctx, body) => {
  await deleteCategory(ctx, requireId(body));
  return { ok: true };
});
