import { requiredMonthlyDsr, weekDates, uses5x2 } from './schedule-policy.js';

export function monthlyDsr(employee, date, statusAt, restrictionsAt) {
  const year = date.getFullYear(), month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const required = requiredMonthlyDsr(date);
  let granted = 0, worked = 0;
  for (let day = 1; day <= days; day++) {
    const current = new Date(year, month, day), status = statusAt(employee.id, current);
    if (status === 'T' || status === 'H') worked++;
    else if (status === 'F' || restrictionsAt(employee, current).length) granted++;
  }
  // Um descanso com dois motivos continua sendo uma única data de DSR.
  return { required, granted, missing: Math.max(0, required - granted),
    available: days - worked, compliant: granted >= required };
}

export function validateMonthlyDsrWork(employee, date, isWorking, statusAt = () => '') {
  const year = date.getFullYear(), month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const required = requiredMonthlyDsr(date);
  let worked = 0;
  for (let day = 1; day <= days; day++) {
    const current = new Date(year, month, day);
    if (isWorking(employee.id, current) || statusAt(employee.id, current) === 'H') worked++;
  }
  const proposed = worked + (isWorking(employee.id, date) || statusAt(employee.id, date) === 'H' ? 0 : 1);
  return days - proposed < required
    ? `Bloqueado: ${employee.name} precisa de pelo menos ${required} folgas DSR neste mês. Este lançamento deixaria somente ${days - proposed} dias disponíveis para DSR.` : '';
}

export function weeklyDsr(employee, date, statusAt, restrictionsAt) {
  const dates=weekDates(date), required=uses5x2(dates[6])?2:0;
  const granted=dates.filter(d=>statusAt(employee.id,d)==='F'||!statusAt(employee.id,d)&&restrictionsAt(employee,d).length).length;
  return { required, granted, missing:Math.max(0,required-granted) };
}

export function weeklyRestRestrictions(employee, date, statusAt) {
  if(!uses5x2(date)||statusAt(employee.id,date))return [];
  const unavailable=weekDates(date).filter(d=>['T','H'].includes(statusAt(employee.id,d))).length;
  return unavailable===5 ? [{kind:'semana',short:'Escala 5×2',message:`Descanso obrigatório: os outros cinco dias da semana de ${employee.name} já estão ocupados por trabalho ou feriado não trabalhado; esta data deve ser DSR.`}] : [];
}

export function validate5x2Work(employee, date, statusAt, proposedStatus='T') {
  const dates=weekDates(date);
  const same=d=>d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();
  const status=d=>same(d)?proposedStatus:statusAt(employee.id,d);
  const unavailable=dates.filter(d=>['T','H'].includes(status(d))).length;
  if(uses5x2(dates[6])&&unavailable>5)return `Bloqueado: a escala 5×2 exige dois DSR na semana para ${employee.name}. Feriado não trabalhado não substitui DSR.`;
  if(proposedStatus==='T'){
    // Também protege edições anteriores à transição que afetem um ciclo posterior.
    for(let offset=-6;offset<=0;offset++){
      const window=Array.from({length:7},(_,i)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+offset+i));
      if(uses5x2(window[6])&&window.every(d=>status(d)==='T'))return `Bloqueado: ${employee.name} não pode trabalhar sete dias consecutivos na escala 5×2.`;
    }
  }
  return '';
}
