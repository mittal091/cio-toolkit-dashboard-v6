import { esc, date } from './format.js';
import { buildAll, STATUS_WORDS } from './models.js';
import { card, statusPill } from './components/card.js';
import { detail } from './components/detail.js';

const $ = id => document.getElementById(id);
const state = { domain: '', owner: '', kpi: '' };
let KPIS = [], MODEL = {}, DESC = {}, ASOF = '', lastFocus = null;

async function load() {
  const [kpis, data, seq, desc] = await Promise.all(['data/kpis.json', 'data/kpi-data.json', 'data/sequence.json', 'data/descriptions.json'].map(p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); })));
  DESC = desc;
  KPIS = seq.map(id => kpis.find(k => k.id === id)).filter(Boolean);
  ASOF = data.asOf;
  MODEL = buildAll(KPIS, data, ASOF);
}

const unique = list => [...new Set(list)];

/* Domain buttons and the owner drop-down only offer choices that have at least one KPI, so no combination is empty.
   Each choice shows how many KPIs it would give. */
function fillFilters() {
  const byOwner = KPIS.filter(k => !state.owner || k.owner === state.owner);
  const byDomain = KPIS.filter(k => !state.domain || k.domain === state.domain);
  const domains = unique(byOwner.map(k => k.domain));
  const owners = unique(byDomain.map(k => k.owner)).sort((a, b) => a.localeCompare(b));
  const dchip = (value, label, n) => `<button type="button" class="dchip" data-domain="${esc(value)}" aria-pressed="${value === state.domain}">${esc(label)} <b>${n}</b></button>`;
  $('domains').innerHTML = dchip('', 'All domains', byOwner.length) + domains.map(d => dchip(d, d, byOwner.filter(k => k.domain === d).length)).join('');
  $('owner').innerHTML = `<option value="">All owners (${byDomain.length})</option>` + owners.map(o => `<option value="${esc(o)}"${o === state.owner ? ' selected' : ''}>${esc(o)} (${byDomain.filter(k => k.owner === o).length})</option>`).join('');
}

function render() {
  fillFilters();
  const list = KPIS.filter(k => (!state.domain || k.domain === state.domain) && (!state.owner || k.owner === state.owner));
  $('meta').textContent = `Sample data · as of ${date(ASOF)}`;
  const count = level => list.filter(k => MODEL[k.id].status.level === level).length;
  const risk = list.filter(k => MODEL[k.id].status.level === 'risk');
  $('summary').innerHTML = `<div class="summary"><span class="sum-n">${list.length} ${list.length === 1 ? 'KPI' : 'KPIs'}</span>` +
    ['good', 'watch', 'risk'].map(l => `<span class="sum-s">${statusPill(l)} <b>${count(l)}</b></span>`).join('') +
    (risk.length ? `<span class="sum-risk">At risk: ${risk.map(k => `<button type="button" class="chip" data-kpi="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</span>` : '') + `</div>`;
  const domains = unique(list.map(k => k.domain));
  $('view').innerHTML = domains.map((d, i) => {
    const items = list.filter(k => k.domain === d);
    return `<section class="domain" aria-labelledby="dom-${i}"><h2 id="dom-${i}">${esc(d)} <span>${items.length} ${items.length === 1 ? 'KPI' : 'KPIs'}</span></h2><div class="grid">${items.map(k => card(k, MODEL[k.id])).join('')}</div></section>`;
  }).join('');
}

function syncHash() {
  const p = new URLSearchParams();
  if (state.domain) p.set('domain', state.domain);
  if (state.owner) p.set('owner', state.owner);
  if (state.kpi) p.set('kpi', state.kpi);
  try { history.replaceState(null, '', p.toString() ? '#' + p : location.pathname + location.search); } catch (e) { /* ignore */ }
}

function openDetail(id) {
  const k = KPIS.find(x => x.id === id);
  if (!k) return;
  state.kpi = id;
  $('detail-body').innerHTML = detail(k, MODEL[id], DESC[id]);
  const dlg = $('detail');
  if (!dlg.open) (dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''));
  dlg.scrollTop = 0;
  document.title = `${k.name} · CIO Toolkit Dashboard`;
  syncHash();
}
function closeDetail() {
  const dlg = $('detail');
  if (dlg.open) dlg.close();
}
$('detail').addEventListener('close', () => {
  state.kpi = '';
  document.title = 'CIO Toolkit Dashboard';
  syncHash();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
});

document.addEventListener('click', e => {
  const t = e.target;
  if (t === $('detail')) return closeDetail(); // click on the dim background
  if (t.closest('a.skip')) { e.preventDefault(); $('view').focus(); return; }
  const k = t.closest('[data-kpi]');
  if (k) { lastFocus = k; return openDetail(k.dataset.kpi); }
  if (t.closest('#close')) return closeDetail();
  const tab = t.closest('[data-tabset]');
  if (tab) {
    const set = tab.dataset.tabset, i = tab.dataset.i;
    document.querySelectorAll(`[data-tabset="${set}"]`).forEach(b => { const on = b.dataset.i === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll(`[id^="${set}-"][role="tabpanel"]`).forEach(p => { p.hidden = p.id !== `${set}-${i}`; });
  }
});

/* Arrow keys move between category tabs */
document.addEventListener('keydown', e => {
  const tab = e.target.closest && e.target.closest('[data-tabset]');
  if (!tab || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  const all = [...document.querySelectorAll(`[data-tabset="${tab.dataset.tabset}"]`)];
  const i = all.indexOf(tab);
  const next = { ArrowRight: (i + 1) % all.length, ArrowLeft: (i - 1 + all.length) % all.length, Home: 0, End: all.length - 1 }[e.key];
  e.preventDefault(); all[next].focus(); all[next].click();
});

function onFilter() {
  state.owner = $('owner').value;
  syncHash();
  render();
}
$('owner').addEventListener('change', onFilter);
$('domains').addEventListener('click', e => {
  const b = e.target.closest('[data-domain]');
  if (!b) return;
  state.domain = b.dataset.domain;
  syncHash();
  render();
  const again = [...$('domains').querySelectorAll('[data-domain]')].find(x => x.dataset.domain === state.domain);
  if (again) again.focus(); // the buttons are redrawn, so put focus back on the same one
});

(async function main() {
  try { await load(); } catch (e) { $('view').innerHTML = '<p class="empty">The data could not be loaded. Open this page from a web server, not directly from the file.</p>'; return; }
  const p = new URLSearchParams(location.hash.slice(1));
  state.domain = KPIS.some(k => k.domain === p.get('domain')) ? p.get('domain') : '';
  state.owner = KPIS.some(k => k.owner === p.get('owner') && (!state.domain || k.domain === state.domain)) ? p.get('owner') : '';
  render();
  if (p.get('kpi')) openDetail(p.get('kpi'));
})();
