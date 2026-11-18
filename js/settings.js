export const defaults = Object.freeze({
  nome: 'Controle de Escalas', logo_url: '', cor_primaria: '#173b69', tema: 'light',
  regras: { dias: 6, domingos: 1, dias_lideranca: 7, domingos_lideranca: 2 },
  cobertura: { geral: [1,1,1,1,1,1,1], equipes: {} }, feriados: []
});

export function normalizeSettings(value = {}) {
  const rules = value.regras || {};
  return {
    ...defaults, ...value,
    regras: Object.fromEntries(Object.entries(defaults.regras).map(([key, fallback]) => {
      const number = Number(rules[key]);
      return [key, Number.isInteger(number) && number >= 0 && number <= 24 ? number : fallback];
    })),
    cobertura: { ...defaults.cobertura, ...(value.cobertura || {}), equipes: value.cobertura?.equipes || {} },
    feriados: Array.isArray(value.feriados) ? value.feriados : []
  };
}

export function coverageGap(date, employees, isWorking, settings, team = '') {
  const active = employees.filter(e => e.ativo && (!team || e.equipe === team));
  const count = active.filter(e => isWorking(e.id, date)).length;
  const byTeam = settings.cobertura.equipes?.[team];
  const minimum = Number((team && byTeam || settings.cobertura.geral)[date.getDay()]) || 0;
  const baseMissing = Math.max(0, minimum - count);
  if (team) return { count, minimum, missing: baseMissing };
  const teamMissing = Object.entries(settings.cobertura.equipes || {}).reduce((sum, [name, values]) => {
    const actual = active.filter(e => e.equipe === name && isWorking(e.id, date)).length;
    return sum + Math.max(0, (Number(values[date.getDay()]) || 0) - actual);
  }, 0);
  return { count, minimum, missing: Math.max(baseMissing, teamMissing) };
}
