// One-off check of candidate data sources, run on GitHub's servers at the
// owner's explicit request. Prints what each source returns for Barcelona.

const UA = { 'user-agent': 'Mozilla/5.0 (personal fan site data check)' };

async function get(url, asText = false) {
  try {
    const r = await fetch(url, { headers: UA });
    const body = asText ? await r.text() : await r.json().catch(() => null);
    return { status: r.status, body };
  } catch (e) {
    return { status: 'ERR ' + e.message, body: null };
  }
}

const line = (s) => console.log(s);
const espn = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
let lastEvent;

line('===== ESPN =====');
for (const lg of ['esp.1', 'uefa.champions', 'esp.copa_del_rey', 'esp.super_cup']) {
  const up = await get(`${espn}/${lg}/teams/83/schedule?fixture=true`);
  const past = await get(`${espn}/${lg}/teams/83/schedule`);
  const ev = up.body?.events ?? [];
  const pev = past.body?.events ?? [];
  line(`[${lg}] upcoming: HTTP ${up.status}, ${ev.length}; first: ${ev[0]?.date ?? '-'} ${ev[0]?.name ?? ''}`);
  line(`[${lg}] played: HTTP ${past.status}, ${pev.length}; last: ${pev.at(-1)?.date ?? '-'} ${pev.at(-1)?.name ?? ''}`);
  if (lg === 'esp.1' && pev.length) lastEvent = pev.at(-1).id;
}
const roster = await get(`${espn}/esp.1/teams/83/roster`);
const ath = roster.body?.athletes ?? [];
line(`[roster] HTTP ${roster.status}, ${ath.length} players; with photo: ${ath.filter((a) => a.headshot?.href).length}; sample: ${ath.slice(0, 3).map((a) => `${a.jersey ?? '?'} ${a.displayName}`).join(', ')}`);
const st = await get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings');
const entries = st.body?.children?.[0]?.standings?.entries ?? [];
line(`[standings esp.1] HTTP ${st.status}, ${entries.length} teams; top: ${entries.slice(0, 3).map((e) => e.team?.displayName).join(', ')}`);
if (lastEvent) {
  const s = await get(`${espn}/esp.1/summary?event=${lastEvent}`);
  const b = s.body ?? {};
  line(`[summary ${lastEvent}] HTTP ${s.status}; lineups: ${b.rosters?.length ?? 0}; formation: ${b.rosters?.[0]?.formation ?? '-'}; stats: ${b.boxscore?.teams?.[0]?.statistics?.map((x) => x.name).slice(0, 6).join(',') ?? '-'}; key events: ${b.keyEvents?.length ?? 0}`);
}

line('');
line('===== 365Scores =====');
let barcaId;
for (const lang of [2, 1]) {
  const r = await get(`https://webws.365scores.com/web/search/?langId=${lang}&query=barcelona`);
  const comps = r.body?.competitors ?? [];
  line(`[search langId=${lang}] HTTP ${r.status}; ${comps.slice(0, 4).map((c) => `${c.id}:${c.name}:sport${c.sportId}`).join(' | ')}`);
  if (lang === 2 && comps.length) barcaId = (comps.find((c) => c.sportId === 1) ?? comps[0]).id;
}
const id = barcaId ?? 132;
const q = `appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&competitors=${id}`;
const fx = await get(`https://webws.365scores.com/web/games/fixtures/?${q}`);
const g = fx.body?.games ?? [];
line(`[fixtures ${id}] HTTP ${fx.status}; ${g.length}; first: ${g[0]?.startTime ?? '-'} ${g[0]?.homeCompetitor?.name ?? ''} - ${g[0]?.awayCompetitor?.name ?? ''} (${g[0]?.competitionDisplayName ?? ''})`);
const rs = await get(`https://webws.365scores.com/web/games/results/?${q}`);
const rg = rs.body?.games ?? [];
const lg = rg.at(-1);
line(`[results] HTTP ${rs.status}; ${rg.length}; last: ${lg?.startTime ?? '-'} ${lg?.homeCompetitor?.name ?? ''} ${lg?.homeCompetitor?.score ?? ''}-${lg?.awayCompetitor?.score ?? ''} ${lg?.awayCompetitor?.name ?? ''}`);
if (lg?.id) {
  const gm = await get(`https://webws.365scores.com/web/game/?appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&gameId=${lg.id}`);
  const game = gm.body?.game ?? {};
  const lu = game.homeCompetitor?.lineups;
  const rated = (lu?.members ?? []).filter((m) => m.ranking ?? m.rating).length;
  line(`[game ${lg.id}] HTTP ${gm.status}; lineup: ${lu?.members?.length ?? 0}; formation: ${lu?.formation ?? '-'}; rated: ${rated}; keys: ${Object.keys(game).slice(0, 25).join(',')}`);
}

line('');
line('===== 365Scores terms =====');
for (const u of ['https://365scores.info/pages/terms', 'https://www.365scores.com/he/terms']) {
  const t = await get(u, true);
  const text = String(t.body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  line(`[${u}] HTTP ${t.status}, ${text.length} chars`);
  for (const h of (text.match(/[^.]{0,220}(scrap|crawl|robot|automat|spider|harvest|data mining|commercial)[^.]{0,220}\./gi) ?? []).slice(0, 8)) line('  > ' + h.trim());
}
