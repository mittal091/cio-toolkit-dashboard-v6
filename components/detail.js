import { esc } from '../format.js';
import { renderBlock, OVERALL } from './blocks.js';
import { statusPill, deltaHtml } from './card.js';

const row = (k, v) => (v ? `<div class="about-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>` : '');

/* The drill-down for one KPI: the overall view first, then the detailed list. */
export function detail(k, m) {
  const overall = m.blocks.filter(b => OVERALL.has(b.type));
  const granular = m.blocks.filter(b => !OVERALL.has(b.type));
  return `<header class="d-head"><div class="d-where">${esc(k.domain)} · Owner: ${esc(k.owner)}</div>` +
    `<h2 id="detail-title">${esc(k.name)}</h2>` +
    `<div class="d-now"><span class="d-val">${esc(m.value)}</span>${statusPill(m.status.level)}</div>` +
    `<p class="d-sub">${esc(m.sub)}</p>${deltaHtml(m)}<p class="d-why">${esc(m.status.why)}</p></header>` +
    `<section class="d-def"><h3>What this shows</h3><p>${esc(k.definition)}</p></section>` +
    (overall.length ? `<section><h3>Overall</h3>${overall.map(renderBlock).join('')}</section>` : '') +
    (granular.length ? `<section><h3>Details</h3>${granular.map(renderBlock).join('')}</section>` : '') +
    `<details class="about"><summary>About this KPI</summary>` +
    row('Data source', k.dataSource) + row('Refreshed', k.refresh) + row('Reported', k.view) +
    row('How AI helps', k.aiHelp) + row('Caution', k.risk && k.risk !== 'None' ? k.risk : '') + `</details>`;
}
