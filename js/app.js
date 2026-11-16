import { db, configured, profile, employees, journeys, allJourneys, all, saveEmployee, saveJourney, importRows, migrateLocal } from './data.js';
import { parseCSV, exportCSV } from './csv.js';
import { readLegacy, parseLegacy, backup } from './migration.js';
import { validateWork, assessWork, workRestrictions, workWarnings, canonicalRole } from './rules.js';

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
const restrictionsOn=(e,d)=>st(e.id,d)?[]:workRestrictions(e,d,W);
const warningsOn=(e,d)=>workWarnings(e,d,W);
function pos(id,d){let b=0;while(W(id,add(d,-b-1)))b++;return b+1}
const check=(e,d)=>validateWork(e,d,W);
function toast(m,ok=false){const t=$('#toast');t.style.background=ok?'var(--ok)':'';t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',5200)}
function info(e,d){
  const c=st(e.id,d);
  if(c==='T'){
    const assessment=assessWork(e,d,W);
    if(assessment.restrictions.length)return{c:'bad',t:'Trabalho',detail:assessment.restrictions.map(r=>r.short).join(' · ')};
    if(assessment.warnings.length)return{c:'exception',t:'Trabalho',detail:assessment.warnings.map(r=>r.short).join(' · ')};
    return{c:'t',t:'Trabalho',detail:pos(e.id,d)+'º dia seguido'};
  }
  if(c==='F')return{c:'f',t:'Folga',detail:''};
  const blocked=restrictionsOn(e,d);
  if(blocked.length)return{c:'blocked',t:'Descanso necessário',detail:blocked.map(r=>r.short).join(' · ')};
  return{c:'z',t:'Sem lançamento',detail:''};
}
const visibleOn=d=>S.emps.filter(e=>e.ativo||st(e.id,d));
function dayGroup(label,list,css,limit){
  if(!list.length)return '';
  const chips=list.slice(0,limit).map(item=>{
    const e=item.employee||item,reason=(item.reasons||item.warnings)?.map(r=>r.short).join(' · ');
    return '<span class="person-chip'+(item.warnings?.length?' warning':'')+'" title="'+esc(e.name+(reason?' · '+reason:''))+'">'+esc(e.name)+(reason?'<em>'+esc(reason)+'</em>':'')+'</span>';
  }).join('');
  const remaining=list.length-limit;
  const extra=remaining>0?'<span class="more-count">+'+remaining+' '+(remaining===1?'pessoa':'pessoas')+'</span>':'';
  return '<div class="day-group '+css+'"><span class="group-label">'+label+' · '+list.length+'</span><div class="people">'+chips+extra+'</div></div>';
}
function render(){
  const t=today();let y=D.getFullYear(),m=D.getMonth(),from,to;
  if(mode==='m'){
    $('#ttl').textContent=MN[m]+' '+y;
    const f=new Date(y,m,1),nd=new Date(y,m+1,0).getDate(),wks=Math.ceil((f.getDay()+nd)/7);from=f;to=new Date(y,m,nd);
    let h='<div class="cal">'+WD.map(w=>'<div class="h">'+w+'</div>').join('');
    for(let i=0;i<wks*7;i++){
      const d=add(f,i-f.getDay());
      const emps=visibleOn(d),working=emps.filter(e=>st(e.id,d)==='T'),off=emps.filter(e=>st(e.id,d)==='F');
      const workEntries=working.map(e=>({employee:e,warnings:warningsOn(e,d)}));
      const blocked=emps.filter(e=>st(e.id,d)!=='T').map(e=>({employee:e,reasons:restrictionsOn(e,d)})).filter(x=>x.reasons.length);
      const warnings=workEntries.filter(x=>x.warnings.length).length;
      h+='<div class="d '+(d.getMonth()!==m?'o ':'')+(d.getDay()===0?'s ':'')+(+d===+t?'t':'')+'" data-day="'+key(d)+'" tabindex="0" role="button" aria-label="Abrir dia '+key(d)+': '+working.length+' trabalhando, '+off.length+' de folga, '+blocked.length+' com descanso necessário, '+warnings+' avisos de exceção"><div class="day-head"><span class="n">'+d.getDate()+'</span><span class="weekday">'+WD[d.getDay()]+'</span></div>'
        +(working.length||off.length||blocked.length?dayGroup('Trabalho',workEntries,'work',3)+dayGroup('Folga',off,'off',2)+dayGroup('Descanso necessário',blocked,'blocked',2):'<span class="day-empty">Sem lançamentos</span>')+'</div>';
    }
    $('#view').innerHTML=h+'</div>';
  }else{
    const s0=add(D,-D.getDay()),s6=add(s0,6);from=s0;to=s6;
    $('#ttl').textContent=s0.getDate()+' '+MN[s0.getMonth()].slice(0,3)+' a '+s6.getDate()+' '+MN[s6.getMonth()].slice(0,3)+' '+s6.getFullYear();
    const weekEmps=S.emps.filter(e=>e.ativo||Array.from({length:7},(_,i)=>st(e.id,add(s0,i))).some(Boolean));
    let h='<p class="week-hint">Deslize para ver os próximos dias →</p><div class="sc" role="region" aria-label="Escala semanal" tabindex="0"><table><tr><th class="nm">Funcionário</th>';
    for(let i=0;i<7;i++){
      const d=add(s0,i),count=weekEmps.filter(e=>W(e.id,d)).length;
      const off=weekEmps.filter(e=>st(e.id,d)==='F').length;
      const blocked=weekEmps.filter(e=>restrictionsOn(e,d).length>0).length;
      h+='<th class="'+(+d===+t?'today-col ':'')+(i===0?'sunday-col':'')+'">'+WD[i]+'<small>'+fd(d)+'</small><span class="th-count">'+count+' trabalha'+(count===1?'':'m')+'</span>'+(off?'<span class="th-off">'+off+' folga'+(off===1?'':'s')+'</span>':'')+(blocked?'<span class="th-blocked">'+blocked+' descanso'+(blocked===1?'':'s')+'</span>':'')+'</th>';
    }
    h+='</tr>';
    if(!weekEmps.length)h+='<tr><td class="empty" colspan="8">Nenhum funcionário neste período.</td></tr>';
    weekEmps.forEach(e=>{
      h+='<tr><td class="nm"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><span class="employee-name"><b>'+esc(e.name)+'</b><small>'+esc([e.role,e.ativo?'':'Desativado'].filter(Boolean).join(' · '))+'</small></span></td>';
      for(let i=0;i<7;i++){const d=add(s0,i),o=info(e,d);
        h+='<td class="c '+o.c+(+d===+t?' today-col':'')+'" data-e="'+e.id+'" data-d="'+key(d)+'" tabindex="0" role="button" aria-label="'+esc(e.name)+' em '+key(d)+': '+esc(o.t)+(o.detail?' · '+esc(o.detail):'')+'"><span class="cell-status">'+o.t+'</span>'+(o.detail?'<small class="cell-detail">'+esc(o.detail)+'</small>':'')+'</td>'}
      h+='</tr>';
    });
    $('#view').innerHTML=h+'</table></div>';
  }
  $('#tM').className=mode==='m'?'on':'';$('#tW').className=mode==='w'?'on':'';
  /* Somente irregularidades reais permanecem visíveis; a validação continua no banco. */
  const A=[];
  S.emps.forEach(e=>{for(let d=from;+d<=+to;d=add(d,1)){
    if(!W(e.id,d))continue;
    const issues=workRestrictions(e,d,W);
    if(issues.length)A.push('<b>'+esc(e.name)+'</b> em '+fd(d)+': '+esc(issues.map(r=>r.short).join(' · '))+'. Revise a escala.');
  }});
  $('#alerts').innerHTML=A.length?'<div class="d"><strong>Escalas para revisar</strong> · '+A.slice(0,5).join(' · ')+(A.length>5?' · +'+(A.length-5)+' outra(s)':'')+'</div>':'';
}

function bounds(){
  let first,last;
  if(mode==='m'){
    const f=new Date(D.getFullYear(),D.getMonth(),1), e=new Date(D.getFullYear(),D.getMonth()+1,0);
    first=add(f,-f.getDay());last=add(e,6-e.getDay());
  }else{first=add(D,-D.getDay());last=add(first,6)}
  return [key(add(first,-14)),key(add(last,14))];
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
    const [emps,records,p]=await Promise.all([employees(),journeys(start,end),profile(user.id)]);
    if(seq!==loadSeq)return;
    if(!p?.ativo){user=null;role=null;S={emps:[],rec:{},versions:{},empVersions:{}};$('#csv').value='';$('#auditView').textContent='';$('#ovCfg').style.display='none';$('#ovDay').style.display='none';$('#main').hidden=true;$('#ovLogin').style.display='flex';$('#loginError').textContent='Conta sem perfil ativo.';setSync('Acesso indisponível',true);return}
    $('#csv').value='';$('#auditView').textContent='';
    role=p.perfil;$('#user').textContent=`${p.nome} · ${p.perfil}`;
    const rec={},versions={};
    for(const r of records){
      (rec[r.funcionario_id]??={})[r.data]=r.situacao==='trabalho'?'T':'F';
      versions[`${r.funcionario_id}|${r.data}`]=r.atualizado_em;
    }
    S={emps:emps.map(e=>({...e,name:e.nome,sex:e.sexo,role:canonicalRole(e.cargo)})),rec,versions,
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
  const date=fromKey(ds);
  if(v==='F'&&(restrictionsOn(e,date).length||st(id,date)==='T'&&warningsOn(e,date).length)){
    toast('O aviso de descanso ou exceção já aparece na escala; não é necessário lançar Folga neste dia.');return;
  }
  if(v==='T'&&st(id,date)!=='T'){
    const message=check(e,date);if(message){toast(message);return}
  }
  if(!v && st(id,fromKey(ds)) && !confirm(`Remover o lançamento de ${e.name} em ${ds}?`))return;
  await mutate(()=>saveJourney({p_funcionario:id,p_data:ds,p_situacao:v==='T'?'trabalho':v==='F'?'folga':null,
    p_versao:S.versions[`${id}|${ds}`]??null}));
}
function renderDayRows(ds){
  if(!ds)return;
  const d=fromKey(ds),query=$('#dSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'),filter=$('#dFilter').value;
  const emps=visibleOn(d).filter(e=>{
    const name=e.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
    if(!name.includes(query))return false;
    const c=st(e.id,d);
    return filter==='all'||filter==='work'&&c==='T'||filter==='off'&&c==='F'||
      filter==='blocked'&&restrictionsOn(e,d).length>0||filter==='exception'&&c==='T'&&warningsOn(e,d).length>0||filter==='empty'&&!c&&!restrictionsOn(e,d).length;
  }).sort((a,b)=>{
    const rank=e=>st(e.id,d)==='T'?0:st(e.id,d)==='F'?1:2;
    return rank(a)-rank(b)||a.name.localeCompare(b.name,'pt-BR');
  });
  $('#dB').innerHTML=emps.length?emps.map(e=>{
    const c=st(e.id,d),o=info(e,d),reasons=restrictionsOn(e,d),warnings=c==='T'?warningsOn(e,d):[],bl=reasons[0]?.message||'',can=role!=='visualizacao'&&(e.ativo||c&&role==='administrador');
    const noOff=reasons.length>0||warnings.length>0;
    const meta=[e.role,e.equipe,e.ativo?'':'Desativado'].filter(Boolean).join(' · ');
    const restriction=reasons.length?'<small class="rule-note">Descanso necessário: '+esc(reasons.map(r=>r.short).join(' · '))+'</small>':'';
    const warning=warnings.length?'<small class="rule-warning">Aviso: '+esc(warnings.map(r=>r.short).join(' · '))+'</small>':'';
    return '<div class="dr"><div class="person"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><span><b>'+esc(e.name)+'</b><small>'+esc(meta)+'</small>'+restriction+warning+'</span></div><span class="status-pill '+o.c+'">'+o.t+'</span><div class="b"><button class="'+(c==='T'?'on':'')+'" data-s="T" data-e="'+e.id+'"'+(bl?' title="'+esc(bl)+'"':'')+(bl||!can?' disabled':'')+'>Trabalho</button><button class="'+(c==='F'?'onf':'')+'" data-s="F" data-e="'+e.id+'"'+(noOff?' title="Aviso já exibido na escala; Folga indisponível neste dia"':'')+(!can||noOff?' disabled':'')+'>Folga</button><button class="clear" data-s="" data-e="'+e.id+'"'+(!c||!can?' disabled':'')+'>Remover</button></div></div>';
  }).join(''):'<div class="empty">Nenhum funcionário encontrado para este filtro.</div>';
}
function openDay(ds,selectedId){
  if(!ds)return;
  const opening=$('#ovDay').style.display!=='flex',newDay=$('#dB').dataset.d!==ds;
  if(opening)modalReturnFocus=document.activeElement;
  if(newDay){$('#dSearch').value='';$('#dFilter').value='all'}
  const d=fromKey(ds),emps=visibleOn(d);
  $('#dT').textContent=WD[d.getDay()]+', '+d.toLocaleDateString('pt-BR');
  const working=emps.filter(e=>st(e.id,d)==='T').length,off=emps.filter(e=>st(e.id,d)==='F').length,blocked=emps.filter(e=>restrictionsOn(e,d).length).length;
  const warnings=emps.filter(e=>st(e.id,d)==='T'&&warningsOn(e,d).length).length;
  $('#dSummary').innerHTML='<span class="summary-work">'+working+' trabalhando</span><span class="summary-off">'+off+' de folga</span><span>'+ (emps.length-working-off-blocked)+' sem lançamento</span>'+(blocked?'<span class="summary-blocked">'+blocked+' descanso'+(blocked===1?'':'s')+' necessário'+(blocked===1?'':'s')+'</span>':'')+(warnings?'<span class="summary-warning">'+warnings+' aviso'+(warnings===1?'':'s')+' de exceção</span>':'');
  $('#dB').dataset.d=ds;renderDayRows(ds);$('#ovDay').style.display='flex';
  if(opening){const selected=selectedId?$('#dB [data-e="'+selectedId+'"][data-s="T"]:not(:disabled)')||$('#dB [data-e="'+selectedId+'"][data-s="F"]:not(:disabled)'):null;(selected||$('#dSearch')).focus()}
}
function cfg(){
  populateRoleOptions();
  $('#list').innerHTML=S.emps.length?S.emps.map(e=>'<div class="li '+(e.ativo?'':'inactive')+'"><span><b>'+esc(e.name)+'</b> · '+(e.sex==='F'?'Mulher':'Homem')+(e.role?' · '+esc(e.role):'')+(e.equipe?' · '+esc(e.equipe):'')+(e.ativo?'':' · desativado')+'</span>'+(role==='administrador'?'<button data-ed="'+e.id+'">Editar</button>':'')+'</div>').join(''):'<div class="empty">Nenhum funcionário.</div>';
  $('#fT').hidden=role!=='administrador';$('#bAdd').hidden=role!=='administrador';
  document.querySelectorAll('#ovCfg .g').forEach(el=>el.hidden=role!=='administrador');
  updateOtherRoleVisibility();
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
const defaultRoles=['Despachante','Supervisor','Coordenador','Analista'];
function populateRoleOptions(){
  const select=$('#fR'),current=select.value;
  const extra=[...new Set(S.emps.map(e=>e.role).filter(Boolean))]
    .filter(name=>!defaultRoles.some(base=>base.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));
  select.replaceChildren(new Option('Selecione',''),...defaultRoles.map(name=>new Option(name,name)),
    ...extra.map(name=>new Option(name,name)),new Option('+ Adicionar outro cargo','__other__'));
  select.value=current;
}
function updateOtherRoleVisibility(){
  $('#otherRoleWrap').hidden=role!=='administrador'||$('#fR').value!=='__other__';
}
function selectRole(value){
  populateRoleOptions();
  if([...$('#fR').options].some(option=>option.value===value))$('#fR').value=value;
  else{$('#fR').value='__other__';$('#fROther').value=value}
  updateOtherRoleVisibility();
}
function resetForm(){editId=null;for(const id of ['fN','fM','fE','fROther'])$('#'+id).value='';$('#fR').value='';$('#fS').value='M';$('#fA').value='true';$('#bAdd').textContent='Adicionar';$('#fT').textContent='Adicionar funcionário';$('#bCan').hidden=true;updateOtherRoleVisibility()}

$('#view').addEventListener('click',ev=>{
  const c=ev.target.closest('[data-e]'),dy=ev.target.closest('[data-day]');
  if(c)openDay(c.dataset.d,c.dataset.e);
  else if(dy)openDay(dy.dataset.day);
});
$('#view').addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-day],[data-e]')){ev.preventDefault();ev.target.click()}});
$('#dB').addEventListener('click',ev=>{const b=ev.target.closest('[data-s]');if(b&&!b.disabled)setSt(b.dataset.e,$('#dB').dataset.d,b.dataset.s)});
$('#dSearch').addEventListener('input',()=>renderDayRows($('#dB').dataset.d));
$('#dFilter').addEventListener('change',()=>renderDayRows($('#dB').dataset.d));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{$('#'+b.dataset.close).style.display='none';modalReturnFocus?.focus()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){for(const id of ['ovDay','ovCfg'])if($('#'+id).style.display==='flex'){$('#'+id).style.display='none';modalReturnFocus?.focus();break}}});
$('#tM').onclick=()=>{mode='m';refresh()};$('#tW').onclick=()=>{mode='w';refresh()};
$('#pv').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()-1,1):add(D,-7);refresh()};
$('#nx').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()+1,1):add(D,7);refresh()};
$('#td').onclick=()=>{D=today();refresh()};$('#bReload').onclick=refresh;
$('#bCfg').onclick=()=>{modalReturnFocus=document.activeElement;cfg();$('#ovCfg').style.display='flex';(role==='administrador'?$('#fN'):$('#ovCfg [data-close="ovCfg"]')).focus()};
$('#bCan').onclick=resetForm;
$('#fR').addEventListener('change',()=>{updateOtherRoleVisibility();if(!$('#otherRoleWrap').hidden)$('#fROther').focus()});
$('#list').addEventListener('click',ev=>{
  const b=ev.target.closest('[data-ed]');if(!b||role!=='administrador')return;
  const e=S.emps.find(x=>x.id===b.dataset.ed);if(!e)return;
  editId=e.id;$('#fN').value=e.nome;$('#fS').value=e.sexo;selectRole(canonicalRole(e.cargo));
  $('#fM').value=e.matricula||'';$('#fE').value=e.equipe||'';$('#fA').value=String(e.ativo);
  $('#bAdd').textContent='Salvar alterações';$('#fT').textContent='Editar funcionário';$('#bCan').hidden=false;$('#fN').focus();
});
$('#bAdd').onclick=async()=>{
  const name=$('#fN').value.trim(),active=$('#fA').value==='true';
  if(!name){toast('Informe o nome.');return}
  const cargo=canonicalRole($('#fR').value==='__other__'?$('#fROther').value:$('#fR').value);
  if($('#fR').value==='__other__'&&!cargo){toast('Informe o novo cargo.');return}
  if(cargo.length>40){toast('O cargo deve ter até 40 caracteres.');return}
  if(editId&&!active&&S.emps.find(e=>e.id===editId)?.ativo&&!confirm(`Desativar ${name}? O histórico será preservado.`))return;
  const payload={p_id:editId,p_nome:name,p_sexo:$('#fS').value,p_cargo:cargo,
    p_matricula:$('#fM').value.trim()||null,p_equipe:$('#fE').value.trim()||null,p_ativo:active,
    p_versao:editId?S.empVersions[editId]:null};
  await mutate(async()=>{await saveEmployee(payload);resetForm()});
};
async function prepareExport(){
  if(role==='visualizacao')return;
  const seq=loadSeq;
  setSync('Preparando CSV…');
  try{const rows=await allJourneys();if(!user||role==='visualizacao'||seq!==loadSeq)return;
    $('#csv').value=exportCSV(S.emps.map(e=>({...e,cargo:e.role})),rows);setSync('CSV preparado');toast('CSV preparado.',true)}
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
    const result=await importRows(preview.rows.map(row=>({...row,cargo:canonicalRole(row.cargo)})));
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
  await mutate(async()=>{const result=await migrateLocal(legacy.origin,legacy.emps.map(e=>({...e,cargo:canonicalRole(e.cargo)})),legacy.journeys);
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
