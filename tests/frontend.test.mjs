import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWork } from '../js/rules.js';
import { parseCSV, exportCSV } from '../js/csv.js';
import { readLegacy } from '../js/migration.js';

const date = s => new Date(`${s}T12:00:00`);
const work = values => (_id, d) => values.has(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
const emp = { id: 'e1', name: 'Ana', sex: 'F' };

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
