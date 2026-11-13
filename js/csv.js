const header = 'Funcionario;Sexo;Cargo;Data;Registro';
const safe = value => {
  const text = String(value ?? '').replace(/[\r\n;]/g, ' ').trim();
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
};

export function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.trim());
  const errors = [], rows = [], seen = new Set();
  if (!lines.length) return { rows, errors: ['Arquivo vazio.'] };
  if (lines[0].trim().toLowerCase() !== header.toLowerCase())
    errors.push('Cabeçalho esperado: ' + header);
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(';').map(x => x.trim());
    const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(p[3] || '');
    let iso = '';
    if (dm) {
      const d = new Date(+dm[3], +dm[2] - 1, +dm[1]);
      if (d.getFullYear() === +dm[3] && d.getMonth() === +dm[2] - 1 && d.getDate() === +dm[1])
        iso = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    }
    const sex = /^(homem|m)$/i.test(p[1] || '') ? 'M' : /^(mulher|f)$/i.test(p[1] || '') ? 'F' : '';
    const status = /^trabalho$/i.test(p[4] || '') ? 'trabalho' : /^folga(?:\s*\(dsr\))?$/i.test(p[4] || '') ? 'folga' : '';
    if (p.length !== 5 || !p[0] || p[0].length > 60 || !sex || (p[2]||'').length > 40 || !iso || !status) {
      errors.push(`Linha ${i + 1}: colunas ou campos inválidos.`); continue;
    }
    const identity = `${p[0].toLocaleLowerCase('pt-BR')}|${sex}|${p[2]}|${iso}`;
    if (seen.has(identity)) { errors.push(`Linha ${i + 1}: duplicada no arquivo.`); continue; }
    seen.add(identity);
    rows.push({ nome: p[0], sexo: sex, cargo: p[2], data: iso, situacao: status });
  }
  rows.sort((a, b) => a.data.localeCompare(b.data));
  return { rows, errors };
}

export function exportCSV(emps, journeys) {
  const byId = new Map(emps.map(e => [e.id, e]));
  return '\uFEFF' + [header, ...journeys.map(j => {
    const e = byId.get(j.funcionario_id);
    if (!e) return null;
    return [safe(e.nome), e.sexo === 'F' ? 'Mulher' : 'Homem', safe(e.cargo),
      `${j.data.slice(8, 10)}/${j.data.slice(5, 7)}/${j.data.slice(0, 4)}`,
      j.situacao === 'trabalho' ? 'Trabalho' : 'Folga (DSR)'].join(';');
  }).filter(Boolean)].join('\r\n');
}
