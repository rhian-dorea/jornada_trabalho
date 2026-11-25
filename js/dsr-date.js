import { holidayFor } from './holidays.js';

// Política da empresa: feriados nacionais não entram no DSR, inclusive Folgas antigas.
export const calendarStatus = (status,date) => status === 'F' && holidayFor(date) ? 'H' : status;
export function isDsrDate(employee, date, statusAt, restrictionsAt) {
  if (holidayFor(date)) return false;
  const status = statusAt(employee.id, date);
  return status === 'F' || !status && !holidayFor(date) && restrictionsAt(employee, date).length > 0;
}
