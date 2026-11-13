(function(){
const DOW=['일','월','화','수','목','금','토'];
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S=Store.load();
const LOGO='/icons/logo.webp';

let view='week', cursor=new Date(), modal=null, saveState='idle', readOnly=false, saveTimer=null, toastMsg='';
cursor.setHours(0,0,0,0);

/* ---------- date utils ---------- */
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const weekStart=d=>{const x=new Date(d);const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);x.setHours(0,0,0,0);return x};
const md=d=>(d.getMonth()+1)+'/'+d.getDate();
const todayKey=()=>key(new Date());
const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const shiftHours=s=>{let a=mins(s.start),b=mins(s.end);if(b<=a)b+=1440;return (b-a)/60};

/* ---------- state helpers ---------- */
const mem=id=>S.members.find(m=>m.id===id);
const isClosed=k=>!!(S.closedOverride&&S.closedOverride[k]!=null? S.closedOverride[k] : S.closedDays.includes(parse(k).getDay()));
const getA=(k,sid)=>((S.assign[k]||{})[sid]||[]).filter(mem);
const getOff=k=>(S.off[k]||[]).filter(mem);
function hoursFor(days){
  const h={};S.members.forEach(m=>h[m.id]=0);
  days.forEach(k=>{if(isClosed(k))return;S.shifts.forEach(s=>getA(k,s.id).forEach(id=>h[id]+=shiftHours(s)))});
  return h;
}
function shiftsCount(days){
  const c={};S.members.forEach(m=>c[m.id]=0);
  days.forEach(k=>{if(isClosed(k))return;S.shifts.forEach(s=>getA(k,s.id).forEach(id=>c[id]++))});
  return c;
}
function weekKeys(d){const s=weekStart(d);return [...Array(7)].map((_,i)=>key(addDays(s,i)))}

/* ---------- persistence ----------
   지금은 이 기기(브라우저)에만 저장돼요. 나중에 Supabase/Firebase를 붙일 때 store.js만 바꾸면 됩니다. */
function changed(quiet){
  S.updated=new Date().toISOString();
  saveState='busy';if(!quiet)render();
  clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
    try{await Store.save(S);saveState=Store.shared?'saved':'local'}catch(e){saveState='error'}
    render();
  },500);
}
saveState=Store.shared?'saved':'local';
function toast(m){toastMsg=m;render();setTimeout(()=>{toastMsg='';render()},2200)}

/* ---------- render ---------- */
function chip(id,off){const m=mem(id);if(!m)return'';return `<span class="chip${off?' off':''}" style="${off?'color:'+m.color:'background:'+m.color}">${off?'휴무 ':''}${esc(m.name)}</span>`}

function render(){
  const ae=document.activeElement;const focusId=ae&&ae.id;const selS=ae&&ae.selectionStart;
  const sl={idle:'',busy:'저장 중…',saved:'모두에게 저장됨',local:'이 폰에 저장됨',ro:'보기 전용',error:'저장 실패 — 다시 시도해 주세요'}[saveState]||'';
  let h=`<div class="wrap">
  <header class="top">
    <img src="${LOGO}" alt="알혼커피 OLKHON COFFEE">
    <div class="t"><h1>알혼커피 근무표</h1><p>${S.members.map(m=>esc(m.name)).join(' · ')} — ${S.members.length}명이 함께 운영해요</p></div>
    <div class="save ${saveState==='busy'?'busy':''} ${readOnly||saveState==='local'?'ro':''}"><i></i>${esc(sl)}</div>
  </header>
  ${!Store.shared&&!S.hideBanner?'<div class="banner">미리보기 버전이에요. 지금은 각자 폰에만 저장되고, 세 사람 공유는 다음 단계에서 연결돼요. <button class="btn sm ghost" data-act="hidebanner">닫기</button></div>':''}
  ${readOnly?'<div class="banner">이 근무표는 보기 전용이에요. 편집 권한이 있는 사람만 바꿀 수 있어요.</div>':''}
  <nav class="tabs">
    <button data-view="week" class="${view==='week'?'on':''}">주간</button>
    <button data-view="month" class="${view==='month'?'on':''}">월간</button>
    <button data-view="settings" class="${view==='settings'?'on':''}">설정</button>
  </nav>`;
  if(view==='week')h+=renderWeek();
  else if(view==='month')h+=renderMonth();
  else h+=renderSettings();
  h+='</div>';
  if(modal)h+=renderModal();
  if(toastMsg)h+=`<div class="toast">${esc(toastMsg)}</div>`;
  $('#root').innerHTML=h;
  if(focusId){const el=document.getElementById(focusId);if(el){el.focus();try{if(selS!=null)el.setSelectionRange(selS,selS)}catch(e){}}}
}

