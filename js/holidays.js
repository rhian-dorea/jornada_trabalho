const FIXED = [
  ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'], ['12-25', 'Natal']
];

export function nationalHolidays(year) {
  const dates = [...FIXED];
  if (year >= 2024) dates.push(['11-20', 'Dia Nacional de Zumbi e da Consciência Negra']);
  return dates.map(([day, nome]) => ({ data: `${year}-${day}`, nome, abrangencia: 'Nacional' }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

const cache = new Map();
export function holidayFor(date) {
  const year = date.getFullYear();
  if (!cache.has(year)) cache.set(year, new Map(nationalHolidays(year).map(h => [h.data, h])));
  const data = `${year}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return cache.get(year).get(data) || null;
}
