import { holidayFor } from './holidays.js';
import { calendarStatus, isDsrDate } from './dsr-date.js';
import { monthlyDsr } from './monthly-dsr.js';
import { summarizeEmployeeMonth } from './monthly-summary.js';

export function analyzeEmployeeMonth(employee, date, statusAt, reasonsAt) {
  const year=date.getFullYear(),month=date.getMonth();
  const dates=Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>new Date(year,month,i+1));
  const effective=(id,d)=>{
    const status=calendarStatus(statusAt(id,d),d);
    return !status&&holidayFor(d)&&reasonsAt(employee,d).length?'H':status;
  };
  return {
    summary:summarizeEmployeeMonth(employee,dates,effective,reasonsAt),
    dsr:monthlyDsr(employee,date,effective,reasonsAt),
    dsrDates:dates.filter(d=>isDsrDate(employee,d,effective,reasonsAt)),
    holidays:dates.filter(d=>holidayFor(d)).map(d=>({date:d,holiday:holidayFor(d),status:effective(employee.id,d),reasons:effective(employee.id,d)==='T'?[]:reasonsAt(employee,d)}))
  };
}