function renderToday(){
  const k=todayKey();
  if(isClosed(k))return `<div class="today"><div class="lbl">오늘은 쉬는 날 ☕</div></div>`;
  return `<div class="today"><div class="lbl">오늘 (${md(new Date())} ${DOW[new Date().getDay()]})</div><div class="slots">${
    S.shifts.map(s=>{const a=getA(k,s.id);return `<div class="slot"><b>${esc(s.name)} ${s.start}–${s.end}</b>${a.length?a.map(id=>esc(mem(id).name)).join(', '):'미배정'}</div>`}).join('')
  }</div></div>`;
}

function renderWeek(){
  const ks=weekKeys(cursor);const s=parse(ks[0]),e=parse(ks[6]);
  let h=renderToday();
  h+=`<div class="bar">
    <button class="btn" data-act="prev">◀</button>
    <div class="range">${s.getMonth()+1}월 ${s.getDate()}일 – ${e.getMonth()+1}월 ${e.getDate()}일</div>
    <button class="btn" data-act="next">▶</button>
    <button class="btn sm ghost" data-act="thisweek">이번 주</button>
    <div class="spacer"></div>
    ${readOnly?'':`<button class="btn" data-act="copyprev">지난주 복사</button>
    <button class="btn lime" data-act="auto">빈칸 자동 배정</button>
    <button class="btn" data-act="clearweek">비우기</button>`}
    <button class="btn pri" data-act="share">카톡용 텍스트 복사</button>
  </div><div class="week">`;
  ks.forEach(k=>{
    const d=parse(k),dw=d.getDay(),closed=isClosed(k);
    h+=`<div class="day ${closed?'closed':''} ${k===todayKey()?'is-today':''} ${dw===0?'sun':dw===6?'sat':''}" data-day="${k}">
      <div class="dh"><span class="dw">${DOW[dw]}</span><span class="dd">${md(d)}</span></div>`;
    if(closed){h+=`<div class="closedtag">휴무일</div>`}
    else{
      S.shifts.forEach(sh=>{
        const a=getA(k,sh.id);const need=sh.need||1;
        h+=`<div class="shift ${a.length<need?'empty':''}"><div class="sn"><span>${esc(sh.name)}</span><span>${sh.start}–${sh.end}</span></div>
          <div class="chips">${a.map(id=>chip(id)).join('')||'<span style="font-size:12px;color:var(--warn)">+ 배정 필요</span>'}</div></div>`;
      });
    }
    const off=getOff(k);
    if(off.length)h+=`<div class="chips">${off.map(id=>chip(id,true)).join('')}</div>`;
    if(S.notes[k])h+=`<div class="note">${esc(S.notes[k])}</div>`;
    h+=`</div>`;
  });
  h+=`</div>`;
  // stats
  const hr=hoursFor(ks),cnt=shiftsCount(ks);const max=Math.max(1,...Object.values(hr));
  h+=`<div class="panel"><h3>이번 주 근무 시간</h3><div class="stats">${S.members.map(m=>`
    <div class="stat"><div class="dot" style="background:${m.color}">${esc(m.name.slice(0,1))}</div>
    <div style="flex:1"><div class="h">${+hr[m.id].toFixed(1)}<span style="font-size:13px;font-weight:500;color:var(--sub)">시간 · ${cnt[m.id]}회</span></div>
    <div class="s">${esc(m.name)}${m.target?` · 목표 ${m.target}시간`:''}</div>
    <div class="barline"><span style="width:${hr[m.id]/max*100}%;background:${m.color}"></span></div></div></div>`).join('')}
  </div><p class="hint" style="margin:10px 0 0">날짜 칸을 누르면 근무자·휴무·메모를 바꿀 수 있어요. 빨간 칸은 아직 사람이 비어 있는 근무예요.</p></div>`;
  return h;
}

