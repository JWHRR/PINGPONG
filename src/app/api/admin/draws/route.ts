import { adminHandler, requireId } from '@/lib/api';
import { ServiceError, discardDrawPreview, generateDrawPreview, publishDraw } from '@/lib/service';

export const dynamic = 'force-dynamic';

/**
 * POST { action: 'generate', categoryId, confirmText? }
 * POST { action: 'publish', drawId, confirmReplace? }
 * POST { action: 'discard', drawId }
 */
export const POST = adminHandler(async (ctx, body) => {
  switch (body.action) {
    case 'generate':
      return generateDrawPreview(ctx, requireId(body, 'categoryId'), body.confirmText);
    case 'publish':
      return publishDraw(ctx, requireId(body, 'drawId'), body.confirmReplace === true);
    case 'discard':
      await discardDrawPreview(ctx, requireId(body, 'drawId'));
      return { ok: true };
    default:
      throw new ServiceError(400, 'Unknown action');
  }
});
