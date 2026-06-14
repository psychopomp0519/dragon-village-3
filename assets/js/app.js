"use strict";

/* ===== 속성 색상 ===== */
const ELEMENT_COLORS = {
  "불":"#ff6b4a","물":"#4aa8ff","바람":"#52d39a","강철":"#9aa6bd","땅":"#c79a5b",
  "번개":"#ffd24a","빛":"#ffe27a","어둠":"#a06bff","꿈":"#ff8ad1","영혼":"#5fe0e0",
  "여명":"#ffb38a","황혼":"#c77dff","신성":"#fff2b0","혼돈":"#ff5c8a"
};
const ELEMENT_ORDER = ["불","물","바람","강철","땅","번개","빛","어둠","꿈","영혼","여명","황혼","신성","혼돈"];
const STAT_LABELS = {hp:"체력",atk:"공격",def:"방어",mag:"마력",res:"저항",spd:"속도"};
const elColor = e => ELEMENT_COLORS[e] || "#7c6cff";

/* ===== 상태 ===== */
const DB = {};
const state = {
  dragons:{search:"",grade:"",attack:"",source:"",sort:"total",element:"",owned:""},
  orbs:{search:"",grade:"",type:"",sort:"power",element:""},
  abilities:{search:""},
  breeding:{mode:"target",level:28,ownedOnly:true,targets:[],p1:null,p2:null},
  types:{focus:""}
};

/* ===== 유틸 ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const elBadge = e => `<span class="badge badge-el" style="background:${elColor(e)}">${esc(e)}</span>`;
const gradeBadge = g => `<span class="badge badge-grade grade-${esc(g)}">${esc(g)}</span>`;

async function loadAll(){
  const names = ["dragons","orbs","abilities","dragon_summary","orb_summary","terms","dragon_notes","orb_notes","breeding_dragons","type_chart"];
  const res = await Promise.all(names.map(n=>fetch(`data/${n}.json`).then(r=>{
    if(!r.ok) throw new Error(`${n}.json (${r.status})`); return r.json();
  })));
  names.forEach((n,i)=>DB[n]=res[i]);
}

/* ===== 탭 ===== */
function initTabs(){
  $$("#tabs .tab").forEach(t=>t.addEventListener("click",()=>{
    $$("#tabs .tab").forEach(x=>x.classList.remove("active"));
    $$(".view").forEach(v=>v.classList.remove("active"));
    t.classList.add("active");
    $("#view-"+t.dataset.view).classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
  }));
}

/* ===== 셀렉트 채우기 ===== */
function fillSelect(sel,values){
  values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
}

/* ===== 속성칩 ===== */
function buildElementChips(containerId,elements,getActive,onpick){
  const c=$(containerId);
  const render=()=>{
    const active=getActive();
    const mk=(val,label)=>{
      const b=document.createElement("button");
      b.className="chip"+(active===val?" active":"");
      if(val&&active===val) b.style.cssText=`background:${elColor(val)}`;
      b.innerHTML = val?`<span class="dot" style="background:${elColor(val)}"></span>${label}`:label;
      b.onclick=()=>{onpick(active===val?"":val);render();};
      return b;
    };
    c.innerHTML="";
    c.appendChild(mk("","전체"));
    elements.forEach(e=>c.appendChild(mk(e,e)));
  };
  render();
}

/* ====================== DRAGONS ====================== */
function renderDragons(){
  const s=state.dragons;
  let list=DB.dragons.filter(d=>{
    if(s.grade && d.grade!==s.grade) return false;
    if(s.attack && d.attackType!==s.attack) return false;
    if(s.source && d.source!==s.source) return false;
    if(s.element && d.element!==s.element && !d.subElements.includes(s.element)) return false;
    if(s.owned==="own" && !Store.has(d.name)) return false;
    if(s.owned==="miss" && Store.has(d.name)) return false;
    if(s.search){
      const q=s.search.toLowerCase();
      const hay=[d.name,d.element,...d.subElements,d.ability,d.abilityEffect,d.ultimate,d.basicAttack,d.ultimateEffect,d.source].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a,b)=>{
    if(s.sort==="name") return a.name.localeCompare(b.name,"ko");
    if(s.sort==="total") return b.total-a.total;
    return (b.stats[s.sort]||0)-(a.stats[s.sort]||0);
  });
  $("#dragon-count").textContent=`${list.length}종 표시`;
  const maxStat=1500;
  $("#dragon-grid").innerHTML=list.map(d=>{
    const subs=d.subElements.map(e=>`<span class="badge badge-el" style="background:${elColor(e)};opacity:.65">${esc(e)}</span>`).join("");
    const bars=Object.keys(STAT_LABELS).map(k=>{
      const v=d.stats[k]||0,pct=Math.min(100,v/maxStat*100);
      return `<div class="statbar"><span class="lbl">${STAT_LABELS[k]}</span><span class="track"><span class="fill" style="width:${pct}%"></span></span><span class="val">${v}</span></div>`;
    }).join("");
    const own=Store.has(d.name);
    return `<div class="dcard${own?' is-owned':''}" style="--el:${elColor(d.element)}" data-name="${esc(d.name)}">
      <button class="own-toggle${own?' owned':''}" data-own="${esc(d.name)}" title="${own?'보유 해제':'보유로 표시'}" aria-pressed="${own}">${own?'★':'☆'}</button>
      <div class="dcard-top">
        <div>
          <div class="dcard-name">${esc(d.name)}</div>
          <div class="dcard-tags">${elBadge(d.element)}${subs}${gradeBadge(d.grade)}<span class="badge badge-atk">${esc(d.attackType)}</span></div>
        </div>
        <div class="dcard-total"><b>${d.total}</b><span>Lv.50 합계</span></div>
      </div>
      <div class="statbars">${bars}</div>
      <div class="dcard-foot">특성 <b>${esc(d.ability)}</b> · 필살기 <b>${esc(d.ultimate)}</b></div>
    </div>`;
  }).join("") || `<p class="result-count">조건에 맞는 드래곤이 없습니다.</p>`;

  $$("#dragon-grid .dcard").forEach(c=>c.onclick=()=>openDragon(c.dataset.name));
  $$("#dragon-grid .own-toggle").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    Store.toggle(b.dataset.own);
  });
}