function renderMonth(){
  const y=cursor.getFullYear(),m=cursor.getMonth();
  const first=new Date(y,m,1);const start=weekStart(first);
  const last=new Date(y,m+1,0);const end=addDays(weekStart(last),6);
  let h=`<div class="bar"><button class="btn" data-act="mprev">◀</button><div class="range">${y}년 ${m+1}월</div><button class="btn" data-act="mnext">▶</button>
  <button class="btn sm ghost" data-act="thismonth">이번 달</button><div class="spacer"></div>
  <div class="legend">${S.members.map(x=>`<span class="chip" style="background:${x.color}">${esc(x.name)}</span>`).join('')}</div></div>
  <div class="month">${['월','화','수','목','금','토','일'].map(w=>`<div class="wh">${w}</div>`).join('')}`;
  const monthKeys=[];
  for(let d=new Date(start);d<=end;d=addDays(d,1)){
    const k=key(d),closed=isClosed(k);if(d.getMonth()===m)monthKeys.push(k);
    h+=`<div class="mc ${d.getMonth()!==m?'other':''} ${closed?'closed':''} ${k===todayKey()?'is-today':''}" data-day="${k}"><div class="n">${d.getDate()}</div>`;
    if(closed)h+=`<div class="sl">휴무일</div>`;
    else S.shifts.forEach(s=>{const a=getA(k,s.id);h+=`<div class="row"><span class="sl">${esc(s.name)}</span>${a.map(id=>`<span class="mini" style="background:${mem(id).color}">${esc(mem(id).name.slice(0,1))}</span>`).join('')||'<span style="color:var(--warn);font-size:10px">—</span>'}</div>`});
    const off=getOff(k);if(off.length)h+=`<div class="row" style="font-size:10px;color:var(--sub)">휴무 ${off.map(id=>esc(mem(id).name)).join(',')}</div>`;
    h+=`</div>`;
  }
  h+=`</div>`;
  const hr=hoursFor(monthKeys),cnt=shiftsCount(monthKeys);
  h+=`<div class="panel"><h3>${m+1}월 합계</h3><div class="stats">${S.members.map(x=>`<div class="stat"><div class="dot" style="background:${x.color}">${esc(x.name.slice(0,1))}</div><div><div class="h">${+hr[x.id].toFixed(1)}<span style="font-size:13px;font-weight:500;color:var(--sub)">시간 · ${cnt[x.id]}회</span></div><div class="s">${esc(x.name)}</div></div></div>`).join('')}</div></div>`;
  return h;
}

function renderSettings(){
  const dis=readOnly?'disabled':'';
  return `<div class="set-grid">
  <div class="panel" style="margin-top:0"><h3>멤버</h3><p class="hint">이름과 색을 바꾸면 근무표 전체에 반영돼요. 주간 목표 시간은 자동 배정에 참고돼요.</p>
    ${S.members.map((m,i)=>`<div class="row-i"><input type="color" value="${m.color}" data-mem="${i}" data-f="color" ${dis}>
      <input type="text" id="mn${i}" value="${esc(m.name)}" data-mem="${i}" data-f="name" ${dis}>
      <input type="number" id="mt${i}" min="0" max="80" placeholder="목표" value="${m.target||''}" data-mem="${i}" data-f="target" ${dis} title="주간 목표 시간">
      ${S.members.length>1&&!readOnly?`<button class="btn sm ghost" data-delmem="${i}" title="삭제">✕</button>`:''}</div>`).join('')}
    ${readOnly?'':'<button class="btn sm" data-act="addmem">+ 멤버 추가</button>'}
  </div>
  <div class="panel" style="margin-top:0"><h3>근무 타임</h3><p class="hint">하루를 어떤 타임으로 나눌지 정해요. 필요 인원은 그 타임에 들어가야 하는 사람 수예요.</p>
    ${S.shifts.map((s,i)=>`<div class="row-i"><input type="text" id="sn${i}" value="${esc(s.name)}" data-sh="${i}" data-f="name" style="max-width:110px" ${dis}>
      <input type="time" value="${s.start}" data-sh="${i}" data-f="start" ${dis}> – <input type="time" value="${s.end}" data-sh="${i}" data-f="end" ${dis}>
      <input type="number" min="1" max="3" value="${s.need||1}" data-sh="${i}" data-f="need" title="필요 인원" ${dis}><span class="hint" style="margin:0">명</span>
      ${S.shifts.length>1&&!readOnly?`<button class="btn sm ghost" data-delsh="${i}">✕</button>`:''}</div>`).join('')}
    ${readOnly?'':'<button class="btn sm" data-act="addsh">+ 타임 추가</button>'}
  </div>
  <div class="panel" style="margin-top:0"><h3>정기 휴무 요일</h3><p class="hint">가게 문을 닫는 요일을 골라 주세요. 특정 날짜만 쉬거나 여는 건 날짜 칸에서 바꿀 수 있어요.</p>
    <div class="dows">${[1,2,3,4,5,6,0].map(d=>`<button data-dow="${d}" class="${S.closedDays.includes(d)?'on':''}" ${dis}>${DOW[d]}</button>`).join('')}</div>
  </div>
  </div>`;
}

