'use client';

import type { Category, Sport } from '@/lib/types';
import { DISCIPLINE_LABEL, SPORT_LABEL } from '@/lib/types';
import { SportIcon, cx } from './ui';

/** Sport tabs + category chips; used by the public draw page and the admin. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  badge,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  badge?: (c: Category) => React.ReactNode;
}) {
  const current = categories.find((c) => c.id === value);
  const sports: Sport[] = ['table_tennis', 'badminton'];
  const sport = current?.sport ?? (categories[0]?.sport || 'table_tennis');
  const list = categories.filter((c) => c.sport === sport);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-2xl bg-slate-200/70 p-1">
        {sports.map((s) => {
          const first = categories.find((c) => c.sport === s);
          return (
            <button
              key={s}
              disabled={!first}
              onClick={() => first && onChange(first.id)}
              className={cx(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40',
                sport === s ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900',
              )}
            >
              <SportIcon sport={s} className="h-4 w-4" />
              {SPORT_LABEL[s]}
            </button>
          );
        })}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cx(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              c.id === value
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-slate-200 bg-white text-navy-700 hover:border-slate-300',
            )}
          >
            <span className={cx('text-[10px] uppercase tracking-wider', c.id === value ? 'text-pitch-300' : 'text-slate-400')}>
              {DISCIPLINE_LABEL[c.discipline]}
            </span>
            {c.level}
            {badge?.(c)}
          </button>
        ))}
      </div>
    </div>
  );
}
