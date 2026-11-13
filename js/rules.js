const next = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const label = date => `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`;

// Pré-validação visual. O PostgreSQL aplica a validação definitiva na transação.
export function validateWork(employee, date, isWorking) {
  let before = 0, after = 0;
  while (isWorking(employee.id, next(date, -before - 1))) before++;
  while (isWorking(employee.id, next(date, after + 1))) after++;
  if (before + after + 1 > 6)
    return `Bloqueado: ${employee.name} teria 7 dias seguidos de trabalho (inclui ${label(date)}). Folga (DSR) obrigatória.`;
  if (employee.sex === 'F' && date.getDay() === 0 &&
      (isWorking(employee.id, next(date, -7)) || isWorking(employee.id, next(date, 7))))
    return `Bloqueado: ${employee.name} trabalharia 2 domingos seguidos.`;
  return '';
}
