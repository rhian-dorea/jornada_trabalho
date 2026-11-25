export function summarizeEmployeeMonth(employee, dates, statusAt, restrictionsAt) {
  const summary = { worked: 0, notWorked: 0, off: 0, rest: 0, restDays: 0, restSundays: 0, holidayOff: 0, unplanned: 0 };
  for (const date of dates) {
    const status = statusAt(employee.id, date);
    if (status === 'T') { summary.worked++; continue; }
    if (status === 'F') { summary.off++; continue; }
    if (status === 'H') { summary.holidayOff++; continue; }
    const reasons = restrictionsAt(employee, date);
    if (!reasons.length) { summary.unplanned++; continue; }
    summary.rest++;
    if (reasons.some(reason => reason.kind === 'dias')) summary.restDays++;
    if (reasons.some(reason => reason.kind === 'domingo')) summary.restSundays++;
  }
  // Conta datas: um DSR com dois motivos continua sendo um só dia sem trabalho.
  summary.notWorked = summary.off + summary.rest + summary.holidayOff;
  return summary;
}
