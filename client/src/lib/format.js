const money2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function money(value, { sign = false, round = false } = {}) {
  const n = Number(value) || 0;
  const text = (round ? money0 : money2).format(Math.abs(n));
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}${text} Br`;
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function isoDay(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth() {
  return isoDay().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });
const monthGenitive = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export function monthLabel(month) {
  const date = new Date(`${month}-01T12:00:00Z`);
  return `${capitalize(monthName.format(date))} ${month.slice(0, 4)}`;
}

export function monthShort(month) {
  return capitalize(monthName.format(new Date(`${month}-01T12:00:00Z`)));
}

const dayHeader = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function dayLabel(iso) {
  return capitalize(dayHeader.format(new Date(iso)));
}

export function shortDate(iso) {
  return monthGenitive.format(new Date(iso));
}

export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function percent(value) {
  return `${Math.round(value)} %`;
}