function openDragon(name){
  const d=DB.dragons.find(x=>x.name===name); if(!d) return;
  const subs=d.subElements.map(e=>`<span class="badge badge-el" style="background:${elColor(e)};opacity:.7">${esc(e)}</span>`).join("");
  const stats=Object.keys(STAT_LABELS).map(k=>{
    const v=d.stats[k]||0,pct=Math.min(100,v/1500*100);
    return `<div class="statbar"><span class="lbl">${STAT_LABELS[k]}</span><span class="track"><span class="fill" style="width:${pct}%"></span></span><span class="val">${v}</span></div>`;
  }).join("");
  $("#modal-body").innerHTML=`
    <div class="m-head"><div class="m-name">${esc(d.name)}</div></div>
    <div class="m-tags">${elBadge(d.element)}${subs}${gradeBadge(d.grade)}<span class="badge badge-atk">${esc(d.attackType)} 공격형</span></div>
    <button class="btn m-own-btn${Store.has(d.name)?' owned':''}" id="m-own" data-name="${esc(d.name)}">${Store.has(d.name)?'★ 보유 중 — 해제':'☆ 보유로 표시'}</button>
    <div class="m-total"><b>${d.total}</b><span>Lv.50 · 5성 기준 능력치 합계</span></div>
    <div class="m-section"><h4>능력치</h4><div class="m-stats statbars">${stats}</div></div>
    <div class="m-section"><h4>특성 (어빌리티)</h4>
      <div class="m-row"><div class="t">${esc(d.ability)}</div><div class="d">${esc(d.abilityEffect)}</div></div></div>
    <div class="m-section"><h4>스킬</h4>
      <div class="m-stats">
        <div class="m-row"><div class="t">평타 · ${esc(d.basicAttack)}</div><div class="d"><small>명중 100 / 위력 30 · 에너지 1 회복</small></div></div>
        <div class="m-row"><div class="t">필살기 · ${esc(d.ultimate)} <small style="color:var(--muted)">(${esc(d.ultimateType)})</small></div>
          <div class="d">${esc(d.ultimateEffect)}<br><small>명중 ${esc(d.accuracy)} / 위력 ${esc(d.power)}</small></div></div>
      </div></div>
    ${typeSectionFor(d)}
    <div class="m-section"><h4>획득처</h4><div class="m-row"><div class="d">${esc(d.source)}</div></div></div>`;
  $("#m-own").onclick=()=>{ Store.toggle(d.name); openDragon(d.name); };
  openModal();
}

