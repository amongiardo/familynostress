import { parse, isValid, format } from 'date-fns';

export function parseDateOnly(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) {
    return null;
  }

  if (format(parsed, 'yyyy-MM-dd') !== dateStr) {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  // Use UTC noon to avoid timezone offsets shifting the date.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}
