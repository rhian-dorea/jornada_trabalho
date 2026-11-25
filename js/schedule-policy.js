export const CHANGE_DATE = new Date(2026, 11, 16);
export const uses5x2 = date => date >= CHANGE_DATE;
// Decisão da empresa: dezembro inteiro já recebe a meta de nove DSR.
export const requiredMonthlyDsr = date => date.getFullYear() * 12 + date.getMonth() >= 2026 * 12 + 11 ? 9 : 4;
export function weekDates(date) {
  const start = new Date(date.getFullYear(),date.getMonth(),date.getDate()-(date.getDay()+6)%7);
  return Array.from({length:7},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
}