function renderModal(){
  const k=modal.day,d=parse(k),closed=isClosed(k),off=getOff(k);
  const dis=readOnly?'disabled':'';
  let h=`<div class="scrim" data-act="closemodal"><div class="modal" data-stop="1">
   <h2>${d.getMonth()+1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</h2>
   <div class="sub">${closed?'휴무일이에요':'근무자를 눌러서 넣고 빼요'}</div>
   <div class="row-i"><label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-act="toggleclosed" ${closed?'checked':''} ${dis}> 이 날은 가게 휴무</label></div>`;
  if(!closed){
    S.shifts.forEach(s=>{
      const a=getA(k,s.id);
      h+=`<div class="sh-block"><div class="st">${esc(s.name)} <span>${s.start}–${s.end} · ${s.need||1}명</span></div><div class="pick">${
        S.members.map(m=>{const on=a.includes(m.id),isOff=off.includes(m.id);
          return `<button class="${on?'on':''} ${isOff&&!on?'dis':''}" style="${on?`background:${m.color};border-color:${m.color}`:`border-color:${m.color}55`}" data-pick="${s.id}" data-m="${m.id}" ${dis}>${esc(m.name)}</button>`}).join('')
      }</div>${a.some(id=>off.includes(id))?'<div class="warn">휴무 신청한 사람이 배정돼 있어요</div>':''}${a.length<(s.need||1)?`<div class="warn">${(s.need||1)-a.length}명 더 필요해요</div>`:''}</div>`;
    });
  }
  h+=`<h4>휴무 신청</h4><div class="pick">${S.members.map(m=>{const on=off.includes(m.id);return `<button class="${on?'on':''}" style="${on?`background:${m.color};border-color:${m.color}`:`border-color:${m.color}55`}" data-offm="${m.id}" ${dis}>${esc(m.name)}</button>`}).join('')}</div>
   <h4>메모</h4><textarea id="memo" data-memo="1" placeholder="예) 원두 입고, 보물찾기 이벤트 준비" ${dis}>${esc(S.notes[k]||'')}</textarea>
   <div class="foot"><button class="btn pri" data-act="closemodal">완료</button></div>
  </div></div>`;
  return h;
}

/* ---------- actions ---------- */
function setAssign(k,sid,arr){S.assign[k]=S.assign[k]||{};S.assign[k][sid]=arr;}
function autoFill(){
  const ks=weekKeys(cursor);const hr=hoursFor(ks);let filled=0;
  ks.forEach(k=>{
    if(isClosed(k))return;
    const off=getOff(k);
    S.shifts.forEach(s=>{
      const a=getA(k,s.id).slice();const need=s.need||1;
      while(a.length<need){
        const busy=new Set();S.shifts.forEach(o=>{if(o.id!==s.id)getA(k,o.id).forEach(id=>busy.add(id))});
        let cand=S.members.filter(m=>!a.includes(m.id)&&!off.includes(m.id));
        const free=cand.filter(m=>!busy.has(m.id));if(free.length)cand=free;
        if(!cand.length)break;
        cand.sort((x,y)=>{const rx=x.target?hr[x.id]/x.target:hr[x.id]/40,ry=y.target?hr[y.id]/y.target:hr[y.id]/40;return rx-ry||hr[x.id]-hr[y.id]});
        a.push(cand[0].id);hr[cand[0].id]+=shiftHours(s);filled++;
      }
      setAssign(k,s.id,a);
    });
  });
  changed();toast(filled?`${filled}칸을 배정했어요`:'채울 빈칸이 없어요');
}
function copyPrev(){
  const ks=weekKeys(cursor),pk=weekKeys(addDays(cursor,-7));
  ks.forEach((k,i)=>{const p=S.assign[pk[i]];if(p)S.assign[k]=JSON.parse(JSON.stringify(p));});
  changed();toast('지난주 근무를 복사했어요 (휴무 신청은 따로 확인해 주세요)');
}
function shareText(){
  const ks=weekKeys(cursor);const s=parse(ks[0]),e=parse(ks[6]);
  let t=`[알혼커피 근무표 ${md(s)}~${md(e)}]\n`;
  ks.forEach(k=>{const d=parse(k);t+=`\n${md(d)}(${DOW[d.getDay()]}) `;
    if(isClosed(k)){t+='휴무';return}
    t+=S.shifts.map(sh=>`${sh.name} ${getA(k,sh.id).map(id=>mem(id).name).join('·')||'미정'}`).join(' / ');
    if(S.notes[k])t+=`\n  📌 ${S.notes[k]}`;
  });
  const hr=hoursFor(ks);t+=`\n\n${S.members.map(m=>`${m.name} ${+hr[m.id].toFixed(1)}h`).join(' · ')}`;
  return t;
}
const PALETTE=['#3549a6','#93b23f','#e07a5f','#8e6bbf','#2a9d8f','#d4a017'];

