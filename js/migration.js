export function readLegacy() {
  for (const origin of ['escala_dsr_v2', 'escala_dsr_v1']) {
    const raw = localStorage.getItem(origin);
    if (!raw) continue;
    return parseLegacy(raw, origin);
  }
  return null;
}

export function parseLegacy(raw, origin = 'escala_dsr_v2') {
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`${origin}: JSON inválido.`); }
    if (!data || !Array.isArray(data.emps) || typeof data.rec !== 'object' || !data.rec)
      throw new Error(`${origin}: estrutura inválida.`);
    const ids = new Set(), emps = [], journeys = [], errors = [];
    for (const e of data.emps) {
      if (!e?.id || ids.has(e.id) || !e.name || !['M', 'F'].includes(e.sex)) {
        errors.push(`Funcionário inválido ou duplicado: ${e?.id ?? '(sem id)'}`); continue;
      }
      ids.add(e.id);
      emps.push({ id: String(e.id), nome: String(e.name), sexo: e.sex, cargo: String(e.role || '') });
    }
    for (const [id, dates] of Object.entries(data.rec)) {
      if (!ids.has(id) || !dates || typeof dates !== 'object') { errors.push(`Registros sem funcionário: ${id}`); continue; }
      for (const [date, status] of Object.entries(dates)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['T', 'F'].includes(status)) {
          errors.push(`Registro inválido: ${id} em ${date}`); continue;
        }
        const d = new Date(`${date}T12:00:00`);
        if (Number.isNaN(d.getTime()) || date !== `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) {
          errors.push(`Data inválida: ${date}`); continue;
        }
        journeys.push({ legado_id: id, data: date, situacao: status === 'T' ? 'trabalho' : 'folga' });
      }
    }
    journeys.sort((a, b) => a.data.localeCompare(b.data));
    return { origin, raw, emps, journeys, errors };
}

export function backup(legacy) {
  const url = URL.createObjectURL(new Blob([legacy.raw], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `backup-${legacy.origin}-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
