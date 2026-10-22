import { esc } from '../format.js';
import { renderBlock, OVERALL } from './blocks.js';
import { statusPill, deltaHtml } from './card.js';

/* The drill-down for one KPI: a one-line description, the current number, the overall view, then the detailed lists. */
export function detail(k, m, description) {
  const overall = m.blocks.filter(b => OVERALL.has(b.type));
  const granular = m.blocks.filter(b => !OVERALL.has(b.type));
  return `<header class="d-head"><div class="d-where">${esc(k.domain)} · Owner: ${esc(k.owner)}</div>` +
    `<h2 id="detail-title">${esc(k.name)}</h2>` +
    (description ? `<p class="d-def">${esc(description)}</p>` : '') +
    `<div class="d-now"><span class="d-val">${esc(m.value)}</span>${statusPill(m.status.level)}</div>` +
    `<p class="d-sub">${esc(m.sub)}</p>${deltaHtml(m)}<p class="d-why">${esc(m.status.why)}</p></header>` +
    (overall.length ? `<section><h3>Overall</h3>${overall.map(renderBlock).join('')}</section>` : '') +
    (granular.length ? `<section><h3>Details</h3>${granular.map(renderBlock).join('')}</section>` : '');
}
