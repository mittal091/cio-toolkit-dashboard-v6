import { esc } from '../format.js';
import { pill } from './blocks.js';
import { STATUS_WORDS } from '../models.js';

const TONE = { good: 'good', watch: 'warn', risk: 'bad' };
export const statusPill = level => pill(TONE[level], STATUS_WORDS[level]);

export function deltaHtml(m) {
  if (!m.delta) return '';
  const what = m.delta.what ? ` ${esc(m.delta.what)}` : '';
  return `<span class="chg"><span class="dl ${m.delta.tone}">${esc(m.delta.text)}</span><span class="chgt">${what} ${esc(m.deltaLabel)}</span></span>`;
}

/* One KPI card. The whole card opens the detail panel. */
export function card(k, m) {
  return `<button type="button" class="card" data-kpi="${esc(k.id)}" aria-label="View details: ${esc(k.name)}">` +
    `<span class="c-top"><span class="c-name">${esc(k.name)}</span>${statusPill(m.status.level)}</span>` +
    `<span class="c-val">${esc(m.value)}</span><span class="c-sub">${esc(m.sub)}</span>${deltaHtml(m)}` +
    `<span class="c-foot"><span>Owner: ${esc(k.owner)}</span><span class="c-more">View details ›</span></span></button>`;
}
