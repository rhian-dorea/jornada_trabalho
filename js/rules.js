const next = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const label = date => `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`;
const specialTitles = new Set(['supervisor', 'supervisora', 'coordenador', 'coordenadora', 'coodenador', 'coodenadora']);

export function hasExtendedSchedule(employee) {
  const title = String(employee.role ?? employee.cargo ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return specialTitles.has(title);
}

// Pré-validação visual. O PostgreSQL aplica a validação definitiva na transação.
export function assessWork(employee, date, isWorking) {
  const restrictions = [];
  const warnings = [];
  const extended = hasExtendedSchedule(employee);
  const current = isWorking(employee.id, date);
  let before = 0, after = 0;
  while (isWorking(employee.id, next(date, -before - 1))) before++;
  while (isWorking(employee.id, next(date, after + 1))) after++;
  const days = before + after + 1;
  if (days > (extended ? 7 : 6))
    restrictions.push({ kind: 'dias', short: extended ? '8º dia seguido' : '7º dia seguido',
      message: `Bloqueado: ${employee.name} teria ${days} dias seguidos de trabalho (inclui ${label(date)}).` });
  else if (extended && days === 7 && (!current || before === 6))
    warnings.push({ kind: 'dias', short: '7º dia seguido' });

  if (date.getDay() === 0) {
    const previous = isWorking(employee.id, next(date, -7));
    const following = isWorking(employee.id, next(date, 7));
    if (extended) {
      const triple = previous && (isWorking(employee.id, next(date, -14)) || following) ||
        following && isWorking(employee.id, next(date, 14));
      if (triple) restrictions.push({ kind: 'domingo', short: '3 domingos seguidos',
        message: `Bloqueado: ${employee.name} trabalharia 3 domingos seguidos.` });
      else if ((previous || following) && (!current || previous))
        warnings.push({ kind: 'domingo', short: '2 domingos seguidos' });
    } else if (employee.sex === 'F' && (previous || following)) {
      restrictions.push({ kind: 'domingo', short: '2 domingos seguidos',
        message: `Bloqueado: ${employee.name} trabalharia 2 domingos seguidos.` });
    }
  }
  return { restrictions, warnings };
}

export const workRestrictions = (employee, date, isWorking) => assessWork(employee, date, isWorking).restrictions;
export const workWarnings = (employee, date, isWorking) => assessWork(employee, date, isWorking).warnings;

export function validateWork(employee, date, isWorking) {
  return workRestrictions(employee, date, isWorking)[0]?.message || '';
}
