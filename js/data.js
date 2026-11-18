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
export const journeys = (start, end) => all('jornadas', 'id,funcionario_id,data,situacao,atualizado_em',
  q => q.gte('data', start).lte('data', end).order('data').order('id'));
export const allJourneys = () => all('jornadas', 'id,funcionario_id,data,situacao', q => q.order('data').order('id'));
export const saveEmployee = payload => db.rpc('salvar_funcionario', payload).then(check);
export const saveJourney = payload => db.rpc('salvar_jornada', payload).then(check);
export const companySettings = async () => check(await db.from('empresas').select('id,nome,logo_url,cor_primaria,tema,regras,cobertura,feriados').limit(1).maybeSingle());
export const importRows = rows => db.rpc('importar_csv', { p_linhas: rows }).then(check);
export const migrateLocal = (origin, emps, rec) => db.rpc('migrar_local', {
  p_origem: origin, p_funcionarios: emps, p_jornadas: rec
}).then(check);
