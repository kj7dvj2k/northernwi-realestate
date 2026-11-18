// Builds stats/wi-stats.json: for-sale and sold numbers per county and per zip for the AgentFire site's
// Wisconsin maps (home page and /wi/). Runs every 15 minutes from .github/workflows/wi-stats.yml.
// The numbers follow the site bundle's own rules (isg-site.js wiPage, ISG.version .438):
//   t  for sale: Active or Coming Soon, no lease/rent, no income listing under $10,000
//   h  homes, l land, w waterfront (FS_TYPES)    n  listed in the past 90 days    s  sold in the past 12 months
// Source: the ISG Lofty site's search API (the AgentFire proxy refuses server calls). That site carries more MLSs
// than the AgentFire site, so only the MLSs the AgentFire site carries are counted (ORGS).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const SITE = 'https://idx.inter-state.realestate';
const ORGS = (process.env.WI_ORGS || '983,821').split(',').map(Number); // 983 LSAR, 821 (sold feed); add a feed here when the AgentFire site gets one
const SLUGS = ['bayfield-county', 'ashland-county', 'douglas-county', 'sawyer-county', 'iron-county', 'price-county', 'rusk-county', 'washburn-county', 'barron-county', 'burnett-county'];
const OUT = 'stats/wi-stats.json';
const HDR = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', Accept: 'application/json, text/plain, */*', Referer: SITE + '/listing/', 'X-Requested-With': 'XMLHttpRequest' };

export async function build(getJson) {
  const now = Date.now(), YR = 365 * 86400000;
  const nm = s => s.replace('-county', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const fsIs = (l, k) => { const pt = String(l.propertyType || ''), pr = String(l.primaryType || '');
    if (k === 'condo') return /condo|townho/i.test(pt);
    if (k === 'land') return /vacant|land/i.test(pt) || /land/i.test(pr);
    if (k === 'commercial') return /commercial|business/i.test(pt) || /commercial/i.test(pr);
    return false; };
  const TY = { waterfront: l => /^(true|yes|y)$/i.test(String(l.waterfrontFlag)), homes: l => !fsIs(l, 'condo') && !fsIs(l, 'land') && !fsIs(l, 'commercial'), land: l => fsIs(l, 'land') };
  const FS_GRP = l => { const st = String(l.listingStatus || 'Active').trim(); return (!st || /^active$|coming/i.test(st)) ? 'f' : 'u'; };
  const forSale = L => { const seen = {}; return L.filter(x => { if (seen[x.id]) return false; seen[x.id] = 1; const pt = String(x.primaryType || ''); return !(/lease|rent/i.test(pt) || (/income/i.test(pt) && Number(x.price) < 10000)) && FS_GRP(x) === 'f'; }); };
  const sdt = l => Date.parse(String(l.soldDateStr || '').slice(0, 10)) || 0;
  const isN = x => x.mlsListDateL && now / 1000 - x.mlsListDateL <= 90 * 86400;
  const ours = l => ORGS.includes(Number(l.mlsOrgId));
  const page = (c, type, n) => getJson(SITE + '/api-site/search/realTimeListings?condition=' + encodeURIComponent(JSON.stringify(c)) + '&pageSize=100&page=' + n + '&currPage=' + n + '&listingSort=RELEVANCE&listingType=' + type)
    .then(j => { const d = (j && j.data) || j; if (!d || !Array.isArray(d.listings)) throw new Error('feed: ' + type + ' ' + JSON.stringify(c)); return d.listings; });
  const all = async (c, type) => { let out = []; for (let n = 1; n <= 40; n++) { const L = await page(c, type, n); out = out.concat(L); if (L.length < 100) return out; } throw new Error('over 40 pages: ' + JSON.stringify(c)); };
  const d = {}, z = {}, seenZ = {};
  for (const s of SLUGS) {
    const n0 = nm(s), c = { location: { county: [n0 + ' County, WI', n0 + ', WI'] } };
    const f = forSale((await all(c, 'all-listing')).filter(ours));
    const ss = {}, sy = (await all(Object.assign({ soldDate: '366' }, c), 'sold-listing')).filter(ours).filter(x => { if (ss[x.id] || !(Number(x.soldPrice) > 0)) return false; ss[x.id] = 1; return now - sdt(x) <= YR; });
    d[s] = { t: f.length, h: f.filter(TY.homes).length, l: f.filter(TY.land).length, w: f.filter(TY.waterfront).length, n: f.filter(isN).length, s: sy.length };
    const zo = x => { const k = String(x.zipCode || '').slice(0, 5); if (!k || seenZ[x.id]) return null; seenZ[x.id] = 1; return z[k] || (z[k] = { t: 0, h: 0, l: 0, w: 0, n: 0, s: 0 }); };
    f.forEach(x => { const o = zo(x); if (!o) return; o.t++; if (TY.homes(x)) o.h++; if (TY.land(x)) o.l++; if (TY.waterfront(x)) o.w++; if (isN(x)) o.n++; });
    sy.forEach(x => { const o = zo(x); if (o) o.s++; });
  }
  return { d, z };
}

if (process.argv[1] && process.argv[1].endsWith('wi-stats.mjs')) {
  const getJson = async url => { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: HDR }); if (r.ok) return await r.json(); } catch (e) {} await new Promise(r => setTimeout(r, 2000 * (i + 1))); } throw new Error('fetch failed: ' + url.slice(0, 160)); };
  const { d, z } = await build(getJson);
  let prev = null; try { if (existsSync(OUT)) prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) {}
  const same = prev && JSON.stringify(prev.d) === JSON.stringify(d) && JSON.stringify(prev.z) === JSON.stringify(z);
  const age = prev ? Date.now() - Date.parse(prev.generated) : Infinity;
  // the file is rewritten when a number changed, and at least every 3 hours so its date shows it is current
  if (same && age < 3 * 3600000) { console.log('unchanged'); process.exit(0); }
  mkdirSync('stats', { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), orgs: ORGS, d, z }));
  console.log('written', Object.keys(z).length, 'zips');
}
