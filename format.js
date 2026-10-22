const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

export const sum = arr => arr.reduce((a, b) => a + b, 0);
export const int = n => Math.round(n).toLocaleString('en-US');
export const moneyM = (m, d = 1) => '$' + m.toFixed(d) + 'M';
export const moneyK = k => '$' + Math.round(k).toLocaleString('en-US') + 'k';
export const pct = (n, d = 0) => n.toFixed(d) + '%';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* "2026-10-23" -> "23 Oct 2026" */
export function date(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (fromIso, toIso) => Math.round((utc(toIso) - utc(fromIso)) / 86400000);
