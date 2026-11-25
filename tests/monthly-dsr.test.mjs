import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyDsr, validateMonthlyDsrWork, weeklyDsr, validate5x2Work, weeklyRestRestrictions } from '../js/monthly-dsr.js';
import { requiredMonthlyDsr } from '../js/schedule-policy.js';
import { summarizeEmployeeMonth } from '../js/monthly-summary.js';
import { nationalHolidays, holidayFor } from '../js/holidays.js';

const employee = { id: 'lara', name: 'Lara' };
const date = (year, month, day) => new Date(year, month - 1, day);

test('DSR soma folga e descansos, conta data com dois motivos uma vez e ignora vazio', () => {
  const statuses = new Map([[1,'F'],[2,'F'],[3,'T']]);
  const reasons = (_e,d) => d.getDate() === 4 ? [{kind:'dias'},{kind:'domingo'}]
    : d.getDate() === 5 ? [{kind:'domingo'}] : [];
  const result = monthlyDsr(employee,date(2026,11,1),(_id,d)=>statuses.get(d.getDate())||'',reasons);
  assert.equal(result.granted,4);
  assert.equal(result.missing,0);
  assert.equal(result.compliant,true);
  statuses.delete(2);
  const corrected = monthlyDsr(employee,date(2026,11,1),(_id,d)=>statuses.get(d.getDate())||'',reasons);
  assert.equal(corrected.granted,3);
  assert.equal(corrected.missing,1);
});

test('todos os funcionários começam com quatro DSR pendentes; feriado sozinho não conta', () => {
  for(const role of ['Despachante','Analista','Supervisor','Coordenador']){
    const result = monthlyDsr({...employee,role},date(2026,11,1),()=>'',()=>[]);
    assert.equal(result.granted,0);
    assert.equal(result.missing,4);
  }
  assert.ok(holidayFor(date(2026,11,20)));
});

test('mínimo mensal reserva o número exigido em meses de 28, 29, 30 e 31 dias', () => {
  for(const [year,month] of [[2025,2],[2024,2],[2026,11],[2026,12],[2027,2],[2028,2]]){
    const days=new Date(year,month,0).getDate();
    const required=requiredMonthlyDsr(date(year,month,1));
    const working=(_id,d)=>d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()<=days-required-1;
    assert.equal(validateMonthlyDsrWork(employee,date(year,month,days-required),working),'');
    const filled=(_id,d)=>d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()<=days-required;
    assert.match(validateMonthlyDsrWork(employee,date(year,month,days-required+1),filled),new RegExp(`${required} folgas DSR`));
    assert.equal(validateMonthlyDsrWork(employee,date(year,month,1),filled),'');
  }
});

test('transição: nove DSR desde dezembro inteiro, inclusive fevereiro; antes são quatro', () => {
  assert.equal(requiredMonthlyDsr(date(2026,11,30)),4);
  for(const d of [date(2026,12,1),date(2026,12,15),date(2026,12,16),date(2027,2,1)])assert.equal(requiredMonthlyDsr(d),9);
});

test('9 DSR mais um feriado não trabalhado são 10 dias sem trabalho, sem DSR extra', () => {
  const dates=Array.from({length:31},(_,i)=>date(2027,1,i+1));
  const read=(_id,d)=>d.getDate()>=2&&d.getDate()<=10?'F':d.getDate()===1?'H':'T';
  assert.ok(holidayFor(dates[0]));
  assert.equal(monthlyDsr(employee,dates[0],read,()=>[]).granted,9);
  const summary=summarizeEmployeeMonth(employee,dates,read,()=>[]);
  assert.equal(summary.notWorked,10);
  assert.equal(summary.holidayOff,1);
  const coinciding=(_id,d)=>d.getDate()<=9?'F':'T';
  assert.equal(monthlyDsr(employee,dates[0],coinciding,()=>[]).granted,9);
  assert.equal(summarizeEmployeeMonth(employee,dates,coinciding,()=>[]).notWorked,9);
});

test('5x2 reserva dois DSR por semana a partir de 16/12, incluindo semana entre meses', () => {
  const read=(_id,d)=>d.getDay()>=1&&d.getDay()<=5?'T':'';
  assert.match(validate5x2Work(employee,date(2026,12,19),read),/dois DSR/);
  assert.equal(validate5x2Work(employee,date(2026,12,12),read),'');
  assert.match(validate5x2Work(employee,date(2027,1,2),read),/dois DSR/);
  const reasons=(e,d)=>weeklyRestRestrictions(e,d,read);
  assert.equal(weeklyDsr(employee,date(2027,1,2),read,reasons).granted,2);
  assert.equal(weeklyRestRestrictions(employee,date(2026,12,12),read).length,0);
  assert.equal(weeklyRestRestrictions(employee,date(2027,1,2),read)[0].kind,'semana');
  assert.match(validate5x2Work(employee,date(2027,1,2),read,'H'),/dois DSR/);
});

test('feriados nacionais incluem 20/11 a partir de 2024; calendário não inventa pontos facultativos', () => {
  assert.equal(nationalHolidays(2026).length,9);
  assert.equal(nationalHolidays(2023).some(h=>h.data==='2023-11-20'),false);
  assert.match(holidayFor(date(2026,11,20)).nome,/Consciência Negra/);
  assert.equal(holidayFor(date(2026,2,17)),null); // Carnaval depende de localidade/regime.
  assert.equal(holidayFor(date(2026,4,3)),null); // Sexta-Feira da Paixão depende de lei local.
  assert.equal(holidayFor(date(2026,6,4)),null); // Corpus Christi não é feriado nacional geral.
  assert.equal(holidayFor(date(2026,1,1)).data,'2026-01-01');
});

test('calendário nacional não inclui feriados estaduais ou municipais', () => {
  for(const [m,d] of [[3,19],[6,24],[7,2],[7,28]])assert.equal(holidayFor(date(2026,m,d)),null);
});
