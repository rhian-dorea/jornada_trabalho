import { db, configured, profile, employees, journeys, saveEmployee, saveJourney, companySettings } from './data.js';
import { validateWork, assessWork, workRestrictions, workWarnings, canonicalRole } from './rules.js';
import { defaults, normalizeSettings, coverageGap } from './settings.js';
import { dayPeople, showCoverageAlert } from './calendar-state.js';
import { summarizeEmployeeMonth } from './monthly-summary.js';

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const add = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const fromKey = k => { const p=k.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); };
const today = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
const MN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=d=>pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+String(d.getFullYear()).slice(-2);
let S={emps:[],rec:{},versions:{},empVersions:{},settings:normalizeSettings()};
const legacyBrandColors=new Set(['#2457a7','#146e67']);
let user=null, role=null, mode='m', page='schedule', D=today(), busy=false, loadSeq=0, editId=null, modalReturnFocus=null;
const st=(id,d)=>(S.rec[id]||{})[key(d)]||'';
const W=(id,d)=>st(id,d)==='T';
const restrictionsOn=(e,d)=>st(e.id,d)?[]:workRestrictions(e,d,W,S.settings.regras);
const warningsOn=(e,d)=>workWarnings(e,d,W,S.settings.regras);
const check=(e,d)=>validateWork(e,d,W,S.settings.regras);
function toast(m,ok=false){const t=$('#toast');t.style.background=ok?'var(--ok)':'';t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',5200)}
function applyBrand(){
  const s=S.settings;
  document.documentElement.dataset.theme=s.tema;
  const color=legacyBrandColors.has(s.cor_primaria?.toLowerCase()) ? defaults.cor_primaria :
    /^#[0-9a-f]{6}$/i.test(s.cor_primaria)?s.cor_primaria:defaults.cor_primaria;
  document.documentElement.style.setProperty('--brand',color);
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  document.documentElement.style.setProperty('--brand-text',rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111827':'#ffffff');
  $('#brandName').textContent=s.nome||defaults.nome;
  $('#brandLogo').src=s.logo_url&&/^https:\/\//i.test(s.logo_url)?s.logo_url:'./assets/mark.svg';
}
function showPage(nextPage){
  if(!user)return;
  page=nextPage;
  for(const [name,id,button] of [['schedule','schedulePage','bSchedule'],['employees','employeesPage','bEmployees']]){
    $('#'+id).hidden=name!==page;
    $('#'+button).classList.toggle('active',name===page);
    if(name===page)$('#'+button).setAttribute('aria-current','page');else $('#'+button).removeAttribute('aria-current');
  }
  if(page==='employees')cfg();
  window.scrollTo({top:0,behavior:'instant'});
}
function info(e,d){
  const c=st(e.id,d);
  if(c==='T'){
    const assessment=assessWork(e,d,W,S.settings.regras);
    if(assessment.restrictions.length)return{c:'bad',t:'⛔ Descanso obrigatório',detail:assessment.restrictions.map(r=>r.short).join(' · ')};
    if(assessment.warnings.length)return{c:'exception',t:'⚠ Aviso',detail:assessment.warnings.map(r=>r.short).join(' · ')};
    return{c:'t',t:'● Trabalho',detail:''};
  }
  if(c==='F')return{c:'f',t:'✓ Folga',detail:''};
  const blocked=restrictionsOn(e,d);
  if(blocked.length)return{c:'blocked',t:'⛔ Descanso obrigatório',detail:blocked.map(r=>r.short).join(' · ')};
  return{c:'z',t:'—',detail:''};
}
const visibleOn=d=>S.emps.filter(e=>e.ativo||st(e.id,d));
const teamColors=['#173b69','#2d5c91','#426e8c','#58628c','#3c7182'];
function colorFor(e){
  let hash=0;for(const ch of String(e.equipe||e.role))hash=(hash*31+ch.charCodeAt(0))>>>0;
  return teamColors[hash%teamColors.length];
}
const shortReason=reason=>reason.kind==='dias'?`⚠ ${reason.short.match(/\d+/)?.[0]} dias`:`⚠ ${reason.short.match(/\d+/)?.[0]} dom.`;
function dayGroup(label,list,css){
  if(!list.length)return '';
  const chips=list.map(item=>{
    const e=item.employee||item,reason=(item.reasons||item.warnings)?.map(r=>r.short).join(' · '),short=(item.reasons||item.warnings)?.map(shortReason).join(' ');
    return '<span class="person-chip'+(item.warnings?.length?' warning':'')+'" style="--team-color:'+colorFor(e)+'" title="'+esc(e.name+(reason?' · '+reason:''))+'" aria-label="'+esc(e.name+(reason?' · '+reason:''))+'">'+esc(e.name)+(short?'<em>'+esc(short)+'</em>':'')+'</span>';
  }).join('');
  return '<div class="day-group '+css+'"><span class="group-label">'+label+' · '+list.length+'</span><div class="people">'+chips+'</div></div>';
}
function renderMonthSummary(){
  const y=D.getFullYear(),m=D.getMonth(),days=new Date(y,m+1,0).getDate();
  const dates=Array.from({length:days},(_,i)=>new Date(y,m,i+1));
  const entries=S.emps.filter(e=>e.ativo||dates.some(d=>st(e.id,d))).map(e=>({employee:e,summary:summarizeEmployeeMonth(e,dates,st,restrictionsOn)})).filter(({summary:s})=>s.worked+s.notWorked>0);
  const title='<div class="month-summary-head"><div><span class="eyebrow">Por funcionário</span><h3>Resumo de '+MN[m].toLocaleLowerCase('pt-BR')+' de '+y+'</h3></div><span class="month-summary-count">'+entries.length+' pessoa'+(entries.length===1?'':'s')+'</span></div>';
  const note='<p class="month-summary-note">Não trabalhou = Folgas + descansos por dias seguidos + descansos por domingos.</p>';
  const rows=entries.map(({employee:e,summary:s})=>{
    return '<tr><th scope="row"><span class="summary-name">'+esc(e.name)+'</span><small>'+esc([e.role,e.equipe].filter(Boolean).join(' · '))+'</small></th><td class="summary-worked">'+s.worked+'</td><td class="summary-not-worked">'+s.notWorked+'</td><td><span class="summary-value off">'+s.off+'</span></td><td><span class="summary-value rest">'+s.restDays+'</span></td><td><span class="summary-value sunday">'+s.restSundays+'</span></td></tr>';
  }).join('');
  $('#monthSummary').innerHTML=title+note+(entries.length?'<div class="month-summary-scroll" role="region" aria-label="Totais mensais por funcionário" tabindex="0"><table><thead><tr><th scope="col">Funcionário</th><th scope="col">Trabalhou</th><th scope="col">Não trabalhou</th><th scope="col">Folga</th><th scope="col">Descanso após<br>7 dias seguidos</th><th scope="col">Descanso após<br>2 domingos seguidos</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="month-summary-empty">Nenhum funcionário com trabalho, folga ou descanso neste mês.</p>');
}
function render(){
  const t=today();let y=D.getFullYear(),m=D.getMonth(),from,to;
  renderMonthSummary();
  if(!S.emps.length){
    $('#ttl').textContent=MN[m]+' '+y;
    $('#view').innerHTML='<div class="empty-state"><strong>Equipe ainda não cadastrada</strong><p>Abra Funcionários para adicionar a primeira pessoa à escala.</p></div>';
    $('#alerts').innerHTML='';return;
  }
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
      const cover=coverageGap(d,S.emps,W,S.settings);
      const holiday=S.settings.feriados.find(x=>x.data===key(d));
      h+='<div class="d '+(d.getMonth()!==m?'o ':'')+(d.getDay()===0?'s ':'')+(+d===+t?'t':'')+'" data-day="'+key(d)+'" tabindex="0" role="button" aria-label="Abrir dia '+key(d)+': '+working.length+' trabalhando, '+off.length+' de folga, '+blocked.length+' com descanso necessário, '+warnings+' avisos de exceção"><div class="day-head"><span class="n">'+d.getDate()+'</span><span class="weekday">'+WD[d.getDay()]+'</span></div>'
        +(showCoverageAlert(working.length,cover.missing)?'<span class="coverage-alert" title="Cobertura mínima: '+cover.minimum+' · Trabalhando: '+cover.count+'">⛔ Faltam '+cover.missing+'</span>':'')
        +(holiday?'<span class="holiday" title="'+esc(holiday.nome)+'">✦ '+esc(holiday.nome)+'</span>':'')
        +(working.length||off.length||blocked.length?dayGroup('● Trabalho',workEntries,'work')+dayGroup('✓ Folga',off,'off')+dayGroup('⛔ Descanso',blocked,'blocked'):'<span class="day-empty">—</span>')+'</div>';
    }
    $('#view').innerHTML=h+'</div>';
  }else{
    const s0=add(D,-D.getDay()),s6=add(s0,6);from=s0;to=s6;
    $('#ttl').textContent=s0.getDate()+' '+MN[s0.getMonth()].slice(0,3)+' a '+s6.getDate()+' '+MN[s6.getMonth()].slice(0,3)+' '+s6.getFullYear();
    const weekEmps=S.emps.filter(e=>e.ativo||Array.from({length:7},(_,i)=>st(e.id,add(s0,i))).some(Boolean));
    let h='<p class="week-hint">Deslize para ver os próximos dias →</p><div class="sc" role="region" aria-label="Escala semanal" tabindex="0"><table><thead><tr><th class="nm" scope="col">Funcionário</th>';
    for(let i=0;i<7;i++){
      const d=add(s0,i),count=weekEmps.filter(e=>W(e.id,d)).length;
      const cover=coverageGap(d,S.emps,W,S.settings);
      h+='<th scope="col" class="'+(+d===+t?'today-col ':'')+(i===0?'sunday-col':'')+'">'+WD[i]+'<small>'+fd(d)+'</small><span class="th-count">'+(count?count+' trabalha'+(count===1?'':'m'):'—')+'</span>'+(showCoverageAlert(count,cover.missing)?'<span class="th-blocked">⛔ Faltam '+cover.missing+'</span>':'')+'</th>';
    }
    h+='</tr></thead><tbody>';
    if(!weekEmps.length)h+='<tr><td class="empty" colspan="8">Nenhum funcionário corresponde aos filtros desta semana.</td></tr>';
    weekEmps.forEach(e=>{
      h+='<tr><th scope="row" class="nm employee-row-header"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><span class="employee-name"><b>'+esc(e.name)+'</b><small>'+esc([e.role,e.ativo?'':'Desativado'].filter(Boolean).join(' · '))+'</small></span></th>';
      for(let i=0;i<7;i++){const d=add(s0,i),o=info(e,d);
        h+='<td class="c '+o.c+(+d===+t?' today-col':'')+'" style="--team-color:'+colorFor(e)+'" data-e="'+e.id+'" data-d="'+key(d)+'" tabindex="0" role="button" title="'+esc(o.detail||o.t)+'" aria-label="'+esc(e.name)+' em '+key(d)+': '+esc(o.t)+(o.detail?' · '+esc(o.detail):'')+'"><span class="cell-status">'+o.t+'</span>'+(o.detail?'<small class="cell-detail">'+esc(o.detail.split(' · ').map(x=>x.includes('domingo')?'⚠ '+(x.match(/\d+/)?.[0]||'2')+' dom.':'⚠ '+(x.match(/\d+/)?.[0]||'7')+' dias').join(' '))+'</small>':'')+'</td>'}
      h+='</tr>';
    });
    h+='</tbody></table></div><div class="week-mobile">';
    for(let i=0;i<7;i++){const d=add(s0,i),cover=coverageGap(d,S.emps,W,S.settings);
      const visibleWorking=weekEmps.filter(e=>W(e.id,d)).length;
      h+='<section class="mobile-day"><h3>'+WD[i]+' · '+fd(d)+(showCoverageAlert(visibleWorking,cover.missing)?' <span class="coverage-alert">⛔ Faltam '+cover.missing+'</span>':'')+'</h3>'+
        (weekEmps.length?weekEmps.map(e=>{const o=info(e,d);return '<button class="mobile-row" data-e="'+e.id+'" data-d="'+key(d)+'"><span>'+esc(e.name)+'</span><span class="status-pill '+o.c+'">'+esc(o.t)+'</span>'+(o.detail?'<small>'+esc(o.detail)+'</small>':'')+'</button>'}).join(''):'<p class="empty">Nenhum funcionário encontrado.</p>')+'</section>';
    }
    $('#view').innerHTML=h+'</div>';
  }
  $('#tM').className=mode==='m'?'on':'';$('#tW').className=mode==='w'?'on':'';
  $('#tM').setAttribute('aria-pressed',String(mode==='m'));$('#tW').setAttribute('aria-pressed',String(mode==='w'));
  /* Somente irregularidades reais permanecem visíveis; a validação continua no banco. */
  const A=[];
  S.emps.forEach(e=>{for(let d=from;+d<=+to;d=add(d,1)){
    if(!W(e.id,d))continue;
    const issues=assessWork(e,d,W,S.settings.regras);
    if(issues.restrictions.length)A.push('<b>'+esc(e.name)+'</b> em '+fd(d)+': ⛔ '+esc(issues.restrictions.map(r=>r.short).join(' · '))+'. Revise a escala.');
    else if(issues.warnings.length)A.push('<b>'+esc(e.name)+'</b> em '+fd(d)+': ⚠ '+esc(issues.warnings.map(r=>r.short).join(' · '))+'.');
  }});
  $('#alerts').innerHTML=A.length?'<div class="d"><strong>Escalas para revisar</strong> · '+A.slice(0,5).join(' · ')+(A.length>5?' · +'+(A.length-5)+' outra(s)':'')+'</div>':'';
}

