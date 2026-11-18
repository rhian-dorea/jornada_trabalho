import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && window.supabase);
export const db = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    }) : null;

function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function all(table, columns, query = q => q) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = check(await query(db.from(table).select(columns)).range(offset, offset + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export const profile = async id => check(await db.from('perfis').select('id,nome,perfil,ativo').eq('id', id).maybeSingle());
export const employees = () => all('funcionarios', 'id,nome,sexo,cargo,equipe,matricula,ativo,atualizado_em', q => q.order('nome'));
export async function journeys(start, end) {
  const query = q => q.gte('data', start).lte('data', end).order('data').order('id');
  try { return await all('jornadas', 'id,funcionario_id,data,situacao,atualizado_em,turno_nome,inicio,fim', query); }
  catch (error) { if (error.code !== '42703') throw error; return all('jornadas', 'id,funcionario_id,data,situacao,atualizado_em', query); }
}
export const allJourneys = () => all('jornadas', 'id,funcionario_id,data,situacao', q => q.order('data').order('id'));
export const saveEmployee = payload => db.rpc('salvar_funcionario', payload).then(check);
export const saveJourney = payload => {
  const { p_turno, ...base } = payload;
  return db.rpc(p_turno ? 'salvar_jornada_com_turno' : 'salvar_jornada', p_turno ? payload : base).then(check);
};
export const companySettings = async () => check(await db.from('empresas').select('id,nome,logo_url,cor_primaria,tema,regras,turnos,cobertura,feriados').limit(1).maybeSingle());
export const importRows = rows => db.rpc('importar_csv', { p_linhas: rows }).then(check);
export const migrateLocal = (origin, emps, rec) => db.rpc('migrar_local', {
  p_origem: origin, p_funcionarios: emps, p_jornadas: rec
}).then(check);
