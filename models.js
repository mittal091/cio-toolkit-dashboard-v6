/* One model per KPI. Each turns the sample data into what the card shows (value, status, change)
   and what the detail panel shows (overall view first, then the detailed list).
   Every headline number is calculated from the rows underneath it, so the card and the detail always agree. */
import { sum, int, moneyM, moneyK, pct, date, daysBetween } from './format.js';

const VS = { Monthly: 'vs last month', Weekly: 'vs last week', Quarterly: 'vs last quarter' };

/* The change since the previous period. better: "up" or "down" (which direction is good), or null for no judgement. */
function change(now, prior, better, show, what = '') {
  const d = now - prior;
  if (Math.abs(d) < 1e-9) return { text: 'No change', tone: 'flat', what };
  const tone = !better ? 'flat' : ((d > 0) === (better === 'up') ? 'good' : 'bad');
  return { text: `${d > 0 ? '▲' : '▼'} ${show(Math.abs(d))}`, tone, what };
}
const pts = n => { const s = n < 0.95 ? n.toFixed(1) : n.toFixed(0); return s + (s === '1' ? ' pt' : ' pts'); };

const status = (level, why) => ({ level, why });
const share = (n, total) => (n / total) * 100;
const rag = r => ({ text: r, tone: r === 'Red' ? 'bad' : r === 'Amber' ? 'warn' : 'good' });

