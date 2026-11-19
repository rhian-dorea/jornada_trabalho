import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWork, workRestrictions, workWarnings, hasExtendedSchedule, canonicalRole } from '../js/rules.js';
import { parseCSV, exportCSV } from '../js/csv.js';
import { readLegacy } from '../js/migration.js';
import { normalizeSettings, coverageGap } from '../js/settings.js';
import { dayPeople, showCoverageAlert, mondayOffset } from '../js/calendar-state.js';
import { summarizeEmployeeMonth } from '../js/monthly-summary.js';

const date = s => new Date(`${s}T12:00:00`);
const work = values => (_id, d) => values.has(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
const emp = { id: 'e1', name: 'Ana', sex: 'F' };

test('semana começa na segunda e domingo encerra a mesma semana', () => {
  assert.equal(mondayOffset(date('2026-11-16')),0);
  assert.equal(mondayOffset(date('2026-11-22')),6);
  const sunday=date('2026-11-01');
  sunday.setDate(sunday.getDate()-mondayOffset(sunday));
  assert.equal(sunday.getMonth(),9);
  assert.equal(sunday.getDate(),26);
});

test('descanso no domingo reinicia o ciclo sem unir dias futuros (caso Lara)', () => {
  const days=new Set([8,10,11,12,13,16,17,18,19,21,22,23,24,25,26,28,30].map(n=>`2026-11-${String(n).padStart(2,'0')}`));
  const working=work(days);
  assert.deepEqual(workRestrictions(emp,date('2026-11-15'),working).map(r=>r.kind),['domingo']);
  assert.deepEqual(workRestrictions(emp,date('2026-11-20'),working),[]);
  assert.deepEqual(workRestrictions(emp,date('2026-11-27'),working).map(r=>r.kind),['dias']);
  assert.equal(workRestrictions(emp,date('2026-11-27'),working)[0].message.includes('7 dias'),true);
  assert.deepEqual(workRestrictions(emp,date('2026-11-28'),working),[]);
  assert.deepEqual(workRestrictions(emp,date('2026-11-29'),working).map(r=>r.kind),['domingo']);
  // Preencher o descanso uniria os blocos: continua proibido na gravação.
  assert.match(validateWork(emp,date('2026-11-20'),working),/11 dias/);
});

test('domingo sem trabalho reinicia domingos; dias de descanso reiniciam dias corridos', () => {
  const days=new Set(['2026-11-01','2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-16']);
  const working=work(days);
  assert.deepEqual(workRestrictions(emp,date('2026-11-08'),working).map(r=>r.kind),['domingo']);
  assert.deepEqual(workRestrictions(emp,date('2026-11-15'),working).map(r=>r.kind),['dias']);
  assert.deepEqual(workRestrictions(emp,date('2026-11-16'),working),[]);
  assert.deepEqual(workRestrictions(emp,date('2026-11-22'),working),[]);
});

test('cinco e seis dias são permitidos; sétimo é bloqueado', () => {
  const five = new Set(['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05']);
  assert.equal(validateWork({...emp,sex:'M'},date('2026-11-06'),work(five)), '');
  five.add('2026-11-06');
  assert.match(validateWork({...emp,sex:'M'},date('2026-11-07'),work(five)),/7 dias/);
});
test('lançamento retroativo unindo duas sequências cruza mês e ano', () => {
  const days = new Set(['2026-12-28','2026-12-29','2026-12-30','2027-01-01','2027-01-02','2027-01-03']);
  assert.match(validateWork({...emp,sex:'M'},date('2026-12-31'),work(days)),/7 dias/);
});
test('domingos consecutivos são bloqueados em meses diferentes', () => {
  assert.match(validateWork(emp,date('2026-12-06'),work(new Set(['2026-11-29']))),/domingos/);
  assert.match(validateWork(emp,date('2026-11-29'),work(new Set(['2026-12-06']))),/domingos/);
});
test('dia sem lançamento interrompe a sequência', () => {
  const days = new Set(['2026-11-01','2026-11-02','2026-11-03','2026-11-05','2026-11-06']);
  assert.equal(validateWork({...emp,sex:'M'},date('2026-11-07'),work(days)), '');
});
test('supervisor pode o sétimo dia com aviso vermelho, mas não o oitavo', () => {
  const supervisor={...emp,sex:'M',role:'Supervisor'};
  const days=new Set(['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
  assert.equal(validateWork(supervisor,date('2026-11-07'),work(days)),'');
  assert.equal(workWarnings(supervisor,date('2026-11-07'),work(days))[0].short,'7º dia seguido');
  days.add('2026-11-07');
  assert.equal(workWarnings(supervisor,date('2026-11-01'),work(days)).length,0);
  assert.equal(workWarnings(supervisor,date('2026-11-07'),work(days))[0].short,'7º dia seguido');
  assert.match(validateWork(supervisor,date('2026-11-08'),work(days)),/8 dias/);
});
test('coordenador pode dois domingos com aviso, mas não três', () => {
  const coordinator={...emp,role:'Coordenador'};
  const days=new Set(['2026-11-01']);
  assert.equal(validateWork(coordinator,date('2026-11-08'),work(days)),'');
  assert.equal(workWarnings(coordinator,date('2026-11-08'),work(days))[0].short,'2 domingos seguidos');
  days.add('2026-11-08');
  assert.equal(workWarnings(coordinator,date('2026-11-01'),work(days)).length,0);
  assert.equal(workWarnings(coordinator,date('2026-11-08'),work(days))[0].short,'2 domingos seguidos');
  assert.match(validateWork(coordinator,date('2026-11-15'),work(days)),/3 domingos/);
  assert.match(validateWork({...coordinator,sex:'M'},date('2026-11-08'),work(new Set(['2026-11-01','2026-11-15']))),/3 domingos/);
  assert.equal(hasExtendedSchedule({...emp,role:'Coodenador'}),true);
  assert.equal(hasExtendedSchedule({...emp,role:'Analista'}),false);
});
test('cargos antigos são exibidos com nomes masculinos únicos', () => {
  assert.equal(canonicalRole('Supervisora'), 'Supervisor');
  assert.equal(canonicalRole('coodenadora'), 'Coordenador');
  assert.equal(canonicalRole('Coordenador'), 'Coordenador');
  assert.equal(canonicalRole('Analista'), 'Analista');
  assert.equal(hasExtendedSchedule({...emp,role:'Supervisora'}), true);
});
test('CSV valida datas, duplicidade e colunas', () => {
  const parsed = parseCSV('Funcionario;Sexo;Cargo;Data;Registro\nAna;Mulher;A;31/02/2026;Trabalho\nAna;Mulher;A;01/11/2026;Trabalho\nAna;Mulher;A;01/11/2026;Trabalho\nX;Homem');
  assert.equal(parsed.rows.length,1);assert.equal(parsed.errors.length,3);
  assert.equal(parseCSV('').errors.length,1);
});
test('CSV exportado neutraliza fórmulas', () => {
  const out=exportCSV([{id:'1',nome:'=SUM(1)',sexo:'M',cargo:'@cmd'}],
    [{funcionario_id:'1',data:'2026-11-01',situacao:'folga'}]);
  assert.match(out,/\'=SUM\(1\)/);assert.match(out,/\'@cmd/);
});
test('migração preserva associação por ID e rejeita datas inválidas', () => {
  globalThis.localStorage={getItem:k=>k==='escala_dsr_v2'?JSON.stringify({emps:[{id:'old1',name:'Ana',sex:'F',role:'A'}],rec:{old1:{'2026-11-01':'T','2026-02-30':'F'}}}):null};
  const result=readLegacy();
  assert.equal(result.emps[0].id,'old1');assert.equal(result.journeys[0].legado_id,'old1');
  assert.equal(result.errors.length,1);
  delete globalThis.localStorage;
});
test('limites configuráveis alteram a pré-validação sem mudar os padrões', () => {
  const days = new Set(['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
  assert.match(validateWork({...emp,sex:'M'},date('2026-11-07'),work(days)),/7 dias/);
  assert.equal(validateWork({...emp,sex:'M'},date('2026-11-07'),work(days),{dias:7}), '');
  assert.match(validateWork({...emp,role:'Supervisor'},date('2026-11-07'),work(days),{dias_lideranca:6}),/7 dias/);
  assert.equal(validateWork(emp,date('2026-11-08'),work(new Set(['2026-11-01'])),{domingos:2}), '');
});
test('cobertura soma equipes sem contar duas vezes a falta geral', () => {
  const settings=normalizeSettings({cobertura:{geral:[1,1,1,1,1,1,1],equipes:{A:[2,0,0,0,0,0,0],B:[1,0,0,0,0,0,0]}}});
  const staff=[{id:'a',equipe:'A',ativo:true},{id:'b',equipe:'B',ativo:true}];
  const result=coverageGap(date('2026-11-01'),staff,(id)=>id==='a',settings);
  assert.equal(result.count,1);assert.equal(result.missing,2);
  assert.equal(coverageGap(date('2026-11-01'),staff,(id)=>id==='a',settings,'B').missing,1);
});
test('detalhe semanal limita a pessoa da linha; mensal mantém o dia completo', () => {
  const people=[{id:'a',name:'Ana'},{id:'b',name:'Bruno'}];
  assert.deepEqual(dayPeople(people,'b'),[people[1]]);
  assert.deepEqual(dayPeople(people),people);
});
test('dia sem trabalhadores não exibe aviso de cobertura', () => {
  assert.equal(showCoverageAlert(0,1),false);
  assert.equal(showCoverageAlert(1,1),true);
  assert.equal(showCoverageAlert(1,0),false);
});

test('resumo mensal separa folga, descanso calculado e ausência de lançamento', () => {
  const dates=['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'].map(date);
  const statuses=new Map([['2026-11-01','T'],['2026-11-02','F']]);
  const read=(_id,d)=>statuses.get(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)||'';
  const reasons=(_employee,d)=>d.getDate()===3?[{kind:'dias'},{kind:'domingo'}]:d.getDate()===4?[{kind:'dias'}]:[];
  assert.deepEqual(summarizeEmployeeMonth(emp,dates,read,reasons),{
    worked:1,notWorked:4,off:1,rest:2,restDays:2,restSundays:1,unplanned:1
  });
});