function bounds(){
  let first,last;
  if(mode==='m'){
    const f=new Date(D.getFullYear(),D.getMonth(),1), e=new Date(D.getFullYear(),D.getMonth()+1,0);
    first=add(f,-f.getDay());last=add(e,6-e.getDay());
  }else{
    const weekStart=add(D,-D.getDay()),weekEnd=add(weekStart,6);
    const monthStart=new Date(D.getFullYear(),D.getMonth(),1),monthEnd=new Date(D.getFullYear(),D.getMonth()+1,0);
    first=weekStart<monthStart?weekStart:monthStart;
    last=weekEnd>monthEnd?weekEnd:monthEnd;
  }
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
  if(!S.emps.length)$('#view').innerHTML='<div class="loading-state" aria-label="Carregando escala"><span></span><span></span><span></span></div>';
  try{
    const todayKey=key(today());
    const [emps,periodRecords,p,settings,todayRecords]=await Promise.all([employees(),journeys(start,end),profile(user.id),companySettings().catch(error=>{
      if(['42P01','PGRST116','PGRST205'].includes(error.code))return null;
      throw error;
    }),todayKey>=start&&todayKey<=end?Promise.resolve([]):journeys(todayKey,todayKey)]);
    const records=periodRecords.concat(todayRecords);
    if(seq!==loadSeq)return;
    if(!p?.ativo){user=null;role=null;S={emps:[],rec:{},versions:{},empVersions:{}};$('#ovDay').style.display='none';$('#main').hidden=true;$('#mainNav').hidden=true;$('#ovLogin').style.display='flex';$('#loginError').textContent='Conta sem perfil ativo.';setSync('Acesso indisponível',true);return}
    role=p.perfil;$('#user').textContent=`${p.nome} · ${p.perfil==='visualizacao'||p.perfil==='funcionario'?'funcionário':p.perfil}`;
    const rec={},versions={};
    for(const r of records){
      (rec[r.funcionario_id]??={})[r.data]=r.situacao==='trabalho'?'T':'F';
      versions[`${r.funcionario_id}|${r.data}`]=r.atualizado_em;
    }
    S={emps:emps.map(e=>({...e,name:e.nome,sex:e.sexo,role:canonicalRole(e.cargo)})),rec,versions,settings:normalizeSettings(settings||{}),
      empVersions:Object.fromEntries(emps.map(e=>[e.id,e.atualizado_em]))};
    applyBrand();
    render();if(page==='employees')cfg();
    if($('#ovDay').style.display==='flex')openDay($('#dB').dataset.d,$('#dB').dataset.employee||undefined);
    setSync('Sincronizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
  }catch(error){if(seq===loadSeq){setSync('Falha de conexão',true);toast(explain(error));if(!S.emps.length)$('#view').innerHTML='<div class="empty-state" role="alert"><strong>Não foi possível carregar a escala</strong><p>'+esc(explain(error))+'</p><button id="retryLoad">Tentar novamente</button></div>'}}
}
async function mutate(action,onError){
  if(busy)return;
  busy=true;setSync('Salvando…');
  try{await action();await refresh();toast('Alteração salva no banco.',true)}
  catch(error){onError?.(error);toast(explain(error));await refresh()}
  finally{busy=false}
}
async function setSt(id,ds,v){
  if(role!=='gestor'&&role!=='administrador')return;
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
  const d=fromKey(ds),query=$('#dSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'),filter=$('#dFilter').value,selectedId=$('#dB').dataset.employee;
  const emps=dayPeople(visibleOn(d),selectedId).filter(e=>{
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
    const c=st(e.id,d),o=info(e,d),reasons=restrictionsOn(e,d),warnings=c==='T'?warningsOn(e,d):[],bl=reasons[0]?.message||'',can=(role==='gestor'||role==='administrador')&&(e.ativo||c&&role==='administrador');
    const noOff=reasons.length>0||warnings.length>0;
    const meta=[e.role,e.equipe,e.ativo?'':'Desativado'].filter(Boolean).join(' · ');
    const restriction=reasons.length?'<small class="rule-note">⛔ Descanso obrigatório: '+esc(reasons.map(r=>r.message).join(' · '))+'</small>':'';
    const warning=warnings.length?'<small class="rule-warning">⚠ Aviso: '+esc(warnings.map(r=>r.message).join(' · '))+'</small>':'';
    return '<div class="dr"><div class="person"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><span><b>'+esc(e.name)+'</b><small>'+esc(meta)+'</small>'+restriction+warning+'</span></div><span class="status-pill '+o.c+'">'+o.t+'</span><div class="b"><button class="'+(c==='T'?'on':'')+'" data-s="T" data-e="'+e.id+'"'+(bl?' title="'+esc(bl)+'"':'')+(bl||!can?' disabled':'')+'>Trabalho</button><button class="'+(c==='F'?'onf':'')+'" data-s="F" data-e="'+e.id+'"'+(noOff?' title="Aviso já exibido na escala; Folga indisponível neste dia"':'')+(!can||noOff?' disabled':'')+'>Folga</button><button class="clear" data-s="" data-e="'+e.id+'"'+(!c||!can?' disabled':'')+'>Remover</button></div></div>';
  }).join(''):'<div class="empty">Nenhum funcionário encontrado para este filtro.</div>';
}
function openDay(ds,selectedId){
  if(!ds)return;
  const opening=$('#ovDay').style.display!=='flex',newDay=$('#dB').dataset.d!==ds||$('#dB').dataset.employee!==(selectedId||'');
  if(opening)modalReturnFocus=document.activeElement;
  if(newDay){$('#dSearch').value='';$('#dFilter').value='all'}
  const d=fromKey(ds),emps=dayPeople(visibleOn(d),selectedId),selectedEmployee=emps[0];
  $('#ovDay').classList.toggle('single-employee',Boolean(selectedId));
  $('#dT').textContent=(selectedId&&selectedEmployee?selectedEmployee.name+' · ':'')+WD[d.getDay()]+', '+fd(d);
  const working=emps.filter(e=>st(e.id,d)==='T').length,off=emps.filter(e=>st(e.id,d)==='F').length,blocked=emps.filter(e=>restrictionsOn(e,d).length).length;
  const warnings=emps.filter(e=>st(e.id,d)==='T'&&warningsOn(e,d).length).length;
  $('#dSummary').innerHTML='<span class="summary-work">'+working+' trabalhando</span><span class="summary-off">'+off+' de folga</span><span>'+ (emps.length-working-off-blocked)+' sem lançamento</span>'+(blocked?'<span class="summary-blocked">'+blocked+' descanso'+(blocked===1?'':'s')+' necessário'+(blocked===1?'':'s')+'</span>':'')+(warnings?'<span class="summary-warning">'+warnings+' aviso'+(warnings===1?'':'s')+' de exceção</span>':'');
  $('#dB').dataset.d=ds;$('#dB').dataset.employee=selectedId||'';renderDayRows(ds);$('#ovDay').style.display='flex';
  if(opening){const selected=selectedId?$('#dB [data-e="'+selectedId+'"][data-s="T"]:not(:disabled)')||$('#dB [data-e="'+selectedId+'"][data-s="F"]:not(:disabled)'):null;(selected||$('#dSearch')).focus()}
}
function renderEmployees(){
  const query=$('#empSearch').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const status=$('#empStatus').value;
  const visible=S.emps.filter(e=>(status==='all'||status==='active'&&e.ativo||status==='inactive'&&!e.ativo)&&
    (!query||[e.name,e.role,e.equipe,e.matricula].some(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(query))));
  $('#employeeCount').textContent=visible.length+' de '+S.emps.length+' funcionário'+(S.emps.length===1?'':'s');
  $('#list').innerHTML=visible.length?visible.map(e=>'<div class="employee-item'+(e.ativo?'':' inactive')+'"><span class="av '+e.sex+'">'+esc(e.name.charAt(0).toUpperCase())+'</span><div class="employee-item-info"><b>'+esc(e.name)+'</b><small>'+esc([e.role,e.equipe].filter(Boolean).join(' · ')||'Sem cargo ou equipe')+'</small></div><span class="employee-state '+(e.ativo?'active':'')+'">'+(e.ativo?'Ativo':'Desativado')+'</span>'+(role==='administrador'?'<button data-ed="'+e.id+'">Editar</button>':'')+'</div>').join(''):'<div class="empty">Nenhum funcionário encontrado.</div>';
}
function cfg(){
  populateRoleOptions();
  renderEmployees();
  $('#employeeFormPanel').hidden=role!=='administrador';
  $('#bNewEmployee').hidden=role!=='administrador';
  updateOtherRoleVisibility();
}
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
  if(ev.target.id==='retryLoad'){refresh();return}
  const c=ev.target.closest('[data-e]'),dy=ev.target.closest('[data-day]');
  if(c)openDay(c.dataset.d,c.dataset.e);
  else if(dy)openDay(dy.dataset.day);
});
$('#view').addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-day],[data-e]')){ev.preventDefault();ev.target.click()}});
$('#dB').addEventListener('click',ev=>{const b=ev.target.closest('[data-s]');if(b&&!b.disabled)setSt(b.dataset.e,$('#dB').dataset.d,b.dataset.s)});
$('#dSearch').addEventListener('input',()=>renderDayRows($('#dB').dataset.d));
$('#dFilter').addEventListener('change',()=>renderDayRows($('#dB').dataset.d));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{$('#'+b.dataset.close).style.display='none';modalReturnFocus?.focus()});
document.addEventListener('keydown',ev=>{
  if($('#ovDay').style.display!=='flex')return;
  if(ev.key==='Escape'){$('#ovDay').style.display='none';modalReturnFocus?.focus();return}
  if(ev.key!=='Tab')return;
  const items=[...$('#ovDay').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(x=>x.offsetParent!==null);
  if(!items.length)return;
  if(ev.shiftKey&&document.activeElement===items[0]){ev.preventDefault();items.at(-1).focus()}
  else if(!ev.shiftKey&&document.activeElement===items.at(-1)){ev.preventDefault();items[0].focus()}
});
$('#bSchedule').onclick=()=>showPage('schedule');$('#bEmployees').onclick=()=>showPage('employees');
$('#bNewEmployee').onclick=()=>{resetForm();$('#employeeFormPanel').scrollIntoView({behavior:'smooth',block:'start'});$('#fN').focus({preventScroll:true})};
$('#empSearch').addEventListener('input',renderEmployees);$('#empStatus').addEventListener('change',renderEmployees);
$('#tM').onclick=()=>{mode='m';refresh()};$('#tW').onclick=()=>{mode='w';refresh()};
$('#pv').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()-1,1):add(D,-7);refresh()};
$('#nx').onclick=()=>{D=mode==='m'?new Date(D.getFullYear(),D.getMonth()+1,1):add(D,7);refresh()};
$('#td').onclick=()=>{D=today();refresh()};$('#bReload').onclick=refresh;
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
async function showSession(){
  const {data:{user:current},error}=await db.auth.getUser();
  if(error||!current){user=null;role=null;loadSeq++;S={emps:[],rec:{},versions:{},empVersions:{}};$('#ovDay').style.display='none';$('#main').hidden=true;$('#mainNav').hidden=true;$('#ovLogin').style.display='flex';$('#bReload').hidden=true;$('#bOut').hidden=true;$('#user').textContent='';setSync('Aguardando login');return}
  try{
    const p=await profile(current.id);
    if(!p||!p.ativo)throw new Error('Conta sem perfil ativo. Solicite acesso ao administrador.');
    if(user?.id!==current.id){S={emps:[],rec:{},versions:{},empVersions:{}};page='schedule'}
    user=current;role=p.perfil;$('#user').textContent=`${p.nome} · ${p.perfil==='visualizacao'||p.perfil==='funcionario'?'funcionário':p.perfil}`;
    $('#main').hidden=false;$('#mainNav').hidden=false;$('#ovLogin').style.display='none';$('#loginError').textContent='';
    $('#bReload').hidden=false;$('#bOut').hidden=false;showPage(page);
    await refresh();
  }catch(e){user=null;role=null;S={emps:[],rec:{},versions:{},empVersions:{}};$('#ovDay').style.display='none';$('#main').hidden=true;$('#mainNav').hidden=true;$('#ovLogin').style.display='flex';$('#loginError').textContent=explain(e);setSync('Acesso indisponível',true)}
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
$('#bOut').onclick=async()=>{await db.auth.signOut();$('#ovDay').style.display='none';page='schedule';showSession()};

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
