// Backup source: ESPN's public data, used only when 365Scores fails.
// Gives matches, results and the La Liga table (team names in English).

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const TEAM = '83'; // FC Barcelona on ESPN
const UA = { 'user-agent': 'Mozilla/5.0 (personal non-commercial fan site)' };
const LEAGUES = [
  { code: 'esp.1', name: 'לה ליגה' },
  { code: 'uefa.champions', name: 'ליגת האלופות' },
  { code: 'esp.copa_del_rey', name: 'גביע המלך' },
  { code: 'esp.super_cup', name: 'סופר קאפ' },
];

const get = (url) => fetch(url, { headers: UA }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ESPN HTTP ${r.status}`))));
const score = (s) => {
  const v = typeof s === 'object' ? (s?.value ?? s?.displayValue) : s;
  return v === undefined || v === '' ? undefined : Number(v);
};

function toMatch(ev, competition) {
  const c = ev.competitions?.[0];
  const us = c?.competitors?.find((x) => String(x.team?.id ?? x.id) === TEAM);
  const them = c?.competitors?.find((x) => x !== us);
  if (!us || !them) return undefined;
  const state = c.status?.type?.state ?? ev.status?.type?.state;
  const status = state === 'post' ? 'finished' : state === 'in' ? 'live' : 'scheduled';
  return {
    id: `espn-${ev.id}`,
    competition,
    round: '',
    kickoff: new Date(ev.date).toISOString(),
    venue: c.venue?.fullName ?? (us.homeAway === 'home' ? 'בית' : 'חוץ'),
    home: us.homeAway === 'home',
    opponent: { name: them.team?.displayName ?? them.team?.name ?? '' },
    status,
    ...(status !== 'scheduled' ? { barcaGoals: score(us.score), opponentGoals: score(them.score) } : {}),
  };
}

export async function fromEspn(seasonStart) {
  const matches = [];
  for (const { code, name } of LEAGUES) {
    for (const url of [`${BASE}/${code}/teams/${TEAM}/schedule`, `${BASE}/${code}/teams/${TEAM}/schedule?fixture=true`]) {
      try {
        for (const ev of (await get(url)).events ?? []) {
          const m = toMatch(ev, name);
          if (m && new Date(m.kickoff) >= seasonStart && !matches.some((x) => x.id === m.id)) matches.push(m);
        }
      } catch (e) {
        console.warn(`ESPN ${code}: ${e.message}`);
      }
    }
  }
  const standings = [];
  try {
    const st = await get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings');
    const entries = st.children?.[0]?.standings?.entries ?? [];
    const stat = (e, n) => e.stats?.find((s) => s.name === n)?.value;
    const sorted = [...entries].sort((a, b) => stat(a, 'rank') - stat(b, 'rank'));
    const i = sorted.findIndex((e) => String(e.team?.id) === TEAM);
    if (i >= 0) {
      const row = sorted[i];
      const other = i === 0 ? sorted[1] : sorted[0];
      const gap = Math.abs(stat(row, 'points') - stat(other, 'points'));
      standings.push({
        competition: 'לה ליגה',
        position: stat(row, 'rank') ?? i + 1,
        points: stat(row, 'points'),
        played: stat(row, 'gamesPlayed'),
        note: `${gap} נק׳ ${i === 0 ? 'לפני' : 'אחרי'} ${other.team?.displayName}`,
      });
    }
  } catch (e) {
    console.warn(`ESPN standings: ${e.message}`);
  }
  if (!matches.length) throw new Error('ESPN: no matches');
  return { matches, standings };
}
