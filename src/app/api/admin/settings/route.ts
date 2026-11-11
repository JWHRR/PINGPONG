import { adminHandler } from '@/lib/api';
import { updateSettings } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const PATCH = adminHandler((ctx, body) => updateSettings(ctx, body));
