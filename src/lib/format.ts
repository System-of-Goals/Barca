import type { Match } from '../data/types';

// All times on the site are shown in Israel time.
const TZ = 'Asia/Jerusalem';

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(new Date(iso)).replace('.', '/');
}

export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long' }).format(new Date(iso));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return 'לפני שעה';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
}

export type Outcome = 'win' | 'draw' | 'loss';

export function outcome(m: Match): Outcome | undefined {
  if (m.status !== 'finished' || m.barcaGoals === undefined || m.opponentGoals === undefined) return undefined;
  if (m.barcaGoals > m.opponentGoals) return 'win';
  if (m.barcaGoals < m.opponentGoals) return 'loss';
  return 'draw';
}

export const outcomeLabel: Record<Outcome, string> = { win: 'ניצחון', draw: 'תיקו', loss: 'הפסד' };

export function splitCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
  };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
