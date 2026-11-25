const next = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const label = date => `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getFullYear()).slice(-2)}`;
const normalizedTitle = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function canonicalRole(value) {
  const title = normalizedTitle(value);
  if (['supervisor', 'supervisora'].includes(title)) return 'Supervisor';
  if (['coordenador', 'coordenadora', 'coodenador', 'coodenadora'].includes(title)) return 'Coordenador';
  return String(value ?? '').trim();
}

export function hasExtendedSchedule(employee) {
  return ['Supervisor', 'Coordenador'].includes(canonicalRole(employee.role ?? employee.cargo));
}

// Pré-validação visual. O PostgreSQL aplica a validação definitiva na transação.
export function assessWork(employee, date, isWorking, rules = {}, includeFuture = false) {
  const restrictions = [];
  const warnings = [];
  const extended = hasExtendedSchedule(employee);
  let before = 0, after = 0;
  while (isWorking(employee.id, next(date, -before - 1))) before++;
  // Avaliar um lançamento considera os dois lados; jornadas existentes usam o ciclo até a data.
  if (includeFuture) while (isWorking(employee.id, next(date, after + 1))) after++;
  const days = before + after + 1;
  const configuredDays = Number(extended ? rules.dias_lideranca ?? 7 : rules.dias ?? 6);
  const maxDays = Math.min(6,configuredDays);
  const maxSundays = 1;
  if (days > maxDays)
    restrictions.push({ kind: 'dias', short: `${maxDays + 1}º dia seguido`,
      message: `Bloqueado: ${employee.name} teria ${days} dias seguidos de trabalho (inclui ${label(date)}).` });


  if (date.getDay() === 0) {
    if ((employee.sex ?? employee.sexo) === 'F') {
      let beforeSunday = 0, afterSunday = 0;
      while (isWorking(employee.id, next(date, -7 * (beforeSunday + 1)))) beforeSunday++;
      if (includeFuture) while (isWorking(employee.id, next(date, 7 * (afterSunday + 1)))) afterSunday++;
      const total = beforeSunday + afterSunday + 1;
      if (total > maxSundays) restrictions.push({ kind: 'domingo', short: `${maxSundays + 1} domingos seguidos`,
        message: `Bloqueado: ${employee.name} trabalharia ${total} domingos seguidos.` });

    }
  }
  return { restrictions, warnings };
}

export const workRestrictions = (employee, date, isWorking, rules) =>
  assessWork(employee, date, isWorking, rules).restrictions.map(reason => ({
    ...reason,
    // Exibir o limite da regra, sem apresentar o dia de descanso como dia trabalhado.
    message: `Descanso obrigatório em ${label(date)}: o ciclo anterior de ${employee.name} exige descanso nesta data (${reason.short}).`
  }));
export const workWarnings = (employee, date, isWorking, rules) => assessWork(employee, date, isWorking, rules).warnings;

export function validateWork(employee, date, isWorking, rules) {
  return assessWork(employee, date, isWorking, rules, true).restrictions[0]?.message || '';
}