export const MODELS = {

  'run-grow-transform-spend-mix': (d) => {
    const cats = d.categories.map(c => ({ ...c, m: sum(c.lines.map(l => l.m)) }));
    const total = sum(cats.map(c => c.m));
    const run = cats.find(c => c.name === 'Run');
    return {
      value: cats.map(c => Math.round(share(c.m, total))).join(' / '),
      sub: 'Run / Grow / Transform, % of IT spend',
      status: status('watch', `Run is still ${Math.round(share(run.m, total))}% of IT spend`),
      delta: change(share(run.m, total), d.priorShare.Run, 'down', pts, 'Run share'),
      blocks: [
        { type: 'figures', items: [
          { label: 'Total IT spend', value: moneyM(total), hint: 'Full-year forecast' },
          ...cats.map(c => ({ label: c.name, value: moneyM(c.m), hint: `${Math.round(share(c.m, total))}% of IT spend` }))
        ] },
        { type: 'bars', title: 'Share of IT spend', rows: cats.map(c => ({ label: `${c.name}: ${c.meaning}`, text: `${Math.round(share(c.m, total))}% · ${moneyM(c.m)}`, pct: share(c.m, total) })) },
        { type: 'table', title: 'Where the money goes', columns: [{ label: 'Group' }, { label: 'Area' }, { label: 'Spend', right: true }, { label: 'Share of IT spend', right: true }],
          rows: cats.flatMap(c => c.lines.map(l => [c.name, l.area, moneyM(l.m), pct(share(l.m, total), 1)])) }
      ]
    };
  },

  'roadmap-delivery-vs-plan': (d) => {
    const committed = sum(d.programmes.map(p => p.committed)), onTime = sum(d.programmes.map(p => p.onTime));
    const now = share(onTime, committed);
    return {
      value: pct(now), sub: 'of committed milestones delivered on time',
      status: status('watch', `${committed - onTime} of ${committed} milestones are late`),
      delta: change(now, d.priorPct, 'up', pts),
      blocks: [
        { type: 'figures', items: [{ label: 'Milestones committed', value: int(committed) }, { label: 'Delivered on time', value: int(onTime) }, { label: 'Late', value: int(committed - onTime) }] },
        { type: 'bars', title: 'On time, by programme', rows: d.programmes.map(p => ({ label: p.name, text: `${p.onTime} of ${p.committed}`, pct: share(p.onTime, p.committed), tone: share(p.onTime, p.committed) < 70 ? 'bad' : share(p.onTime, p.committed) < 90 ? 'warn' : 'good' })) },
        { type: 'table', title: 'Late milestones', columns: [{ label: 'Milestone' }, { label: 'Programme' }, { label: 'Planned' }, { label: 'New date' }, { label: 'Why' }],
          rows: d.late.map(m => [m.milestone, m.programme, date(m.planned), date(m.now), m.reason]) }
      ]
    };
  },

  'it-spend-as-pct-of-revenue': (d, shared) => {
    const spend = shared.monthlyActualM, rev = d.revenueM, months = shared.months.slice(0, spend.length);
    const ratio = spend.map((s, i) => share(s, rev[i]));
    const last = ratio.length - 1;
    return {
      value: pct(ratio[last], 1), sub: `of revenue in ${months[last]}`,
      status: status('watch', 'It has crept up since April'),
      delta: change(ratio[last], ratio[last - 1], 'down', pts),
      blocks: [
        { type: 'figures', items: [{ label: `IT spend, ${months[last]}`, value: moneyM(spend[last]) }, { label: `Revenue, ${months[last]}`, value: moneyM(rev[last], 0) }, { label: 'IT spend as % of revenue', value: pct(ratio[last], 1) }] },
        { type: 'line', title: 'IT spend as % of revenue, by month', labels: months, values: ratio, fmt: v => v.toFixed(1) + '%' },
        { type: 'table', title: 'By month', columns: [{ label: 'Month' }, { label: 'IT spend', right: true }, { label: 'Revenue', right: true }, { label: '% of revenue', right: true }],
          rows: months.map((m, i) => [m, moneyM(spend[i]), moneyM(rev[i], 0), pct(ratio[i], 1)]) }
      ]
    };
  },

  'budget-vs-actual-and-forecast-variance': (d, shared) => {
    const actual = shared.monthlyActualM, budget = shared.monthlyBudgetM, n = actual.length;
    const spent = sum(actual), budgetSoFar = sum(budget.slice(0, n));
    const avg = sum(actual.slice(-3)) / 3, forecastMonths = Array.from({ length: budget.length - n }, () => avg);
    const yearForecast = spent + sum(forecastMonths), yearBudget = sum(budget);
    const over = share(spent - budgetSoFar, budgetSoFar);
    return {
      value: (over >= 0 ? '+' : '') + pct(over, 1), sub: `${over >= 0 ? 'over' : 'under'} budget so far. Year-end forecast ${moneyM(yearForecast)} vs ${moneyM(yearBudget)} budget`,
      status: status('watch', `The forecast is ${moneyM(yearForecast - yearBudget)} over budget for the year`),
      delta: change(over, d.priorVariancePct, 'down', pts),
      blocks: [
        { type: 'figures', items: [{ label: 'Spent so far', value: moneyM(spent) }, { label: 'Budget so far', value: moneyM(budgetSoFar) }, { label: 'Year-end forecast', value: moneyM(yearForecast), hint: 'Based on the last 3 months' }, { label: 'Full-year budget', value: moneyM(yearBudget) }] },
        { type: 'columns', title: 'Spend by month', labels: shared.months, values: [...actual, ...forecastMonths], forecastFrom: n, ref: budget[0], refLabel: 'Monthly budget', fmt: v => moneyM(v), legend: ['Spent', 'Forecast', 'Budget'] },
        { type: 'table', title: 'Where we are over or under budget', columns: [{ label: 'Category' }, { label: 'Budget so far', right: true }, { label: 'Spent so far', right: true }, { label: 'Difference', right: true }],
          rows: d.categories.map(c => [c.name, moneyM(c.budgetM), moneyM(c.actualM), { text: (c.actualM - c.budgetM >= 0 ? '+' : '-') + moneyM(Math.abs(c.actualM - c.budgetM)), tone: c.actualM - c.budgetM > 0.05 ? 'bad' : 'flat' }]) }
      ]
    };
  },

  'cloud-spend-and-waste': (d, shared) => {
    const w = d.weeklyK, last = w.length - 1;
    const idle = sum(d.teams.map(t => t.idleK)), idleShare = share(idle, w[last]);
    const itWeekly = (d.monthlyItSpendM * 1000 * 4) / 4.345, cloud4 = sum(w.slice(-4));
    return {
      value: moneyK(w[last]), sub: `cloud cost this week. ${Math.round(idleShare)}% is unused or oversized`,
      status: status('watch', 'About 1 in 5 dollars goes on unused or oversized resources'),
      delta: change(w[last], w[last - 1], 'down', v => moneyK(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Cloud cost this week', value: moneyK(w[last]) }, { label: 'Last 12 weeks', value: moneyM(sum(w) / 1000, 2) }, { label: 'Unused or oversized', value: pct(idleShare) }, { label: 'Share of all IT spend', value: '~' + pct(share(cloud4, itWeekly)), hint: 'Last 4 weeks. Cloud is part of overall IT spend' }] },
        { type: 'columns', title: 'Cloud cost per week', labels: shared.weeks, values: w, highlight: [8], fmt: moneyK, note: d.peakNote },
        { type: 'table', title: 'By team', columns: [{ label: 'Team' }, { label: 'This week', right: true }, { label: '4 weeks ago', right: true }, { label: 'Change', right: true }, { label: 'Unused share', right: true }],
          rows: d.teams.map(t => [t.name, moneyK(t.thisWeekK), moneyK(t.fourWeeksAgoK), { text: t.thisWeekK === t.fourWeeksAgoK ? 'No change' : (t.thisWeekK > t.fourWeeksAgoK ? '+' : '-') + moneyK(Math.abs(t.thisWeekK - t.fourWeeksAgoK)), tone: t.thisWeekK > t.fourWeeksAgoK ? 'bad' : 'flat' }, pct(share(t.idleK, t.thisWeekK))]) },
        { type: 'table', title: 'Biggest savings to look at', columns: [{ label: 'What' }, { label: 'Team' }, { label: 'Estimated saving a year', right: true }], rows: d.waste.map(x => [x.item, x.team, moneyK(x.yearK)]) }
      ]
    };
  },

  'contract-renewals-due-6-12-months': (d, shared, ctx) => {
    const soon = d.listed.filter(c => daysBetween(ctx.asOf, c.noticeBy) <= 90);
    const otherCount = d.total.count - d.listed.length, otherValue = d.total.valueM - sum(d.listed.map(c => c.valueM));
    return {
      value: `${d.total.count}`, sub: `contracts · ${moneyM(d.total.valueM)} a year`,
      status: status('watch', `${soon.length} notice deadlines fall in the next 90 days`),
      delta: change(d.total.count, d.priorCount, null, v => int(v) + (v === 1 ? ' contract' : ' contracts')),
      blocks: [
        { type: 'figures', items: [{ label: 'Contracts due', value: int(d.total.count) }, { label: 'Value a year', value: moneyM(d.total.valueM) }, { label: 'Notice due in 90 days', value: int(soon.length) }] },
        { type: 'table', title: 'Largest renewals', columns: [{ label: 'Contract' }, { label: 'Renews on' }, { label: 'Tell the vendor by' }, { label: 'Value a year', right: true }, { label: 'Price change' }, { label: 'Action' }],
          rows: [...d.listed.map(c => [c.contract, date(c.renewal), date(c.noticeBy), moneyM(c.valueM), c.priceRise, daysBetween(ctx.asOf, c.noticeBy) <= 90 ? { text: 'Notice due soon', tone: 'warn' } : '']),
            [`${otherCount} other contracts`, '', '', moneyM(otherValue), '', '']] }
      ]
    };
  },

  'deployment-frequency': (d, shared) => {
    const w = d.weekly, last = w.length - 1;
    return {
      value: int(w[last]), sub: 'production deployments this week',
      status: status('good', 'More deployments than last week'),
      delta: change(w[last], w[last - 1], 'up', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'This week', value: int(w[last]) }, { label: 'Last week', value: int(w[last - 1]) }, { label: 'Average, last 12 weeks', value: int(sum(w) / w.length) }] },
        { type: 'columns', title: 'Deployments per week', labels: shared.weeks, values: w, fmt: int },
        { type: 'table', title: 'By team', columns: [{ label: 'Team' }, { label: 'This week', right: true }, { label: 'Last week', right: true }, { label: 'Change', right: true }],
          rows: d.teams.map(t => [t.name, int(t.thisWeek), int(t.lastWeek), { text: t.thisWeek === t.lastWeek ? 'No change' : (t.thisWeek > t.lastWeek ? '+' : '-') + Math.abs(t.thisWeek - t.lastWeek), tone: 'flat' }]) }
      ]
    };
  },

  'project-health-rag': (d) => {
    const red = d.attention.filter(p => p.reported === 'Red').length, amber = d.attention.filter(p => p.reported === 'Amber').length;
    const green = d.totalProjects - red - amber, atRisk = d.attention.filter(p => p.atRisk).length;
    return {
      value: `${green} / ${amber} / ${red}`, sub: `Green / Amber / Red, of ${d.totalProjects} projects`,
      status: status('watch', `${amber + red} projects are Amber or Red, and ${atRisk} Green ones show warning signs`),
      delta: change(green, d.prior.Green, 'up', v => int(v) + ' Green', ''),
      blocks: [
        { type: 'figures', items: [{ label: 'Green', value: int(green) }, { label: 'Amber', value: int(amber) }, { label: 'Red', value: int(red) }, { label: 'Green but at risk', value: int(atRisk), hint: 'Reports mention delays' }] },
        { type: 'bars', title: 'Projects by status', rows: [{ label: 'Green', text: int(green), pct: share(green, d.totalProjects), tone: 'good' }, { label: 'Amber', text: int(amber), pct: share(amber, d.totalProjects), tone: 'warn' }, { label: 'Red', text: int(red), pct: share(red, d.totalProjects), tone: 'bad' }] },
        { type: 'table', title: 'Projects that need attention', columns: [{ label: 'Project' }, { label: 'Status' }, { label: 'Days late', right: true }, { label: 'Over budget', right: true }, { label: 'What the reports say' }],
          rows: d.attention.map(p => [p.project, p.atRisk ? { text: 'Green, at risk', tone: 'warn' } : rag(p.reported), p.daysLate ? int(p.daysLate) : '-', p.budgetPct ? '+' + p.budgetPct + '%' : '-', p.note]) }
      ]
    };
  },

  'technical-debt-trend': (d) => {
    const mean = sum(d.apps.map(a => a.now)) / d.apps.length, prev = sum(d.apps.map(a => a.last)) / d.apps.length;
    const worst = [...d.apps].sort((a, b) => b.now - a.now)[0];
    return {
      value: pct(mean, 1), sub: 'technical debt across main applications. Lower is better',
      status: status('good', 'It has fallen for five quarters in a row'),
      delta: change(mean, prev, 'down', pts),
      blocks: [
        { type: 'figures', items: [{ label: 'Technical debt now', value: pct(mean, 1) }, { label: 'Highest', value: pct(worst.now, 1), hint: worst.name }, { label: 'Six quarters ago', value: pct(d.ratio[0], 1) }] },
        { type: 'line', title: 'Technical debt by quarter', labels: d.quarters, values: [...d.ratio.slice(0, -1), mean], fmt: v => v.toFixed(1) + '%' },
        { type: 'table', title: 'By application', columns: [{ label: 'Application' }, { label: 'Technical debt', right: true }, { label: 'Change', right: true }, { label: 'Biggest problem area' }],
          rows: d.apps.map(a => [a.name, pct(a.now, 1), { text: a.now === a.last ? 'No change' : (a.now < a.last ? '▼ ' : '▲ ') + Math.abs(a.now - a.last).toFixed(1), tone: a.now < a.last ? 'good' : 'bad' }, a.hotspot]) }
      ]
    };
  },

  'availability-vs-sla-critical-services': (d) => {
    const minutes = d.days * 1440, allowed = Math.round((100 - d.target) / 100 * minutes);
    const rows = d.services.map(s => ({ ...s, down: Math.round((100 - s.uptime) / 100 * minutes), meets: s.uptime >= d.target }));
    const meeting = rows.filter(r => r.meets).length;
    return {
      value: `${meeting} of ${rows.length}`, sub: `critical services meet the ${d.target}% target`,
      status: status('risk', rows.filter(r => !r.meets).map(r => r.name).join(' and ') + ' are below the target'),
      delta: change(meeting, d.priorMeeting, 'up', v => v + (v === 1 ? ' service' : ' services')),
      blocks: [
        { type: 'figures', items: [{ label: 'Services meeting target', value: `${meeting} of ${rows.length}` }, { label: 'Target', value: d.target + '%' }, { label: 'Downtime allowed', value: `${allowed} min`, hint: 'Per service, last 12 weeks' }] },
        { type: 'bars', title: 'Downtime compared with what is allowed (last 12 weeks)', scale: 250, mark: 100, markLabel: 'Allowed', rows: rows.map(r => ({ label: r.name, text: `${r.down} min down, ${allowed} allowed`, pct: share(r.down, allowed), tone: r.meets ? 'good' : 'bad' })) },
        { type: 'table', title: 'By service', columns: [{ label: 'Service' }, { label: 'Uptime', right: true }, { label: 'Target', right: true }, { label: 'Downtime', right: true }, { label: 'Allowed', right: true }, { label: 'Result' }],
          rows: rows.map(r => [r.name, r.uptime + '%', d.target + '%', `${r.down} min`, `${allowed} min`, r.meets ? { text: 'Meets target', tone: 'good' } : { text: 'Below target', tone: 'bad' }]) }
      ]
    };
  },

  'p1-p2-incidents-and-mttr': (d, shared) => {
    const i = d.incidents, m = d.mttrHours, last = i.length - 1;
    return {
      value: int(i[last]), sub: `P1/P2 incidents this week. Restored in ${m[last].toFixed(1)}h on average`,
      status: status('watch', 'Still above the usual 10 a week'),
      delta: change(i[last], i[last - 1], 'down', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Incidents this week', value: int(i[last]) }, { label: 'Average time to restore', value: m[last].toFixed(1) + ' hours', hint: `${change(m[last], m[last - 1], 'down', v => v.toFixed(1) + 'h').text} ${VS.Weekly}` }, { label: 'Worst week', value: int(Math.max(...i)), hint: `${shared.weeks[i.indexOf(Math.max(...i))]}, ${Math.max(...m).toFixed(1)} hours` }] },
        { type: 'columns', title: 'Incidents per week', labels: shared.weeks, values: i, highlight: [i.indexOf(Math.max(...i))], fmt: int },
        { type: 'line', title: 'Average time to restore (hours)', labels: shared.weeks, values: m, fmt: v => v.toFixed(1) + 'h' },
        { type: 'table', title: 'Largest incidents this month', columns: [{ label: 'Ticket' }, { label: 'Service' }, { label: 'Started' }, { label: 'Hours to restore', right: true }, { label: 'Cause' }],
          rows: d.largest.map(x => [x.id, x.service, date(x.started), x.hours.toFixed(1), x.cause]) },
        { type: 'table', title: 'Problems that keep coming back', columns: [{ label: 'Problem' }, { label: 'Tickets', right: true }, { label: 'Likely cause' }], rows: d.repeat.map(x => [x.problem, int(x.tickets), x.link]) }
      ]
    };
  },

  'critical-vulnerabilities-open-patch-sla': (d) => {
    const open = d.listed.length + d.others, past = d.listed.filter(v => v.deadline === 'Past deadline').length;
    const patchedPct = share(d.patched.withinSla, d.patched.total);
    const pill = v => ({ text: v.deadline, tone: v.deadline === 'Past deadline' ? 'bad' : v.deadline.startsWith('Due') ? 'warn' : 'good' });
    return {
      value: int(open), sub: `critical vulnerabilities open. ${Math.round(patchedPct)}% were patched within the deadline`,
      status: status('risk', `${past} internet-facing system with a known attack method is past its deadline`),
      delta: change(open, d.priorOpen, 'down', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Open critical vulnerabilities', value: int(open) }, { label: 'Patched within the deadline', value: pct(patchedPct), hint: `${d.patched.withinSla} of ${d.patched.total}, last 90 days` }, { label: 'Past the deadline now', value: int(past) }] },
        { type: 'table', title: 'Fix these first', columns: [{ label: 'System' }, { label: 'Reachable from the internet' }, { label: 'Known attack method' }, { label: 'Days open', right: true }, { label: 'Deadline' }],
          rows: [...d.listed.map(v => [v.asset, v.exposure === 'Internet-facing' ? 'Yes' : 'No', v.exploit, int(v.daysOpen), pill(v)]), [`${d.others} other systems`, '', '', '', { text: 'All within deadline', tone: 'good' }]] }
      ]
    };
  },

  'mfa-and-privileged-access-coverage': (d) => {
    const accounts = sum(d.groups.map(g => g.accounts)), covered = sum(d.groups.map(g => g.covered));
    const now = share(covered, accounts), priv = d.groups.find(g => g.privileged), privPct = share(priv.covered, priv.accounts);
    return {
      value: pct(now), sub: `of accounts use MFA. Admin accounts: ${Math.round(privPct)}%`,
      status: status('watch', `${priv.accounts - priv.covered} admin accounts still have no MFA`),
      delta: change(now, d.priorPct, 'up', pts),
      blocks: [
        { type: 'figures', items: [{ label: 'All accounts', value: pct(now) }, { label: 'Admin accounts', value: pct(privPct) }, { label: 'Accounts without MFA', value: int(accounts - covered) }] },
        { type: 'bars', title: 'Coverage by account type', rows: d.groups.map(g => ({ label: g.name, text: pct(share(g.covered, g.accounts)), pct: share(g.covered, g.accounts), tone: share(g.covered, g.accounts) >= 95 ? 'good' : share(g.covered, g.accounts) >= 90 ? 'warn' : 'bad' })) },
        { type: 'table', title: 'By account type', columns: [{ label: 'Account type' }, { label: 'Accounts', right: true }, { label: 'With MFA', right: true }, { label: 'Coverage', right: true }, { label: 'Without MFA', right: true }],
          rows: d.groups.map(g => [g.name, int(g.accounts), int(g.covered), pct(share(g.covered, g.accounts), 1), int(g.accounts - g.covered)]) }
      ]
    };
  },

  'audit-findings-open-and-overdue': (d, shared, ctx) => {
    const rows = d.findings.map(f => ({ ...f, overdue: daysBetween(f.due, ctx.asOf) > 0 }));
    const overdue = rows.filter(r => r.overdue), high = overdue.filter(r => r.severity === 'High').length;
    const order = { High: 0, Medium: 1, Low: 2 };
    const sorted = [...rows].sort((a, b) => (b.overdue - a.overdue) || (order[a.severity] - order[b.severity]) || (b.ageDays - a.ageDays));
    const themes = {}; rows.forEach(r => { themes[r.theme] = (themes[r.theme] || { open: 0, overdue: 0 }); themes[r.theme].open++; if (r.overdue) themes[r.theme].overdue++; });
    return {
      value: int(rows.length), sub: `open findings. ${overdue.length} are overdue`,
      status: status('risk', `${high} High findings are overdue`),
      delta: change(overdue.length, d.priorOverdue, 'down', v => v + ' overdue', ''),
      blocks: [
        { type: 'figures', items: [{ label: 'Open findings', value: int(rows.length) }, { label: 'Overdue', value: int(overdue.length) }, { label: 'Oldest finding', value: `${Math.max(...rows.map(r => r.ageDays))} days` }] },
        { type: 'bars', title: 'By severity', scale: Math.max(...['High', 'Medium', 'Low'].map(s => rows.filter(r => r.severity === s).length)), rows: ['High', 'Medium', 'Low'].map(s => { const all = rows.filter(r => r.severity === s); const od = all.filter(r => r.overdue).length; return { label: s, text: `${all.length} open, ${od} overdue`, pct: all.length, tone: od ? (s === 'Low' ? 'warn' : 'bad') : 'good' }; }) },
        { type: 'table', title: 'Main themes', columns: [{ label: 'Theme' }, { label: 'Open', right: true }, { label: 'Overdue', right: true }], rows: Object.entries(themes).sort((a, b) => b[1].open - a[1].open).map(([t, v]) => [t, int(v.open), int(v.overdue)]) },
        { type: 'table', title: 'All open findings', columns: [{ label: 'Ref' }, { label: 'Finding' }, { label: 'Severity' }, { label: 'Age (days)', right: true }, { label: 'Due' }, { label: 'Owner' }, { label: 'Status' }],
          rows: sorted.map(r => [r.id, r.title, { text: r.severity, tone: r.severity === 'High' ? 'bad' : r.severity === 'Medium' ? 'warn' : 'flat' }, int(r.ageDays), date(r.due), r.owner, r.overdue ? { text: 'Overdue', tone: 'bad' } : { text: 'On time', tone: 'good' }]) }
      ]
    };
  },

  'end-of-life-legacy-footprint': (d) => {
    const count = sum(d.byType.map(t => t.count)), high = d.listed.filter(s => s.importance === 'High').length;
    const others = count - d.listed.length;
    return {
      value: int(count), sub: `systems past vendor support, out of ${int(d.totalSystems)}`,
      status: status('watch', `${high} of the systems listed are rated High importance`),
      delta: change(count, d.priorCount, 'down', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Past vendor support', value: int(count) }, { label: 'All systems', value: int(d.totalSystems) }, { label: 'Share of all systems', value: pct(share(count, d.totalSystems), 1) }] },
        { type: 'bars', title: 'By type', scale: Math.max(...d.byType.map(t => t.count)), rows: d.byType.map(t => ({ label: t.type, text: int(t.count), pct: t.count })) },
        { type: 'table', title: 'Systems to deal with first', columns: [{ label: 'System' }, { label: 'Type' }, { label: 'Support ended' }, { label: 'Importance' }, { label: 'Plan' }, { label: 'Owner' }],
          rows: [...d.listed.map(s => [s.system, s.type, date(s.supportEnded), { text: s.importance, tone: s.importance === 'High' ? 'bad' : s.importance === 'Medium' ? 'warn' : 'flat' }, s.plan, s.owner]), [`${others} other systems`, '', '', '', '', '']] }
      ]
    };
  },

  'application-portfolio-time': (d) => {
    const cats = d.categories.map(c => ({ ...c, costM: c.costM ?? sum(c.apps.map(a => a.costK)) / 1000 }));
    const total = sum(cats.map(c => c.count)), cost = sum(cats.map(c => c.costM));
    const get = k => cats.find(c => c.key === k);
    return {
      value: int(total), sub: `applications. ${get('Eliminate').count} to retire, ${get('Migrate').count} to migrate`,
      status: status('watch', `${get('Eliminate').count + get('Migrate').count} applications are waiting to be moved or retired`),
      delta: null,
      blocks: [
        { type: 'figures', items: [{ label: 'Applications', value: int(total) }, { label: 'Running cost a year', value: moneyM(cost) }, ...cats.map(c => ({ label: c.key, value: int(c.count), hint: c.meaning }))] },
        { type: 'bars', title: 'Applications by category', rows: cats.map(c => ({ label: `${c.key}: ${c.meaning}`, text: `${int(c.count)} · ${moneyM(c.costM)} a year`, pct: share(c.count, total), tone: c.key === 'Eliminate' ? 'bad' : c.key === 'Migrate' ? 'warn' : undefined })) },
        { type: 'tabs', title: 'Applications in each category', tabs: cats.map(c => ({ label: c.key, count: c.count, intro: c.meaning,
          table: { columns: [{ label: 'Application' }, { label: 'Business area' }, { label: 'Cost a year', right: true }, { label: 'Users', right: true }, { label: 'What happens next' }], rows: c.apps.map(a => [a.name, a.area, moneyK(a.costK), a.users, a.action]) },
          note: c.apps.length < c.count ? `Showing ${c.apps.length} of ${c.count} applications` : `All ${c.count} applications` })) }
      ]
    };
  },

  'ai-use-cases-by-stage': (d) => {
    const c = d.counts, order = ['In production', 'Pilots', 'Ideas'];
    return {
      value: int(c['In production']), sub: `in production. ${c.Pilots} pilots, ${c.Ideas} ideas`,
      status: status('good', 'One more in production than last month'),
      delta: change(c['In production'], d.priorProduction, 'up', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Ideas', value: int(c.Ideas) }, { label: 'Pilots', value: int(c.Pilots) }, { label: 'In production', value: int(c['In production']) }, { label: 'Duplicate ideas found', value: int(d.duplicates) }] },
        { type: 'bars', title: 'From idea to production', scale: Math.max(...Object.values(c)), rows: order.slice().reverse().map(k => ({ label: k, text: int(c[k]), pct: c[k] })) },
        { type: 'tabs', title: 'Use cases at each stage', tabs: order.map(k => { const s = d.stages.find(x => x.key === k); return { label: k, count: c[k],
          table: { columns: [{ label: 'Use case' }, { label: 'Business area' }, { label: 'Owner' }, { label: 'Status' }], rows: s.rows.map(r => [r.useCase, r.area, r.owner, r.note]) },
          note: s.rows.length < c[k] ? `Showing ${s.rows.length} of ${c[k]}` : `All ${c[k]}` }; }) }
      ]
    };
  },

  'ai-adoption-and-realised-value': (d) => {
    const users = sum(d.useCases.map(u => u.users));
    const measured = sum(d.useCases.filter(u => u.basis === 'Measured').map(u => u.benefitK)) / 1000;
    const reported = sum(d.useCases.filter(u => u.basis !== 'Measured').map(u => u.benefitK)) / 1000;
    return {
      value: int(users), sub: `active users. ${moneyM(measured)} a year of benefit is measured`,
      status: status('watch', `Most of the benefit (${moneyM(reported)}) is self-reported, not measured`),
      delta: change(users, d.priorUsers, 'up', v => int(v)),
      blocks: [
        { type: 'figures', items: [{ label: 'Active users', value: int(users) }, { label: 'Measured benefit a year', value: moneyM(measured), hint: `${moneyM(measured - d.priorMeasuredM)} more than last month` }, { label: 'Self-reported benefit a year', value: moneyM(reported), hint: 'Weaker evidence' }] },
        { type: 'bars', title: 'Active users by use case', scale: Math.max(...d.useCases.map(u => u.users)), rows: d.useCases.map(u => ({ label: u.useCase, text: int(u.users), pct: u.users })) },
        { type: 'table', title: 'By use case', columns: [{ label: 'Use case' }, { label: 'Active users', right: true }, { label: 'Benefit a year', right: true }, { label: 'How it was worked out' }],
          rows: d.useCases.map(u => [u.useCase, int(u.users), moneyK(u.benefitK), u.basis === 'Measured' ? { text: 'Measured', tone: 'good' } : { text: 'Self-reported', tone: 'warn' }]) }
      ]
    };
  }
};

export function buildAll(kpis, data, asOf) {
  const out = {};
  for (const k of kpis) {
    const model = MODELS[k.id];
    if (!model) throw new Error(`No model for ${k.id}`);
    const built = model(data[k.id], data.shared, { asOf, kpi: k });
    built.deltaLabel = VS[k.view] || '';
    out[k.id] = built;
  }
  return out;
}
export const STATUS_WORDS = { good: 'On track', watch: 'Needs attention', risk: 'At risk' };