/* ====================== ORBS ====================== */
function renderOrbs(){
  const s=state.orbs;
  let list=DB.orbs.filter(o=>{
    if(s.grade && o.grade!==s.grade) return false;
    if(s.type && o.type!==s.type) return false;
    if(s.element && o.element!==s.element) return false;
    if(s.search){
      const q=s.search.toLowerCase();
      if(![o.name,o.skill,o.effect,o.element].join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const num=v=>(typeof v==="number"?v:-1);
  list.sort((a,b)=>{
    if(s.sort==="name") return a.name.localeCompare(b.name,"ko");
    return num(b[s.sort])-num(a[s.sort]);
  });
  $("#orb-count").textContent=`${list.length}종 표시`;
  $("#orb-table tbody").innerHTML=list.map(o=>`
    <tr>
      <td>${elBadge(o.element)}</td>
      <td>${gradeBadge(o.grade)}</td>
      <td class="nm">${esc(o.name)}</td>
      <td>${esc(o.skill)}</td>
      <td>${esc(o.type)}</td>
      <td class="num">${esc(o.accuracy)}</td>
      <td class="num">${esc(o.power)}</td>
      <td class="num">${esc(o.cost)}</td>
      <td class="num">${esc(o.statBonus)}</td>
      <td class="eff">${esc(o.effect)}</td>
      <td>${esc(o.source)}</td>
    </tr>`).join("") || `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:30px">조건에 맞는 보주가 없습니다.</td></tr>`;
}

/* ====================== ABILITIES ====================== */
function renderAbilities(){
  const q=state.abilities.search.toLowerCase();
  let list=DB.abilities.filter(a=>!q || [a.name,a.effect,...a.dragons].join(" ").toLowerCase().includes(q));
  $("#ability-count").textContent=`${list.length}종 특성`;
  $("#ability-grid").innerHTML=list.map(a=>`
    <div class="acard">
      <h3>${esc(a.name)}<span class="cnt">${a.count}</span></h3>
      <div class="eff">${esc(a.effect)}</div>
      <div class="owners">${a.dragons.map(d=>`<span class="owner" data-name="${esc(d)}">${esc(d)}</span>`).join("")}</div>
    </div>`).join("") || `<p class="result-count">결과 없음</p>`;
  $$("#ability-grid .owner").forEach(o=>o.onclick=()=>{
    if(DB.dragons.some(d=>d.name===o.dataset.name)) openDragon(o.dataset.name);
  });
}

/* ====================== CODEX ====================== */
function renderCodex(){
  const tbl=(el,rows)=>{
    if(!rows.length) return;
    const keys=Object.keys(rows[0]);
    $(el).innerHTML=`<thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>{
        const total = String(r[keys[0]]).includes("합계");
        return `<tr${total?' style="font-weight:700;background:var(--panel2)"':''}>${keys.map((k,i)=>{
          const v=r[k];
          if(i===0 && ELEMENT_ORDER.includes(String(v))) return `<td>${elBadge(v)}</td>`;
          return `<td${i>0?' class="num"':''}>${esc(v)}</td>`;
        }).join("")}</tr>`;
      }).join("")}</tbody>`;
  };
  tbl("#dsummary",DB.dragon_summary);
  tbl("#osummary",DB.orb_summary);
  $("#term-grid").innerHTML=DB.terms.map(t=>`<div class="term"><b>${esc(t["용어"])}</b><span>${esc(t["효과"])}</span></div>`).join("");
  const notes=[...DB.dragon_notes,...DB.orb_notes].filter(n=>!String(n).startsWith("시트 구성"));
  $("#notes-list").innerHTML=[...new Set(notes)].map(n=>`<li>${esc(n)}</li>`).join("");
}

/* ====================== COLLECTION ====================== */
function renderCollection(){
  const all=DB.dragons, owned=all.filter(d=>Store.has(d.name));
  const n=owned.length, total=all.length, pct=total?Math.round(n/total*100):0;
  $("#cnt-owned").textContent=n;

  const cloud=Store.isCloud(), configured=Store.isConfigured();
  let loginNote="";
  if(cloud){
    loginNote=`<span class="sub">☁️ ${esc(Store.getUser().email)} 계정에 클라우드 저장 중 · 어느 기기에서나 동기화됩니다.</span>`;
  } else if(configured){
    loginNote=`<span class="sub">현재 이 브라우저에만 저장됩니다. <a href="#" id="coll-login">로그인</a>하면 클라우드에 저장돼 기기 간 동기화됩니다.</span>`;
  } else {
    loginNote=`<span class="sub">이 브라우저(localStorage)에 저장됩니다. Supabase 설정 시 로그인·동기화가 켜집니다.</span>`;
  }

  // 등급별 / 속성별 분해
  const grades=[...new Set(all.map(d=>d.grade))];
  const gradeRows=grades.map(g=>{
    const t=all.filter(d=>d.grade===g).length, o=owned.filter(d=>d.grade===g).length;
    return brkRow(g,o,t,gradeColorVar(g));
  }).join("");
  const elRows=ELEMENT_ORDER.filter(e=>all.some(d=>d.element===e)).map(e=>{
    const t=all.filter(d=>d.element===e).length, o=owned.filter(d=>d.element===e).length;
    return brkRow(`<span class="badge badge-el" style="background:${elColor(e)}">${e}</span>`,o,t,elColor(e));
  }).join("");

  $("#collection-body").innerHTML=`
    <div class="coll-hero">
      <h2>내 드래곤 컬렉션</h2>
      ${loginNote}
      <div class="coll-big"><b>${n}</b><span>/ ${total}종 보유 · 도감 달성 ${pct}%</span></div>
      <div class="coll-prog"><span class="fill" style="width:${pct}%"></span></div>
    </div>
    <div class="coll-cards">
      <div class="coll-stat"><div class="k">보유</div><div class="v" style="color:var(--gold)">${n}</div></div>
      <div class="coll-stat"><div class="k">미보유</div><div class="v">${total-n}</div></div>
      <div class="coll-stat"><div class="k">달성률</div><div class="v">${pct}%</div></div>
    </div>
    <div class="coll-break">
      <h3>등급별 보유</h3>${gradeRows}
      <h3>속성별 보유</h3>${elRows}
    </div>
    ${n?`<div style="margin-top:22px"><button class="btn btn-sm" id="coll-goto">드래곤 도감에서 '보유만' 보기</button>
        <button class="btn btn-sm" id="coll-clear" style="margin-left:8px">전체 보유 초기화</button></div>`:
      `<div class="coll-empty">아직 보유로 표시한 드래곤이 없습니다.<br>드래곤 카드의 ☆ 버튼을 눌러 보유 현황을 기록해 보세요.
        <br><button class="btn" id="coll-goto2">드래곤 도감으로</button></div>`}
  `;
  const goDragons=()=>{$$("#tabs .tab").forEach(x=>x.classList.remove("active"));$$(".view").forEach(v=>v.classList.remove("active"));
    document.querySelector('#tabs .tab[data-view="dragons"]').classList.add("active");$("#view-dragons").classList.add("active");window.scrollTo({top:0});};
  const gt=$("#coll-goto"); if(gt) gt.onclick=()=>{state.dragons.owned="own";$("#dragon-owned").value="own";renderDragons();goDragons();};
  const gt2=$("#coll-goto2"); if(gt2) gt2.onclick=goDragons;
  const cl=$("#coll-clear"); if(cl) cl.onclick=()=>{ if(confirm("모든 보유 표시를 해제할까요?")) Store.clearAll(); };
  const lg=$("#coll-login"); if(lg) lg.onclick=e=>{e.preventDefault();openAuth();};
}
function brkRow(label,o,t,color){
  const pct=t?o/t*100:0;
  return `<div class="brk-row"><span class="nm">${label}</span>
    <span class="track"><span class="fill" style="width:${pct}%;background:${color}"></span></span>
    <span class="num">${o} / ${t}</span></div>`;
}
function gradeColorVar(g){return ({"전설":"var(--legend)","영웅":"var(--hero)","희귀":"var(--rare)"})[g]||"var(--accent)";}

/* ====================== BREEDING ====================== */
const fmtTime = s => {
  s = Math.round(s||0);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.round(s/60)}분`;
  const h = Math.floor(s/3600), m = Math.round((s%3600)/60);
  return m ? `${h}시간 ${m}분` : `${h}시간`;
};
const bEls = d => (d.elementNames||[]).map(e=>elBadge(e)).join("");
const bRarity = r => ({3:"희귀",4:"영웅",5:"전설"})[r]||"";
// 교배용 보유 id 집합 (희귀 10종 항상 포함)
const breedOwnedSet = () => Breed.ownedIdSet(Store.list());
// 드래곤 한 마리를 작은 칩으로 (클릭 시 도감 상세)
function bPill(d, ownSet){
  const own = ownSet.has(d.id), inDex = DB.dragons.some(x=>x.name===d.name);
  return `<span class="bpill${own?' owned':''}${inDex?' link':''}"${inDex?` data-dragon="${esc(d.name)}"`:''} title="${esc(d.name)}${inDex?' · 클릭하면 도감 상세':''}">
    <span class="bpill-dot" style="background:${elColor(d.elementNames[0])}"></span>${esc(d.name)}
    <span class="bpill-t">T${d.tier}</span>${own?'<span class="bpill-own">★</span>':''}</span>`;
}
// 기대 횟수·누적 시간 요약
function estStr(p, ft, targetId){
  const e = Breed.expect(p, ft, targetId);
  if(!e) return "";
  const a = e.attempts < 10 ? e.attempts.toFixed(1) : Math.round(e.attempts);
  return `기대 ${a}회 · ${fmtTime(e.total)}`;
}

/* 콤보박스(검색→선택) 헬퍼 */
function makeCombo(inputSel, listSel, getMatches, onPick){
  const inp=$(inputSel), list=$(listSel);
  const draw=()=>{
    const q=inp.value.trim().toLowerCase();
    const items=getMatches(q).slice(0,40);
    list.innerHTML = items.length
      ? items.map(d=>`<button type="button" class="combo-item" data-id="${d.id}">
          <span class="bpill-dot" style="background:${elColor(d.elementNames[0])}"></span>
          <b>${esc(d.name)}</b> <span class="ci-meta">${esc(bRarity(d.rarity))} · T${d.tier} · ${esc(d.elementNames.join("·"))}</span>
        </button>`).join("")
      : `<div class="combo-empty">결과 없음</div>`;
    list.hidden=false;
  };
  inp.addEventListener("input",draw);
  inp.addEventListener("focus",draw);
  list.addEventListener("click",e=>{
    const b=e.target.closest(".combo-item"); if(!b) return;
    onPick(+b.dataset.id); list.hidden=true;
  });
  document.addEventListener("click",e=>{
    if(!e.target.closest(inputSel) && !e.target.closest(listSel)) list.hidden=true;
  });
}

function breedMatches(q, opts={}){
  let list = Breed.all();
  if(opts.parentOnly) list=list.filter(d=>d.canBreedAsParent);
  if(opts.breedableOnly) list=list.filter(d=>d.drop==="breed_normal");
  if(q) list=list.filter(d=>d.name.toLowerCase().includes(q)||d.elementNames.join(" ").toLowerCase().includes(q)||(d.code||"").includes(q));
  return list.sort((a,b)=>a.name.localeCompare(b.name,"ko"));
}

/* ---- 부모로 찾기 ---- */
function renderBreedParent(){
  const s=state.breeding, ownSet=breedOwnedSet(), box=$("#bparent-result");
  const set=(slot,id)=>{ const c=$("#bp"+slot+"-chosen"); const d=id?Breed.byId(id):null;
    c.innerHTML = d ? `${bPill(d,ownSet)} <button class="bx" data-clear="${slot}">✕</button>` : ""; };
  set(1,s.p1); set(2,s.p2);
  $$("#bpanel-parent .bx").forEach(b=>b.onclick=()=>{ s["p"+b.dataset.clear]=null;
    $("#bp"+b.dataset.clear+"-input").value=""; renderBreedParent(); });

  if(!s.p1||!s.p2){ box.innerHTML=`<p class="breed-empty">부모 두 마리를 모두 선택하세요.</p>`; return; }
  if(s.p1===s.p2){ box.innerHTML=`<p class="breed-empty warn">같은 품종끼리는 교배할 수 없습니다. 서로 다른 드래곤을 고르세요.</p>`; return; }
  const a=Breed.byId(s.p1), b=Breed.byId(s.p2);
  const out=Breed.breed(a,b,s.level);
  const rows=Object.keys(out).map(id=>({d:Breed.byId(+id),p:out[id]})).sort((x,y)=>y.p-x.p);
  box.innerHTML=`
    <div class="breed-pairhead">${bPill(a,ownSet)} <span class="breed-x">×</span> ${bPill(b,ownSet)}
      <span class="breed-note">결과 ${rows.length}종 · 확률 합 100%</span></div>
    <div class="table-wrap"><table class="data-table breed-table">
      <thead><tr><th>결과 드래곤</th><th>속성</th><th>등급</th><th>티어</th><th>확률</th>
        <th title="이 결과를 한 번 얻기까지 평균 교배 횟수">기대 횟수</th><th>교배시간</th><th>부화시간</th><th>보유</th></tr></thead>
      <tbody>${rows.map(({d,p})=>{
        const att = p<10 ? (100/p).toFixed(1) : Math.round(100/p);
        return `<tr${ownSet.has(d.id)?' class="is-own"':''}>
        <td class="nm link" data-dragon="${esc(d.name)}">${esc(d.name)}</td>
        <td>${bEls(d)}</td>
        <td>${esc(bRarity(d.rarity))}</td>
        <td class="num">${d.tier}</td>
        <td class="num"><b>${p.toFixed(2)}%</b><span class="pbar"><span style="width:${Math.min(100,p)}%"></span></span></td>
        <td class="num">${att}회</td>
        <td class="num">${fmtTime(d.breedingSeconds)}</td>
        <td class="num">${fmtTime(d.hatchingSeconds)}</td>
        <td>${ownSet.has(d.id)?'★':'—'}</td>
      </tr>`;}).join("")}</tbody>
    </table></div>`;
}

/* ---- 목표로 찾기 ---- */
function bPairLine(a,b,p,ft,ownSet,targetId){
  return `<div class="bpair">
    <span class="bpair-parents">${bPill(Breed.byId(a),ownSet)} <span class="breed-x">×</span> ${bPill(Breed.byId(b),ownSet)}</span>
    <span class="bpair-stat"><b class="prob">${p.toFixed(2)}%</b>
      <span class="ft">${esc(estStr(p,ft,targetId))}</span></span>
  </div>`;
}
function renderBreedTarget(){
  const s=state.breeding, ownSet=breedOwnedSet();
  // 칩
  $("#btarget-chosen").innerHTML = s.targets.length
    ? s.targets.map(id=>{const d=Breed.byId(id);
        return `<span class="tchip" style="--el:${elColor(d.elementNames[0])}">${esc(d.name)} <span class="tchip-t">T${d.tier}</span><button class="bx" data-del="${id}">✕</button></span>`;}).join("")
      + `<button class="btn btn-sm tclear" id="btarget-clear">모두 비우기</button>`
    : `<span class="breed-empty">아직 선택한 목표가 없습니다.</span>`;
  $$("#btarget-chosen .bx").forEach(b=>b.onclick=()=>{ s.targets=s.targets.filter(x=>x!==+b.dataset.del); renderBreedTarget(); });
  const clr=$("#btarget-clear"); if(clr) clr.onclick=()=>{ s.targets=[]; renderBreedTarget(); };

  const box=$("#btarget-result");
  if(!s.targets.length){ box.innerHTML=""; return; }

  const pool=Breed.parentPool(ownSet, s.ownedOnly);
  const startIds=[...ownSet];
  let html="";

  // 1) 개별 최적 조합
  const direct={}; // id -> combos
  html+=`<div class="breed-sec"><h3>개별 최적 조합 <small>${s.ownedOnly?'보유 부모 기준':'전체 드래곤 기준'}</small></h3>`;
  for(const t of s.targets){
    const d=Breed.byId(t);
    const combos=Breed.combosForTarget(t,pool,s.level,8);
    direct[t]=combos;
    if(combos.length){
      const top=combos[0];
      html+=`<div class="breed-card">
        <div class="bc-head">${bPill(d,ownSet)} <span class="bc-meta">가능 조합 ${combos.length}쌍 · 최고 <b>${top.p.toFixed(2)}%</b> · ${esc(estStr(top.p,top.ft,t))}</span></div>
        <div class="bc-list">${combos.map(c=>bPairLine(c.a,c.b,c.p,c.ft,ownSet,t)).join("")}</div>
      </div>`;
    } else {
      html+=`<div class="breed-card no">
        <div class="bc-head">${bPill(d,ownSet)} <span class="bc-meta warn">${s.ownedOnly?'보유 부모로 직접 만들 수 있는 조합이 없습니다':'직접 교배 조합이 없습니다'}</span></div>
      </div>`;
    }
  }
  html+=`</div>`;

  // 2) 동시 교배 (2마리 이상)
  if(s.targets.length>=2){
    const sim=Breed.bestSimultaneous(s.targets,pool,s.level);
    const all=sim.covered.size===s.targets.length;
    const ests=sim.plan.map(x=>Breed.expect(x.p,x.ft,x.target)||{total:0});
    const parallel=ests.reduce((m,e)=>Math.max(m,e.total),0);   // 동시 진행 → 가장 느린 칸
    const sumTime=ests.reduce((a,e)=>a+e.total,0);               // 누적 교배시간 합
    html+=`<div class="breed-sec"><h3>동시 교배 분석 <small>부모를 겹치지 않게 동시에</small></h3>`;
    html+=`<div class="sim-banner ${all?'ok':'warn'}">${all
      ? `✅ 선택한 ${s.targets.length}마리 <b>모두 동시 교배 가능</b>합니다.`
      : `⚠️ ${s.targets.length}마리 동시 교배는 <b>불가능</b>합니다. 부모가 겹치지 않게 만들 수 있는 최대치는 <b>${sim.covered.size}마리</b>입니다.`}
      ${sim.plan.length?`<span class="sim-ft">병렬 예상 완료 ~${fmtTime(parallel)} · 누적 교배시간 ~${fmtTime(sumTime)}</span>`:''}</div>`;
    if(sim.plan.length){
      html+=`<div class="sim-grid">${sim.plan.map(x=>`
        <div class="sim-slot">
          <div class="sim-target">${bPill(Breed.byId(x.target),ownSet)}</div>
          <div class="sim-recipe">${bPill(Breed.byId(x.a),ownSet)} <span class="breed-x">×</span> ${bPill(Breed.byId(x.b),ownSet)}</div>
          <div class="sim-prob"><b>${x.p.toFixed(2)}%</b> · ${esc(estStr(x.p,x.ft,x.target))}</div>
        </div>`).join("")}</div>`;
    }
    const excluded=s.targets.filter(t=>!sim.covered.has(t));
    if(excluded.length){
      html+=`<div class="sim-excluded"><b>이번에 제외된 목표:</b> ${excluded.map(t=>{
        const noCombo=sim.impossible.includes(t);
        return `<span class="exc">${esc(Breed.byId(t).name)} <small>(${noCombo?'가능 조합 없음':'부모 충돌'})</small></span>`;
      }).join(" ")}</div>`;
    }
    html+=`</div>`;
  }

  // 3) 보유분으로 직접 불가 → 교배 순서(루트)
  const needRoute=s.targets.filter(t=>!(direct[t]&&direct[t].length));
  if(needRoute.length){
    html+=`<div class="breed-sec"><h3>최적 교배 순서 <small>보유분으로 직접 못 만드는 목표</small></h3>`;
    for(const t of needRoute){
      const d=Breed.byId(t);
      const steps=Breed.route(t,startIds,s.level);
      if(steps&&steps.length){
        let routeTotal=0;
        const lis=steps.map(st=>{
          const out=Breed.breed(Breed.byId(st.a),Breed.byId(st.b),s.level);
          const ft=Breed.failTime(out,st.result);
          const e=Breed.expect(st.p,ft,st.result); if(e) routeTotal+=e.total;
          const att = st.p>=99.99 ? "1회" : (st.p<10?(100/st.p).toFixed(1):Math.round(100/st.p))+"회";
          return `<li>
            ${bPill(Breed.byId(st.a),ownSet)} <span class="breed-x">×</span> ${bPill(Breed.byId(st.b),ownSet)}
            <span class="route-arrow">→</span> ${bPill(Breed.byId(st.result),ownSet)}
            <span class="route-p">${st.p.toFixed(2)}% · 기대 ${att}</span></li>`;
        }).join("");
        html+=`<div class="route-card">
          <div class="bc-head">${bPill(d,ownSet)} <span class="bc-meta">${steps.length}단계 — 중간 드래곤을 먼저 교배하세요 · 누적 교배시간 ~${fmtTime(routeTotal)}</span></div>
          <ol class="route-steps">${lis}</ol>
        </div>`;
      } else {
        html+=`<div class="route-card no"><div class="bc-head">${bPill(d,ownSet)}
          <span class="bc-meta warn">현재 보유(+희귀 기본)로는 도달할 수 없습니다. 필요한 부모 드래곤을 추가로 확보해야 합니다.</span></div></div>`;
      }
    }
    html+=`</div>`;
  }

  box.innerHTML=html;
}

function renderBreeding(){
  const s=state.breeding;
  // 모드 전환
  $$("#breed-modes .bmode").forEach(b=>b.classList.toggle("active",b.dataset.bmode===s.mode));
  $("#bpanel-target").hidden = s.mode!=="target";
  $("#bpanel-parent").hidden = s.mode!=="parent";
  // 보유 요약
  const ownSet=breedOwnedSet();
  $("#breed-own").innerHTML=`보유 부모풀 <b>${Breed.parentPool(ownSet,true).length}</b>종 <small>(희귀 10종 기본 포함)</small>`;
  if(s.mode==="target") renderBreedTarget(); else renderBreedParent();
}

function initBreeding(){
  const s=state.breeding;
  Breed.load(DB.breeding_dragons);
  // 드래곤 칩/이름 클릭 → 도감 상세 (이벤트 위임)
  $("#view-breeding").addEventListener("click",e=>{
    if(e.target.closest(".bx")||e.target.closest(".combo-item")) return;
    const el=e.target.closest("[data-dragon]");
    if(el) openDragon(el.dataset.dragon);
  });
  // 모드
  $$("#breed-modes .bmode").forEach(b=>b.onclick=()=>{ s.mode=b.dataset.bmode; renderBreeding(); });
  // 컨텍스트
  $("#breed-level").addEventListener("input",e=>{ s.level=Math.max(1,Math.min(99,+e.target.value||1)); renderBreeding(); });
  $("#breed-ownedonly").addEventListener("change",e=>{ s.ownedOnly=e.target.checked; renderBreeding(); });
  // 목표 콤보
  makeCombo("#btarget-input","#btarget-list",
    q=>breedMatches(q,{breedableOnly:true}).filter(d=>!s.targets.includes(d.id)),
    id=>{ if(!s.targets.includes(id)) s.targets.push(id); $("#btarget-input").value=""; renderBreedTarget(); });
  // 부모 콤보 ×2
  makeCombo("#bp1-input","#bp1-list", q=>breedMatches(q,{parentOnly:true}), id=>{ s.p1=id; $("#bp1-input").value=""; renderBreedParent(); });
  makeCombo("#bp2-input","#bp2-list", q=>breedMatches(q,{parentOnly:true}), id=>{ s.p2=id; $("#bp2-input").value=""; renderBreedParent(); });
  renderBreeding();
}

/* ====================== TYPES (상성) ====================== */
const TYPE_SYM = { strong:"◎", normal:"·", weak:"▽", veryweak:"▼" };
const lvl = (atk,def) => (DB.type_chart.chart[atk] && DB.type_chart.chart[atk][def]) || "normal";

// 한 속성 기준 공격/방어 상성 분류
function typeRelations(el){
  const order=DB.type_chart.order;
  const atk={strong:[],weak:[],veryweak:[]};
  order.forEach(d=>{ const l=lvl(el,d); if(atk[l]) atk[l].push(d); });
  const def={strong:[],weak:[],veryweak:[]};       // strong=내가 굉장하게 맞는 약점
  order.forEach(a=>{ const l=lvl(a,el); if(def[l]) def[l].push(a); });
  return {atk,def};
}
const elList = (arr)=>arr.length?arr.map(e=>elBadge(e)).join(" "):'<span class="muted">—</span>';

function focusCard(el){
  const r=typeRelations(el);
  return `<div class="tf-card">
    <div class="tf-head">${elBadge(el)} <b>${esc(el)}</b> 속성 상성</div>
    <div class="tf-grid">
      <div class="tf-col"><h4>⚔️ 이 속성으로 공격할 때</h4>
        <div class="tf-row"><span class="tf-k strong">굉장함</span>${elList(r.atk.strong)}</div>
        <div class="tf-row"><span class="tf-k weak">별로</span>${elList(r.atk.weak)}</div>
        <div class="tf-row"><span class="tf-k veryweak">매우 별로</span>${elList(r.atk.veryweak)}</div>
      </div>
      <div class="tf-col"><h4>🛡️ 이 속성으로 맞을 때</h4>
        <div class="tf-row"><span class="tf-k strong">약점(굉장히 맞음)</span>${elList(r.def.strong)}</div>
        <div class="tf-row"><span class="tf-k weak">저항(별로)</span>${elList(r.def.weak)}</div>
        <div class="tf-row"><span class="tf-k veryweak">강저항(매우 별로)</span>${elList(r.def.veryweak)}</div>
      </div>
    </div>
  </div>`;
}

function renderTypes(){
  const order=DB.type_chart.order, focus=state.types.focus;
  // 칩
  buildElementChips("#type-chips",order,()=>state.types.focus,v=>{state.types.focus=v;renderTypes();});
  // 범례
  $("#type-legend").innerHTML=Object.entries(DB.type_chart.levels).map(([k,v])=>
    `<span class="tl"><span class="tcell ${k}">${TYPE_SYM[k]}</span>${esc(v.label)}${v.mult?` <small>(${esc(v.mult)})</small>`:''}</span>`).join("");
  // 포커스 카드
  $("#type-focus").innerHTML = focus ? focusCard(focus) : "";
  // 매트릭스
  const head=`<thead><tr><th class="corner">공격＼방어</th>${order.map(d=>
    `<th class="${focus&&d===focus?'col-focus':''}">${elBadge(d)}</th>`).join("")}</tr></thead>`;
  const body=`<tbody>${order.map(a=>{
    const rf=focus&&a===focus;
    return `<tr class="${rf?'row-focus':''}"><th class="rowh">${elBadge(a)}</th>${order.map(d=>{
      const l=lvl(a,d), hot=focus&&(a===focus||d===focus);
      return `<td class="tcell ${l}${hot?' hot':''}" title="${esc(a)}→${esc(d)}: ${esc(DB.type_chart.levels[l].label)}">${TYPE_SYM[l]}</td>`;
    }).join("")}</tr>`;
  }).join("")}</tbody>`;
  $("#type-matrix").innerHTML=head+body;
}

// 드래곤 상세용 상성 섹션 (element + subElements)
function typeSectionFor(d){
  if(!DB.type_chart) return "";
  const els=[d.element,...(d.subElements||[])].filter(e=>DB.type_chart.order.includes(e));
  if(!els.length) return "";
  const blocks=els.map(el=>{
    const r=typeRelations(el);
    const line=(label,arr,cls)=>`<div class="tf-row"><span class="tf-k ${cls}">${label}</span>${elList(arr)}</div>`;
    return `<div class="m-type-block">
      <div class="m-type-el">${elBadge(el)}</div>
      <div class="m-type-lines">
        <div class="m-type-sub">공격</div>
        ${line("굉장함",r.atk.strong,"strong")}${line("약함",r.atk.weak.concat(r.atk.veryweak),"weak")}
        <div class="m-type-sub">방어 약점</div>
        ${line("굉장히 맞음",r.def.strong,"strong")}${line("저항",r.def.weak.concat(r.def.veryweak),"weak")}
      </div></div>`;
  }).join("");
  return `<div class="m-section"><h4>속성 상성</h4>${blocks}
    ${els.length>1?'<small class="muted">다속성 드래곤은 인게임에서 속성별 상성이 합산 적용됩니다. 위는 속성별 개별 표기입니다.</small>':''}</div>`;
}

/* ====================== AUTH UI ====================== */
function renderAuthBox(){
  const box=$("#auth-box");
  if(Store.isCloud()){
    box.innerHTML=`<span class="user-email">${esc(Store.getUser().email)}</span><button class="btn btn-sm" id="btn-logout">로그아웃</button>`;
    $("#btn-logout").onclick=()=>Store.signOut();
  } else if(Store.isConfigured()){
    box.innerHTML=`<span class="guest-chip" title="로그인은 선택입니다. 보유 현황은 이 브라우저에 저장됩니다">게스트</span><button class="btn btn-sm btn-primary" id="btn-login">로그인</button>`;
    $("#btn-login").onclick=openAuth;
  } else {
    box.innerHTML=`<span class="guest-chip" title="config.js에 Supabase 키를 넣으면 로그인이 켜집니다">게스트 · 로컬 저장</span>`;
  }
}
function openAuth(){ $("#auth-msg").textContent=""; $("#auth-modal").hidden=false; document.body.style.overflow="hidden"; }
function closeAuth(){ $("#auth-modal").hidden=true; document.body.style.overflow=""; }
function authMsg(t,err){ const m=$("#auth-msg"); m.textContent=t; m.classList.toggle("err",!!err); }

function bindAuth(){
  $("#auth-close").onclick=closeAuth;
  $("#auth-modal").addEventListener("click",e=>{if(e.target.id==="auth-modal")closeAuth();});
  $("#auth-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("#auth-email").value.trim(), pw=$("#auth-password").value;
    authMsg("로그인 중…");
    const { error }=await Store.signIn(email,pw);
    if(error) authMsg(error.message,true); else closeAuth();
  });
  $("#auth-signup").onclick=async()=>{
    const email=$("#auth-email").value.trim(), pw=$("#auth-password").value;
    if(!email||pw.length<6){authMsg("이메일과 6자 이상 비밀번호를 입력하세요.",true);return;}
    authMsg("가입 중…");
    const { data, error }=await Store.signUp(email,pw);
    if(error) authMsg(error.message,true);
    else if(data.session) closeAuth();
    else authMsg("확인 메일을 보냈습니다. 메일의 링크를 눌러 인증을 완료하세요.");
  };
  $("#auth-google").onclick=async()=>{
    authMsg("Google 로그인으로 이동…");
    const { error }=await Store.signInGoogle();
    if(error) authMsg(error.message,true);
  };
  $("#auth-guest").onclick=closeAuth;
}

/* ===== MODAL ===== */
function openModal(){$("#modal").hidden=false;document.body.style.overflow="hidden";}
function closeModal(){$("#modal").hidden=true;document.body.style.overflow="";}

/* ===== 이벤트 바인딩 ===== */
function bind(){
  const d=state.dragons;
  $("#dragon-search").addEventListener("input",e=>{d.search=e.target.value;renderDragons();});
  $("#dragon-owned").addEventListener("change",e=>{d.owned=e.target.value;renderDragons();});
  $("#dragon-grade").addEventListener("change",e=>{d.grade=e.target.value;renderDragons();});
  $("#dragon-attack").addEventListener("change",e=>{d.attack=e.target.value;renderDragons();});
  $("#dragon-source").addEventListener("change",e=>{d.source=e.target.value;renderDragons();});
  $("#dragon-sort").addEventListener("change",e=>{d.sort=e.target.value;renderDragons();});

  const o=state.orbs;
  $("#orb-search").addEventListener("input",e=>{o.search=e.target.value;renderOrbs();});
  $("#orb-grade").addEventListener("change",e=>{o.grade=e.target.value;renderOrbs();});
  $("#orb-type").addEventListener("change",e=>{o.type=e.target.value;renderOrbs();});
  $("#orb-sort").addEventListener("change",e=>{o.sort=e.target.value;renderOrbs();});

  $("#ability-search").addEventListener("input",e=>{state.abilities.search=e.target.value;renderAbilities();});

  $("#modal-close").addEventListener("click",closeModal);
  $("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeAuth();}});
}

/* ===== INIT ===== */
async function init(){
  try{ await loadAll(); }
  catch(err){
    document.querySelector("main").innerHTML=`<div style="padding:40px;text-align:center;color:var(--muted)">
      <h2 style="color:var(--text);margin-bottom:10px">데이터를 불러오지 못했습니다</h2>
      <p>${esc(err.message)}</p>
      <p style="margin-top:14px">로컬에서 열 때는 정적 서버가 필요합니다:<br>
      <code style="color:var(--accent2)">python3 -m http.server</code> 실행 후 <code>localhost:8000</code> 접속</p></div>`;
    return;
  }
  initTabs(); bind(); bindAuth();

  // 저장소(인증·보유현황) 초기화 + 변경 반영
  await Store.init();
  Store.on("change",()=>{ renderDragons(); renderCollection(); renderBreeding(); });
  Store.on("auth",()=>{ renderAuthBox(); renderCollection(); });

  // 카운트
  $("#cnt-dragons").textContent=DB.dragons.length;
  $("#cnt-orbs").textContent=DB.orbs.length;
  $("#cnt-abilities").textContent=DB.abilities.length;

  // 셀렉트 옵션
  fillSelect($("#dragon-grade"),[...new Set(DB.dragons.map(d=>d.grade))]);
  fillSelect($("#dragon-source"),[...new Set(DB.dragons.map(d=>d.source))].sort((a,b)=>a.localeCompare(b,"ko")));
  fillSelect($("#orb-grade"),[...new Set(DB.orbs.map(o=>o.grade))]);

  // 속성칩
  const dEls=ELEMENT_ORDER.filter(e=>DB.dragons.some(d=>d.element===e));
  const oEls=ELEMENT_ORDER.filter(e=>DB.orbs.some(o=>o.element===e));
  buildElementChips("#dragon-elements",dEls,()=>state.dragons.element,v=>{state.dragons.element=v;renderDragons();});
  buildElementChips("#orb-elements",oEls,()=>state.orbs.element,v=>{state.orbs.element=v;renderOrbs();});

  renderAuthBox();
  renderDragons(); renderOrbs(); renderAbilities(); renderCodex(); renderCollection();
  initBreeding(); renderTypes();
}
document.addEventListener("DOMContentLoaded",init);
