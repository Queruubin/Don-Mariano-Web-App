/** Dates and times in the store's timezone (PRD section 5). */
const TIME_ZONE = 'America/Bogota';

const timeFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const dateTimeFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "3:20 p. m." */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** "15 oct, 3:20 p. m." */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "hace un momento", "hace 5 min", "hace 2 h", or the date for older orders. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const elapsed = now - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'hace un momento';
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < 24 * HOUR) return `hace ${Math.floor(elapsed / HOUR)} h`;
  return formatDateTime(iso);
}
