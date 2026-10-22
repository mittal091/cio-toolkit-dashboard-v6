/* The small widgets used inside a drill-down: figures, bars, charts, tables and category tabs.
   They are pure functions: data in, HTML out. */
import { esc } from '../format.js';

export const pill = (tone, text) => `<span class="pill ${tone}">${esc(text)}</span>`;
const cell = c => (c && typeof c === 'object' ? pill(c.tone || 'flat', c.text) : esc(c ?? ''));
const title = t => (t ? `<h4>${esc(t)}</h4>` : '');

function figures(b) {
  return `<div class="figs">${b.items.map(i => `<div class="fig"><div class="fl">${esc(i.label)}</div><div class="fv">${esc(i.value)}</div>${i.hint ? `<div class="fh">${esc(i.hint)}</div>` : ''}</div>`).join('')}</div>`;
}

function bars(b) {
  const scale = b.scale || 100;
  const rows = b.rows.map(r => {
    const w = Math.max(1, Math.min(100, (r.pct / scale) * 100));
    const mark = b.mark ? `<span class="mk" style="left:${(b.mark / scale) * 100}%"></span>` : '';
    return `<div class="brow"><div class="bl">${esc(r.label)}</div><div class="bt"><span class="bf ${r.tone || ''}" style="width:${w}%"></span>${mark}</div><div class="bv">${esc(r.text)}</div></div>`;
  }).join('');
  return `<div class="block">${title(b.title)}<div class="bars">${rows}</div>${b.markLabel ? `<p class="note">The vertical line is the ${esc(b.markLabel.toLowerCase())} level.</p>` : ''}</div>`;
}

function niceMax(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(m => m * mag >= v) * mag;
}

function columns(b) {
  const w = 560, h = 210, l = 56, r = 10, t = 20, bt = 28, iw = w - l - r, ih = h - t - bt, n = b.values.length;
  const max = niceMax(Math.max(...b.values, b.ref || 0)), y = v => t + ih * (1 - v / max);
  const slot = iw / n, bw = slot * 0.62;
  let s = '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch" width="2.6" height="6"/></pattern></defs>';
  for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; s += `<line class="grid" x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(b.fmt(v))}</text>`; }
  b.values.forEach((v, i) => {
    const cx = l + slot * i + slot / 2, fc = b.forecastFrom != null && i >= b.forecastFrom, hi = (b.highlight || []).includes(i);
    s += `<rect class="col ${hi ? 'hi' : ''} ${fc ? 'fc' : ''}" x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" rx="2"><title>${esc((b.labels[i]))}: ${esc(b.fmt(v))}</title></rect>`;
    s += `<text class="ax" x="${cx}" y="${h - 9}" text-anchor="middle">${esc(b.labels[i])}</text>`;
    if (hi || i === n - 1) s += `<text class="lab" x="${cx}" y="${y(v) - 5}" text-anchor="middle">${esc(b.fmt(v))}</text>`;
  });
  if (b.ref) s += `<line class="ref" x1="${l}" x2="${w - r}" y1="${y(b.ref)}" y2="${y(b.ref)}"/>`;
  const legend = b.legend ? `<div class="legend">${b.legend.map((x, i) => `<span><i class="lg${i}"></i>${esc(x)}</span>`).join('')}</div>` : '';
  return `<div class="block">${title(b.title)}<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(b.title)}">${s}</svg></div>${legend}${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}</div>`;
}

function line(b) {
  const w = 560, h = 190, l = 56, r = 16, t = 20, bt = 28, iw = w - l - r, ih = h - t - bt, n = b.values.length;
  /* Round tick values (1, 2, 2.5 or 5 times a power of ten) that enclose the data, 3 to 6 gridlines. */
  const lo = Math.min(...b.values), hi = Math.max(...b.values), span = (hi - lo || 1) * 1.3;
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const min = Math.floor((lo - (hi - lo || 1) * 0.1) / step) * step, max = Math.max(Math.ceil((hi + (hi - lo || 1) * 0.1) / step) * step, min + step * 2);
  const y = v => t + ih * (1 - (v - min) / (max - min)), x = i => l + (iw * i) / (n - 1);
  let s = '';
  for (let v = min; v <= max + step / 1000; v += step) { s +=`<line class="grid" x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(b.fmt(v))}</text>`; }
  const d = 'M' + b.values.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('L');
  s += `<path class="ln" d="${d}"/>`;
  b.values.forEach((v, i) => {
    s += `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="3"><title>${esc(b.labels[i])}: ${esc(b.fmt(v))}</title></circle><text class="ax" x="${x(i)}" y="${h - 9}" text-anchor="middle">${esc(b.labels[i])}</text>`;
  });
  s += `<text class="lab" x="${x(n - 1)}" y="${y(b.values[n - 1]) - 8}" text-anchor="end">${esc(b.fmt(b.values[n - 1]))}</text>`;
  return `<div class="block">${title(b.title)}<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(b.title)}">${s}</svg></div></div>`;
}

function tableHtml(columns, rows) {
  const th = columns.map(c => `<th${c.right ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map(r => `<tr>${r.map((c, i) => `<td${columns[i] && columns[i].right ? ' class="r"' : ''}>${cell(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const table = b => `<div class="block">${title(b.title)}${tableHtml(b.columns, b.rows)}${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}</div>`;

/* Category tabs: one list per category. Selecting a tab shows that category's list. */
function tabs(b) {
  const id = 'tabs-' + Math.random().toString(36).slice(2, 7);
  const head = b.tabs.map((t, i) => `<button type="button" class="tab${i === 0 ? ' on' : ''}" role="tab" aria-selected="${i === 0}" aria-controls="${id}-${i}" id="${id}-t${i}" data-tabset="${id}" data-i="${i}">${esc(t.label)} <b>${esc(t.count)}</b></button>`).join('');
  const panels = b.tabs.map((t, i) => `<div role="tabpanel" id="${id}-${i}" aria-labelledby="${id}-t${i}" class="tabpanel"${i === 0 ? '' : ' hidden'}>${t.intro ? `<p class="note">${esc(t.label)}: ${esc(t.intro)}</p>` : ''}${tableHtml(t.table.columns, t.table.rows)}${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}</div>`).join('');
  return `<div class="block">${title(b.title)}<div class="tablist" role="tablist" aria-label="${esc(b.title)}">${head}</div>${panels}</div>`;
}

const BLOCKS = { figures, bars, columns, line, table, tabs };
export const renderBlock = b => BLOCKS[b.type](b);
export const OVERALL = new Set(['figures', 'bars', 'columns', 'line']);