document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act],[data-view],[data-day],[data-pick],[data-offm],[data-dow],[data-delmem],[data-delsh],[data-stop]');
  if(!t)return;
  if(t.dataset.stop&&ev.target.closest('[data-act],[data-pick],[data-offm]')==null&&ev.target===t)return;
  if(t.dataset.view){view=t.dataset.view;render();return}
  if(t.dataset.day&&!modal){modal={day:t.dataset.day};render();return}
  if(t.dataset.stop)return;
  if(readOnly&&(t.dataset.pick||t.dataset.offm||t.dataset.dow))return;
  if(t.dataset.pick){const k=modal.day,sid=t.dataset.pick,id=t.dataset.m;const a=getA(k,sid);setAssign(k,sid,a.includes(id)?a.filter(x=>x!==id):[...a,id]);changed();return}
  if(t.dataset.offm){const k=modal.day,id=t.dataset.offm;const o=getOff(k);S.off[k]=o.includes(id)?o.filter(x=>x!==id):[...o,id];if(!S.off[k].length)delete S.off[k];changed();return}
  if(t.dataset.dow){const d=+t.dataset.dow;S.closedDays=S.closedDays.includes(d)?S.closedDays.filter(x=>x!==d):[...S.closedDays,d];changed();return}
  if(t.dataset.delmem){const i=+t.dataset.delmem;S.members.splice(i,1);changed();return}
  if(t.dataset.delsh){const i=+t.dataset.delsh;S.shifts.splice(i,1);changed();return}
  const a=t.dataset.act;
  if(a==='closemodal'){if(ev.target!==t&&t.classList.contains('scrim'))return;modal=null;render();return}
  if(a==='prev'){cursor=addDays(cursor,-7);render()}
  else if(a==='next'){cursor=addDays(cursor,7);render()}
  else if(a==='thisweek'||a==='thismonth'){cursor=new Date();cursor.setHours(0,0,0,0);render()}
  else if(a==='mprev'){cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render()}
  else if(a==='mnext'){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render()}
  else if(a==='auto')autoFill();
  else if(a==='copyprev')copyPrev();
  else if(a==='clearweek'){weekKeys(cursor).forEach(k=>delete S.assign[k]);changed();toast('이번 주 배정을 비웠어요')}
  else if(a==='share'){const txt=shareText();try{await navigator.clipboard.writeText(txt);toast('복사했어요! 단톡방에 붙여넣어 주세요')}catch(e){modal=null;showText(txt)}}
  else if(a==='addmem'){const id='m'+Date.now().toString(36);S.members.push({id,name:'새 멤버',color:PALETTE[S.members.length%PALETTE.length]});changed()}
  else if(a==='hidebanner'){S.hideBanner=true;changed()}
  else if(a==='addsh'){S.shifts.push({id:'s'+Date.now().toString(36),name:'미들',start:'11:00',end:'17:00',need:1});changed()}
});
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.dataset.act==='toggleclosed'){S.closedOverride=S.closedOverride||{};const k=modal.day;const def=S.closedDays.includes(parse(k).getDay());if(t.checked===def)delete S.closedOverride[k];else S.closedOverride[k]=t.checked;changed();return}
  if(t.dataset.mem!=null){const m=S.members[+t.dataset.mem];const f=t.dataset.f;m[f]=f==='target'?(+t.value||0):(t.value.trim()||m[f]);changed();return}
  if(t.dataset.sh!=null){const s=S.shifts[+t.dataset.sh];const f=t.dataset.f;s[f]=f==='need'?Math.max(1,+t.value||1):(t.value||s[f]);changed();return}
});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.dataset.memo&&modal){const k=modal.day;const v=t.value.trim();if(v)S.notes[k]=v;else delete S.notes[k];changed(true)}
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&modal){modal=null;render()}});
function showText(txt){
  const d=document.createElement('div');d.className='scrim';
  d.innerHTML=`<div class="modal"><h2>카톡용 텍스트</h2><div class="sub">아래 내용을 길게 눌러 복사해 주세요.</div><textarea style="min-height:260px" readonly>${esc(txt)}</textarea><div class="foot"><button class="btn pri">닫기</button></div></div>`;
  d.querySelector('button').onclick=()=>d.remove();document.body.appendChild(d);d.querySelector('textarea').select();
}
render();
})();
