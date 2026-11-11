import type { Category, Match, Participant, Venue } from './types';
import { SPORT_LABEL, DISCIPLINE_LABEL } from './types';

export function formatDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Dates to be announced';
  if (start && (!end || end === start)) return formatDate(start, { weekday: 'short' });
  if (!start) return formatDate(end);
  return `${formatDate(start, { year: undefined })} – ${formatDate(end)}`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Value for <input type="datetime-local"> in the visitor's local timezone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function categoryShort(c: Pick<Category, 'sport' | 'discipline' | 'level'>) {
  return `${SPORT_LABEL[c.sport]} ${DISCIPLINE_LABEL[c.discipline]} · ${c.level}`;
}

export function participantLabel(p: Participant | undefined | null) {
  return p ? p.name : 'TBD';
}

export function venueName(venues: Map<string, Venue>, id: string | null) {
  return id ? venues.get(id)?.name ?? '' : '';
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return formatDate(iso);
}

export function sortMatchesByTime(a: Match, b: Match) {
  const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
  const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
  if (ta !== tb) return ta - tb;
  return a.number - b.number;
}

export function initials(name: string) {
  return name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}
