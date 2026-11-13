import { db, configured, profile, employees, journeys, allJourneys, all, saveEmployee, saveJourney, importRows, migrateLocal } from './data.js';
import { parseCSV, exportCSV } from './csv.js';
import { readLegacy, parseLegacy, backup } from './migration.js';
import { validateWork } from './rules.js';

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const add = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const fromKey = k => { const p=k.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); };
const today = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
const MN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=d=>pad(d.getDate())+'/'+pad(d.getMonth()+1);
let S={emps:[],rec:{},versions:{},empVersions:{}};
let user=null, role=null, mode='m', D=today(), busy=false, loadSeq=0, editId=null, preview=null, legacy=null, uploadedLegacy=null, migrationReport=null, modalReturnFocus=null;
const st=(id,d)=>(S.rec[id]||{})[key(d)]||'';
const W=(id,d)=>st(id,d)==='T';
function pos(id,d){let b=0;while(W(id,add(d,-b-1)))b++;return b+1}
function run(id,d){let b=0,f=0;while(W(id,add(d,-b-1)))b++;while(W(id,add(d,f+1)))f++;return 1+b+f}
function sunV(e,d){return e.sex==='F'&&d.getDay()===0&&W(e.id,d)&&(W(e.id,add(d,-7))||W(e.id,add(d,7)))}
const check=(e,d)=>validateWork(e,d,W);
function toast(m,ok=false){const t=$('#toast');t.style.background=ok?'var(--ok)':'';t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',5200)}
function info(e,d){
  const c=st(e.id,d);
  if(c==='T'){const p=pos(e.id,d),sv=sunV(e,d);
    if(p>=7)return{c:'bad',t:p+'º dia ✕ irregular'};
    if(sv)return{c:'bad',t:'2 domingos ✕'};
    return{c:p===6?'lim':'t',t:'Trab. '+p+'º'+(p===6?' · limite':'')}}
  if(c==='F')return{c:'f',t:'Folga'};
  if(W(e.id,add(d,-1))&&pos(e.id,add(d,-1))>=6)return{c:'must',t:'Folga obrigatória'};
  if(e.sex==='F'&&d.getDay()===0&&(W(e.id,add(d,-7))||W(e.id,add(d,7))))return{c:'must',t:'Domingo bloqueado'};
  return{c:'z',t:'—'};
}
function render(){
  const t=today();let y=D.getFullYear(),m=D.getMonth(),from,to;
  if(mode==='m'){
    $('#ttl').textContent=MN[m]+' '+y;
    const f=new Date(y,m,1),nd=new Date(y,m+1,0).getDate(),wks=Math.ceil((f.getDay()+nd)/7);from=f;to=new Date(y,m,nd);
    let h='<div class="cal">'+WD.map(w=>'<div class="h">'+w+'</div>').join('');
    for(let i=0;i<wks*7;i++){
      const d=add(f,i-f.getDay());
      h+='<div class="d '+(d.getMonth()!==m?'o ':'')+(d.getDay()===0?'s ':'')+(+d===+t?'t':'')+'" data-day="'+key(d)+'" tabindex="0" role="button" aria-label="Abrir dia '+key(d)+'"><span class="n">'+d.getDate()+'</span>'
        +S.emps.map(e=>{const o=info(e,d);return '<div class="ch '+o.c+'" title="'+esc(e.name+' — '+o.t)+'"><span>'+esc(e.name.split(' ')[0])+'</span><em>'+o.t+'</em></div>'}).join('')+'</div>';
    }
    $('#view').innerHTML=h+'</div>';
  }else{
    const s0=add(D,-D.getDay()),s6=add(s0,6);from=s0;to=s6;
    $('#ttl').textContent=s0.getDate()+' '+MN[s0.getMonth()].slice(0,3)+' a '+s6.getDate()+' '+MN[s6.getMonth()].slice(0,3)+' '+s6.getFullYear();
    let h='<div class="sc"><table><tr><th class="nm">Funcionário</th>';
    for(let i=0;i<7;i++){const d=add(s0,i);h+='<th>'+WD[i]+'<small>'+fd(d)+'</small></th>'}
    h+='<th>Maior sequência</th></tr>';
    if(!S.emps.length)h+='<tr><td class="empty" colspan="9">Nenhum funcionário. Adicione em Configurações.</td></tr>';
    S.emps.forEach(e=>{
      let mx=0;
      h+='<tr><td class="nm"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><b>'+esc(e.name)+'</b><span class="tag">'+(e.sex==='F'?'Mulher':'Homem')+'</span><small class="r">'+esc(e.role||'')+'</small></td>';
      for(let i=0;i<7;i++){const d=add(s0,i),o=info(e,d);if(W(e.id,d))mx=Math.max(mx,run(e.id,d));
        h+='<td class="c '+o.c+'" data-e="'+e.id+'" data-d="'+key(d)+'" tabindex="0" role="button" aria-label="'+esc(e.name)+' em '+key(d)+': '+esc(o.t)+'">'+o.t+'</td>'}
      h+='<td><b style="color:'+(mx>6?'var(--dg)':mx===6?'var(--wk)':'var(--ok)')+'">'+mx+' dia'+(mx===1?'':'s')+'</b></td></tr>';
    });
    $('#view').innerHTML=h+'</table></div>';
  }
  $('#tM').className=mode==='m'?'on':'';$('#tW').className=mode==='w'?'on':'';
  /* alertas do período exibido */
  const A=[];let nLim=0,nBad=0;
  S.emps.forEach(e=>{for(let d=from;+d<=+to;d=add(d,1)){
    if(!W(e.id,d))continue;const p=pos(e.id,d);
    if(p>=7){nBad++;A.push({k:'d',t:'<b>'+esc(e.name)+'</b>: '+p+'º dia seguido de trabalho em '+fd(d)+'. Irregular, folga (DSR) obrigatória.'})}
    else if(p===6){nLim++;A.push({k:'w',t:'<b>'+esc(e.name)+'</b>: 6º dia seguido em '+fd(d)+'. Folga obrigatória em '+fd(add(d,1))+'.'})}
    else if(p===5){A.push({k:'w',t:'<b>'+esc(e.name)+'</b>: 5º dia seguido em '+fd(d)+'. Atenção ao limite.'})}
    if(sunV(e,d)&&W(e.id,add(d,7))){nBad++;A.push({k:'d',t:'<b>'+esc(e.name)+'</b>: trabalha 2 domingos seguidos ('+fd(d)+' e '+fd(add(d,7))+'). Art. 386 da CLT.'})}
  }});
  const wk=S.emps.filter(e=>W(e.id,t)).length,fo=S.emps.filter(e=>st(e.id,t)==='F').length;
  $('#kpis').innerHTML=[['Funcionários',S.emps.length,''],['Trabalham hoje',wk,''],['De folga hoje',fo,''],['No limite (6º dia)',nLim,'w'],['Irregularidades',nBad,'d']].map(k=>'<div class="kpi '+k[2]+'"><b>'+k[1]+'</b><span>'+k[0]+(k[2]?' · período':'')+'</span></div>').join('');
  A.sort((a,b)=>a.k<b.k?-1:1);
  $('#alerts').innerHTML=A.slice(0,8).map(a=>'<div class="'+a.k+'">'+a.t+'</div>').join('')+(A.length>8?'<div class="w">+ '+(A.length-8)+' alertas no período.</div>':'');
}

function bounds(){
  let first,last;
  if(mode==='m'){
    const f=new Date(D.getFullYear(),D.getMonth(),1), e=new Date(D.getFullYear(),D.getMonth()+1,0);
    first=add(f,-f.getDay());last=add(e,6-e.getDay());
  }else{first=add(D,-D.getDay());last=add(first,6)}
  return [key(add(first,-7)),key(add(last,7))];
}
function setSync(message,error=false){$('#sync').textContent=message;$('#sync').classList.toggle('error',error)}
function explain(error){
  if(!error)return 'Erro desconhecido.';
  if(error.code==='40001')return 'Conflito de edição. Os dados foram atualizados; revise e tente novamente.';
  if(error.code==='42501')return 'Acesso negado ou sessão expirada. Verifique suas permissões.';
  if(error.code==='23514')return error.message;
  return error.message || 'Falha de conexão. Tente novamente.';
}
async function refresh(){
  if(!user)return;
  const seq=++loadSeq,[start,end]=bounds();setSync('Carregando…');
  try{
    const [emps,records,todayRows,p]=await Promise.all([
      employees(),journeys(start,end),
      key(today())<start||key(today())>end ? journeys(key(today()),key(today())) : Promise.resolve([]),
      profile(user.id)
    ]);
    if(seq!==loadSeq)return;
    if(!p?.ativo){user=null;role=null;S={emps:[],rec:{},versions:{},empVersions:{}};$('#csv').value='';$('#auditView').textContent='';$('#ovCfg').style.display='none';$('#ovDay').style.display='none';$('#main').hidden=true;$('#ovLogin').style.display='flex';$('#loginError').textContent='Conta sem perfil ativo.';setSync('Acesso indisponível',true);return}
    $('#csv').value='';$('#auditView').textContent='';
    role=p.perfil;$('#user').textContent=`${p.nome} · ${p.perfil}`;
    const rec={},versions={};
    for(const r of [...records,...todayRows]){
      (rec[r.funcionario_id]??={})[r.data]=r.situacao==='trabalho'?'T':'F';
      versions[`${r.funcionario_id}|${r.data}`]=r.atualizado_em;
    }
    S={emps:emps.map(e=>({...e,name:e.nome,sex:e.sexo,role:e.cargo})),rec,versions,
      empVersions:Object.fromEntries(emps.map(e=>[e.id,e.atualizado_em]))};
    render();if($('#ovCfg').style.display==='flex')cfg();
    if($('#ovDay').style.display==='flex')openDay($('#dB').dataset.d);
    setSync('Sincronizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
  }catch(error){if(seq===loadSeq){setSync('Falha de conexão',true);toast(explain(error))}}
}
async function mutate(action,onError){
  if(busy)return;
  busy=true;setSync('Salvando…');
  try{await action();await refresh();toast('Alteração salva no banco.',true)}
  catch(error){onError?.(error);toast(explain(error));await refresh()}
  finally{busy=false}
}
async function setSt(id,ds,v){
  if(role==='visualizacao')return;
  const e=S.emps.find(x=>x.id===id);if(!e)return;
  if(v==='T'&&st(id,fromKey(ds))!=='T'){
    const message=check(e,fromKey(ds));if(message){toast(message);return}
  }
  if(!v && st(id,fromKey(ds)) && !confirm(`Remover o lançamento de ${e.name} em ${ds}?`))return;
  await mutate(()=>saveJourney({p_funcionario:id,p_data:ds,p_situacao:v==='T'?'trabalho':v==='F'?'folga':null,
    p_versao:S.versions[`${id}|${ds}`]??null}));
}
function openDay(ds){
  if(!ds)return;
  const opening=$('#ovDay').style.display!=='flex';
  if(opening)modalReturnFocus=document.activeElement;
  const d=fromKey(ds);$('#dT').textContent=WD[d.getDay()]+', '+d.toLocaleDateString('pt-BR');
  $('#dB').innerHTML=S.emps.length?S.emps.map(e=>{
    const c=st(e.id,d),o=info(e,d),bl=c!=='T'?check(e,d):'',can=role!=='visualizacao'&&(e.ativo||c&&role==='administrador');
    return '<div class="dr"><div><b>'+esc(e.name)+'</b><span class="tag">'+(e.sex==='F'?'Mulher':'Homem')+'</span>'+(e.ativo?'':' · desativado')+(o.c!=='z'?'<small class="r" style="margin-left:0">'+o.t+'</small>':'')+'</div><div class="b"><button class="'+(c==='T'?'on':'')+'" data-s="T" data-e="'+e.id+'"'+(bl||!can?' disabled':'')+'>Trabalho</button> <button class="'+(c==='F'?'onf':'')+'" data-s="F" data-e="'+e.id+'"'+(!can?' disabled':'')+'>Folga</button> <button data-s="" data-e="'+e.id+'"'+(!can?' disabled':'')+'>Limpar</button></div>'+(bl?'<div class="bl">🚫 '+esc(bl.replace(/^Bloqueado: /,''))+'</div>':'')+'</div>';
  }).join(''):'<div class="empty">Nenhum funcionário cadastrado.</div>';
  $('#dB').dataset.d=ds;$('#ovDay').style.display='flex';
  if(opening)$('#dB button:not(:disabled)')?.focus();
}
function cfg(){
  $('#list').innerHTML=S.emps.length?S.emps.map(e=>'<div class="li '+(e.ativo?'':'inactive')+'"><span><b>'+esc(e.name)+'</b> · '+(e.sex==='F'?'Mulher':'Homem')+(e.role?' · '+esc(e.role):'')+(e.equipe?' · '+esc(e.equipe):'')+(e.ativo?'':' · desativado')+'</span>'+(role==='administrador'?'<button data-ed="'+e.id+'">Editar</button>':'')+'</div>').join(''):'<div class="empty">Nenhum funcionário.</div>';
  $('#fT').hidden=role!=='administrador';$('#bAdd').hidden=role!=='administrador';
  document.querySelectorAll('#ovCfg .g').forEach(el=>el.hidden=role!=='administrador');
  $('#adminTools').hidden=role!=='administrador';
  $('#bExp').disabled=role==='visualizacao';$('#bCp').disabled=role==='visualizacao';$('#bDownload').disabled=role==='visualizacao';
  try{
    legacy=uploadedLegacy||readLegacy();
    $('#migrationPreview').textContent=migrationReport|| (legacy
      ? `${legacy.origin}: ${legacy.emps.length} funcionário(s), ${legacy.journeys.length} lançamento(s). ${legacy.errors.length} erro(s). Confira se há dados de demonstração antes de migrar. ${legacy.errors.slice(0,5).join(' | ')}`
      : 'Nenhum dado local antigo encontrado.');
    $('#bBackup').disabled=!legacy;$('#bMigrate').disabled=!legacy||!!legacy.errors.length||!backupDone||backupRaw!==legacy.raw;
  }catch(error){legacy=null;$('#migrationPreview').textContent=explain(error);$('#bBackup').disabled=true;$('#bMigrate').disabled=true}
}
let backupDone=false,backupRaw=null;
function resetForm(){editId=null;for(const id of ['fN','fR','fM','fE'])$('#'+id).value='';$('#fS').value='M';$('#fA').value='true';$('#bAdd').textContent='Adicionar';$('#fT').textContent='Adicionar funcionário';$('#bCan').hidden=true}

$('#view').addEventListener('click',ev=>{
  const c=ev.target.closest('[data-e]'),dy=ev.target.closest('[data-day]');
  if(c){const current=st(c.dataset.e,fromKey(c.dataset.d));setSt(c.dataset.e,c.dataset.d,!current?'T':current==='T'?'F':'')}
  else if(dy)openDay(dy.dataset.day);
});
$('#view').addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-day],[data-e]')){ev.preventDefault();ev.target.click()}});
$('#dB').addEventListener('click',ev=>{const b=ev.target.closest('[data-s]');if(b&&!b.disabled)setSt(b.dataset.e,$('#dB').dataset.d,b.dataset.s)});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{$('#'+b.dataset.close).style.display='none';modalReturnFocus?.focus()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){for(const id of ['ovDay','ovCfg'])if($('#'+id).style.display==='flex'){$('#'+id).style.display='none';modalReturnFocus?.focus();break}}});
$('#tM').onclick=()=>{mode='m';refresh()};$('#tW').onclick=()=>{mode='w';refresh()};
$('#pv').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()-1,1):add(D,-7);refresh()};
$('#nx').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()+1,1):add(D,7);refresh()};
$('#td').onclick=()=>{D=today();refresh()};$('#bReload').onclick=refresh;
$('#bCfg').onclick=()=>{modalReturnFocus=document.activeElement;cfg();$('#ovCfg').style.display='flex';(role==='administrador'?$('#fN'):$('#ovCfg [data-close="ovCfg"]')).focus()};
$('#bCan').onclick=resetForm;
$('#list').addEventListener('click',ev=>{
  const b=ev.target.closest('[data-ed]');if(!b||role!=='administrador')return;
  const e=S.emps.find(x=>x.id===b.dataset.ed);if(!e)return;
  editId=e.id;$('#fN').value=e.nome;$('#fS').value=e.sexo;$('#fR').value=e.cargo||'';
  $('#fM').value=e.matricula||'';$('#fE').value=e.equipe||'';$('#fA').value=String(e.ativo);
  $('#bAdd').textContent='Salvar alterações';$('#fT').textContent='Editar funcionário';$('#bCan').hidden=false;$('#fN').focus();
});
$('#bAdd').onclick=async()=>{
  const name=$('#fN').value.trim(),active=$('#fA').value==='true';
  if(!name){toast('Informe o nome.');return}
  if(editId&&!active&&S.emps.find(e=>e.id===editId)?.ativo&&!confirm(`Desativar ${name}? O histórico será preservado.`))return;
  const payload={p_id:editId,p_nome:name,p_sexo:$('#fS').value,p_cargo:$('#fR').value.trim(),
    p_matricula:$('#fM').value.trim()||null,p_equipe:$('#fE').value.trim()||null,p_ativo:active,
    p_versao:editId?S.empVersions[editId]:null};
  await mutate(async()=>{await saveEmployee(payload);resetForm()});
};
async function prepareExport(){
  if(role==='visualizacao')return;
  const seq=loadSeq;
  setSync('Preparando CSV…');
  try{const rows=await allJourneys();if(!user||role==='visualizacao'||seq!==loadSeq)return;
    $('#csv').value=exportCSV(S.emps,rows);setSync('CSV preparado');toast('CSV preparado.',true)}
  catch(error){setSync('Falha na exportação',true);toast(explain(error))}
}
$('#bExp').onclick=prepareExport;
$('#bCp').onclick=async()=>{if(!$('#csv').value)await prepareExport();if(!$('#csv').value)return;
  try{await navigator.clipboard.writeText($('#csv').value);toast('Copiado.',true)}
  catch{const t=$('#csv');t.select();if(document.execCommand('copy'))toast('Copiado.',true);else toast('Não foi possível copiar. Use o botão Baixar CSV.')}
};
$('#bDownload').onclick=async()=>{
  if(!$('#csv').value)await prepareExport();if(!$('#csv').value)return;
  const url=URL.createObjectURL(new Blob([$('#csv').value],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='escalas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
$('#imp').addEventListener('input',()=>{preview=null;$('#bImp').disabled=true});
$('#bPreview').onclick=()=>{
  preview=parseCSV($('#imp').value);
  $('#importPreview').textContent=`${preview.rows.length} linha(s) válida(s); ${preview.errors.length} erro(s). ${preview.errors.slice(0,10).join(' | ')}`;
  $('#bImp').disabled=!preview.rows.length||!!preview.errors.length;
};
$('#bImp').onclick=async()=>{
  if(!preview||preview.errors.length||!preview.rows.length||role!=='administrador')return;
  if(!confirm(`Importar ${preview.rows.length} linha(s)? A operação será integral.`))return;
  await mutate(async()=>{
    const result=await importRows(preview.rows);
    $('#importPreview').textContent=`Importação concluída: ${result.linhas} linha(s), ${result.funcionarios_novos} funcionário(s) novo(s).`;
    $('#imp').value='';preview=null;$('#bImp').disabled=true;
  },error=>{$('#importPreview').textContent=`Lote rejeitado sem alterações: ${explain(error)}`});
};
$('#legacyFile').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  try{uploadedLegacy=parseLegacy(await file.text(),file.name.includes('escala_dsr_v1')?'escala_dsr_v1':'escala_dsr_v2');backupDone=false;backupRaw=null;migrationReport=null;cfg()}
  catch(error){uploadedLegacy=null;$('#migrationPreview').textContent=explain(error);$('#bMigrate').disabled=true}
});
$('#bBackup').onclick=()=>{if(legacy){backup(legacy);backupDone=true;backupRaw=legacy.raw;$('#bMigrate').disabled=!!legacy.errors.length;toast('Backup solicitado. Confira o arquivo baixado antes de migrar.',true)}};
$('#bMigrate').onclick=async()=>{
  if(!legacy||!backupDone||backupRaw!==legacy.raw||legacy.errors.length||role!=='administrador')return;
  if(!confirm(`Migrar ${legacy.emps.length} funcionário(s) e ${legacy.journeys.length} lançamento(s)? O armazenamento original será preservado.`))return;
  await mutate(async()=>{const result=await migrateLocal(legacy.origin,legacy.emps,legacy.journeys);
    migrationReport=`Migração concluída: ${result.funcionarios_novos} funcionário(s) e ${result.jornadas_novas} jornada(s) novos. Dados locais preservados.`;
    $('#migrationPreview').textContent=migrationReport;
  },error=>{migrationReport=`Lote rejeitado sem alterações: ${explain(error)}`;$('#migrationPreview').textContent=migrationReport});
};
$('#bAudit').onclick=async()=>{
  const seq=loadSeq;
  try{const rows=await all('auditoria','usuario_id,operacao,tabela,registro_id,criado_em,valores_anteriores,valores_novos',q=>q.order('criado_em',{ascending:false}).limit(100));
    if(!user||role!=='administrador'||seq!==loadSeq)return;
    $('#auditView').innerHTML=rows.slice(0,100).map(r=>`<details><summary>${esc(new Date(r.criado_em).toLocaleString('pt-BR'))} · ${esc(r.operacao)} ${esc(r.tabela)} · ${esc(r.registro_id)} · ${esc(r.usuario_id||'SQL administrativo')}</summary><pre>Antes: ${esc(JSON.stringify(r.valores_anteriores))}\nDepois: ${esc(JSON.stringify(r.valores_novos))}</pre></details>`).join('')||'Sem alterações.';
  }catch(error){toast(explain(error))}
};
async function showSession(){
  const {data:{user:current},error}=await db.auth.getUser();
  if(error||!current){user=null;role=null;loadSeq++;S={emps:[],rec:{},versions:{},empVersions:{}};$('#csv').value='';$('#auditView').textContent='';$('#ovCfg').style.display='none';$('#ovDay').style.display='none';$('#main').hidden=true;$('#ovLogin').style.display='flex';$('#bCfg').hidden=true;$('#bReload').hidden=true;$('#bOut').hidden=true;$('#user').textContent='';setSync('Aguardando login');return}
  try{
    const p=await profile(current.id);
    if(!p||!p.ativo)throw new Error('Conta sem perfil ativo. Solicite acesso ao administrador.');
    user=current;role=p.perfil;$('#user').textContent=`${p.nome} · ${p.perfil}`;
    $('#main').hidden=false;$('#ovLogin').style.display='none';$('#loginError').textContent='';
    $('#bCfg').hidden=false;$('#bReload').hidden=false;$('#bOut').hidden=false;
    await refresh();
  }catch(e){user=null;role=null;S={emps:[],rec:{},versions:{},empVersions:{}};$('#csv').value='';$('#auditView').textContent='';$('#ovCfg').style.display='none';$('#ovDay').style.display='none';$('#main').hidden=true;$('#ovLogin').style.display='flex';$('#loginError').textContent=explain(e);setSync('Acesso indisponível',true)}
}
$('#loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!configured)return;
  $('#bLogin').disabled=true;$('#loginError').textContent='Entrando…';
  const {error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  $('#password').value='';$('#bLogin').disabled=false;
  if(error)$('#loginError').textContent='Não foi possível entrar. Confira e-mail, senha e autorização.';
  else await showSession();
});
$('#bReset').onclick=async()=>{
  const email=$('#email').value.trim();if(!email){$('#loginError').textContent='Informe o e-mail para recuperar a senha.';return}
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:new URL('./index.html',location.href).href});
  $('#loginError').textContent=error?explain(error):'Se a conta existir, você receberá um e-mail com instruções.';
};
$('#passwordForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const {error}=await db.auth.updateUser({password:$('#newPassword').value});
  $('#passwordError').textContent=error?explain(error):'Senha atualizada.';
  if(!error){$('#newPassword').value='';$('#ovPassword').style.display='none';showSession()}
});
$('#bOut').onclick=async()=>{await db.auth.signOut();$('#ovCfg').style.display='none';$('#ovDay').style.display='none';showSession()};

  if(!configured){$('#loginError').textContent='Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY em js/config.js e verifique o carregamento do SDK.';setSync('Configuração pendente',true)}
else{
  db.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY')$('#ovPassword').style.display='flex';
    if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(showSession,0);
  });
  showSession();
  setInterval(()=>{if(user&&document.visibilityState==='visible')refresh()},60000);
  document.addEventListener('visibilitychange',()=>{if(user&&document.visibilityState==='visible')refresh()});
}
