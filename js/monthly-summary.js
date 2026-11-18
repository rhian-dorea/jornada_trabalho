export function summarizeEmployeeMonth(employee, dates, statusAt, restrictionsAt) {
  const summary = { worked: 0, notWorked: 0, off: 0, rest: 0, restDays: 0, restSundays: 0, unplanned: 0 };
  for (const date of dates) {
    const status = statusAt(employee.id, date);
    if (status === 'T') { summary.worked++; continue; }
    if (status === 'F') { summary.off++; summary.notWorked++; continue; }
    const reasons = restrictionsAt(employee, date);
    if (!reasons.length) { summary.unplanned++; continue; }
    summary.rest++;
    summary.notWorked++;
    if (reasons.some(reason => reason.kind === 'dias')) summary.restDays++;
    if (reasons.some(reason => reason.kind === 'domingo')) summary.restSundays++;
  }
  return summary;
}
