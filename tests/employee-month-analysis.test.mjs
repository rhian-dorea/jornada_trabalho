import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmployeeMonth } from '../js/employee-month-analysis.js';
import { workRestrictions, validateWork } from '../js/rules.js';
import { holidayFor } from '../js/holidays.js';
const d=s=>new Date(s+'T12:00:00');
const key=day=>`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
const e={id:'lara',name:'Lara',sex:'F',role:'Coordenador'};
const reader=records=>(_id,date)=>records.get(key(date))||'';
const reasons=(employee,read)=> (_e,date)=>workRestrictions(employee,date,(id,x)=>read(id,x)==='T');

test('domingo 06 trabalhado e 13 de descanso soma um DSR sem feriado',()=>{
  const read=reader(new Map([['2026-09-06','T']]));
  const result=analyzeEmployeeMonth(e,d('2026-09-01'),read,reasons(e,read));
  assert.ok(result.dsrDates.some(x=>key(x)==='2026-09-13'));
  assert.equal(result.dsr.granted,result.dsrDates.length);
  assert.ok(result.dsrDates.every(x=>!holidayFor(x)));
});
test('domingo feriado mantém motivo de dois domingos e soma zero DSR',()=>{
  const read=reader(new Map([['2026-11-08','T']]));
  const result=analyzeEmployeeMonth(e,d('2026-11-01'),read,reasons(e,read));
  const holiday=result.holidays.find(x=>key(x.date)==='2026-11-15');
  assert.equal(holiday.status,'H');
  assert.equal(holiday.reasons[0].short,'2 domingos seguidos');
  assert.ok(!result.dsrDates.some(x=>key(x)==='2026-11-15'));
});
test('feriado após seis trabalhos preserva motivo de sete dias sem somar DSR',()=>{
  const records=new Map(Array.from({length:6},(_,i)=>[`2026-11-${14+i}`,'T']));
  const read=reader(records),result=analyzeEmployeeMonth(e,d('2026-11-01'),read,reasons(e,read));
  const holiday=result.holidays.find(x=>key(x.date)==='2026-11-20');
  assert.equal(holiday.status,'H');
  assert.equal(holiday.reasons[0].short,'7º dia seguido');
  assert.ok(!result.dsrDates.some(x=>key(x)==='2026-11-20'));
});
test('domingos na virada do ano: somente mulher bloqueada; descanso em feriado não vira DSR',()=>{
  const read=reader(new Map([['2026-12-27','T']]));
  for(const sex of ['M','F']){
    const employee={...e,sex};
    const message=validateWork(employee,d('2027-01-03'),(id,x)=>read(id,x)==='T');
    if(sex==='F')assert.match(message,/domingos/);else assert.equal(message,'');
  }
  const records=new Map([['2026-11-15','F'],['2026-11-20','F'],['2026-11-24','F']]);
  const r=reader(records),result=analyzeEmployeeMonth(e,d('2026-11-01'),r,reasons(e,r));
  assert.deepEqual(result.dsrDates.map(key),['2026-11-24']);
  assert.equal(result.summary.holidayOff,2);
  assert.equal(result.dsr.granted,1);
});
