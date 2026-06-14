"use strict";
/* ============================================================
 * Breed — DV3 교배 계산 엔진
 *  - 명세서(에이전트 인수인계용) 8장 Python 엔진을 그대로 포팅
 *  - 데이터: data/breeding_dragons.json (113종, 교배 스키마)
 *  - 도감(dragons.json)과 이름이 100% 일치 → 보유 현황 연동
 * ========================================================== */
const Breed = (() => {
  let DRAGONS = [], BYID = {}, BYNAME = {};
  // 티어별 고정확률 예산 (basis point; bp/100 = %)
  const TIER_MAX = { 1:0, 2:0, 3:0, 4:0, 5:1000, 6:600, 7:300, 8:150, 9:0, 10:0 };

  const load = (data) => {
    DRAGONS = data; BYID = {}; BYNAME = {};
    for (const d of data) { BYID[d.id] = d; BYNAME[d.name] = d; }
  };

  /* ---- 조합 키: 부모 합집합 속성의 크기 1~3 부분조합 ---- */
  const comboKeys = (a, b) => {
    const union = [...new Set([...a.elementIds, ...b.elementIds])].sort((x, y) => x - y);
    const keys = new Set();
    const n = union.length, maxK = Math.min(3, n);
    const rec = (start, k, acc) => {
      if (acc.length === k) { keys.add(acc.join("-")); return; }
      for (let i = start; i < n; i++) rec(i + 1, k, [...acc, union[i]]);
    };
    for (let k = 1; k <= maxK; k++) rec(0, k, []);
    return { keys, ecount: union.length };
  };

  /* ---- 교배 가능 판정 (null=가능, 문자열=불가 사유) ---- */
  const eligible = (t, a, b, keys, ecount, userLevel) => {
    if ((t.requireUserLevel || 0) > userLevel) return "테이머 레벨";
    if (t.requireParentElementRule && !keys.has(t.sortedElementIds.join("-"))) return "속성 조합";
    if (t.elementIds.length >= 3 && (a.elementIds.length < 2 || b.elementIds.length < 2)) return "3속성 부모";
    if (ecount < (t.parentElementCount || 0)) return "부모 속성 수";
    for (const x of (t.parentElementRequirementIds || [])) if (!keys.has(String(x))) return "필수 속성";
    for (const x of (t.parentDidRequirements || [])) if (x !== a.id && x !== b.id) return "필수 부모";
    return null;
  };

  /* ---- 확률 모델: 부모(a,b) -> { dragonId: 확률% }, 합 100% ---- */
  const breed = (a, b, userLevel = 99, allowSame = false) => {
    if (!allowSame && a.id === b.id) return {};
    const { keys, ecount } = comboKeys(a, b);
    const fixed = {};        // tier -> { id: fixedProportion(bp) }
    const portion = [];
    for (const r of DRAGONS) {
      if (eligible(r, a, b, keys, ecount, userLevel) !== null) continue;
      const fp = r.fixedProportion || 0;
      if (fp > 0) { (fixed[r.tier] = fixed[r.tier] || {})[r.id] = fp; }
      else portion.push(r);
    }
    const res = {};
    let totalFixed = 0;
    for (const tier in fixed) {
      const m = fixed[tier], budget = TIER_MAX[tier];
      const o = Object.values(m).reduce((s, v) => s + v, 0);
      const scale = (budget != null && o > budget && o > 0) ? budget / o : 1;
      for (const did in m) { const c = m[did] * scale / 100; res[did] = c; totalFixed += c; }
    }
    const p = Math.max(0, 100 - totalFixed);
    const h = portion.reduce((s, d) => s + (d.portion || 0), 0);
    for (const d of portion) {
      const w = d.portion || 0;
      res[d.id] = h > 0 ? (w / h * p) : 0;
    }
    const out = {};
    for (const k in res) if (res[k] > 0) out[k] = res[k];
    return out;
  };

  /* ---- 실패(타깃 아님) 시 교배시간 기댓값(초) ---- */
  const failTime = (out, targetId) => {
    const p = out[targetId] || 0, denom = 100 - p;
    if (denom <= 0) return 0;
    let s = 0;
    for (const did in out) {
      if (+did === targetId) continue;
      s += (out[did] / denom) * (BYID[did].breedingSeconds || 0);
    }
    return s;
  };

  /* ---- 성공까지 기대 교배 횟수 & 누적 교배시간 추정 ----
   * 기하분포: 기대 시도수 = 100/p, 실패수 = (100-p)/p
   * 누적시간 ≈ 실패수 × (실패 1회 평균 교배시간) + 성공 1회(타깃 교배시간)
   */
  const expect = (p, ft, targetId) => {
    if (!p || p <= 0) return null;
    const attempts = 100 / p;
    const total = ((100 - p) / p) * ft + ((BYID[targetId] && BYID[targetId].breedingSeconds) || 0);
    return { attempts, total };
  };

  /* ============================================================
   *  상위 헬퍼
   * ========================================================== */
  const rareIds = () => DRAGONS.filter(d => d.rarity === 3).map(d => d.id);

  // 보유 이름 → 보유 id 집합 (희귀 10종은 항상 포함)
  const ownedIdSet = (ownedNames) => {
    const s = new Set(rareIds());
    for (const nm of ownedNames) { const d = BYNAME[nm]; if (d) s.add(d.id); }
    return s;
  };

  // 부모로 쓸 수 있는 id 목록
  const parentPool = (ownedSet, ownedOnly) =>
    DRAGONS.filter(d => d.canBreedAsParent && (!ownedOnly || ownedSet.has(d.id))).map(d => d.id);

  // 한 타깃을 만드는 모든 부모쌍 (확률 desc, 실패시간 asc)
  const combosForTarget = (targetId, parentIds, userLevel, limit = 0) => {
    const out = [];
    for (let i = 0; i < parentIds.length; i++) {
      const a = BYID[parentIds[i]];
      for (let j = i + 1; j < parentIds.length; j++) {
        const b = BYID[parentIds[j]];
        const r = breed(a, b, userLevel);
        const p = r[targetId] || 0;
        if (p <= 0) continue;
        out.push({ a: a.id, b: b.id, p, ft: failTime(r, targetId) });
      }
    }
    out.sort((x, y) => (y.p - x.p) || (x.ft - y.ft));
    return limit ? out.slice(0, limit) : out;
  };

  /* ---- 여러 타깃 동시 교배(부모 전부 상이) 최적 배정 ----
   * 반환: { plan:[{target,a,b,p,ft}], covered:Set, impossible:[ids] }
   * 우선순위: 커버 수 max → 총 실패시간 min → 총 확률 max
   */
  const bestSimultaneous = (targetIds, parentIds, userLevel, perCap = 30) => {
    const cand = {}, impossible = [];
    for (const t of targetIds) {
      const c = combosForTarget(t, parentIds, userLevel, perCap);
      if (c.length === 0) impossible.push(t); else cand[t] = c;
    }
    const solvable = targetIds.filter(t => cand[t]);
    const n = solvable.length;
    let best = { count: -1, ft: Infinity, prob: -1, assign: null };
    const used = new Set();
    const dfs = (i, count, ft, prob, assign) => {
      if (count + (n - i) < best.count) return;             // 커버 수 상한 가지치기
      if (i === n) {
        if (count > best.count ||
           (count === best.count && (ft < best.ft - 1e-9 ||
           (Math.abs(ft - best.ft) < 1e-9 && prob > best.prob))))
          best = { count, ft, prob, assign: assign.slice() };
        return;
      }
      const t = solvable[i];
      for (const c of cand[t]) {
        if (used.has(c.a) || used.has(c.b)) continue;
        used.add(c.a); used.add(c.b);
        assign.push({ target: t, a: c.a, b: c.b, p: c.p, ft: c.ft });
        dfs(i + 1, count + 1, ft + c.ft, prob + c.p, assign);
        assign.pop(); used.delete(c.a); used.delete(c.b);
      }
      dfs(i + 1, count, ft, prob, assign);                  // 이 타깃 건너뛰기
    };
    dfs(0, 0, 0, 0, []);
    const plan = best.assign || [];
    const covered = new Set(plan.map(x => x.target));
    return { plan, covered, impossible };
  };

  /* ---- 보유분으로 직접 못 만들 때: 최적 교배 순서(루트) ----
   * startIds 에서 출발, 새로 만들 수 있는 드래곤을 부모로 추가하며 BFS 폐포.
   * 반환: 의존성 순서의 steps[{result,a,b,p}] 또는 null(도달 불가)
   */
  const route = (targetId, startIds, userLevel, maxRounds = 12) => {
    const available = new Set(startIds.filter(id => BYID[id] && BYID[id].canBreedAsParent));
    const obtainable = new Set(startIds);
    const recipe = {};        // id -> {a,b,p}
    let changed = true, rounds = 0;
    while (changed && rounds < maxRounds && !obtainable.has(targetId)) {
      changed = false; rounds++;
      const avail = [...available];
      for (let i = 0; i < avail.length; i++) {
        for (let j = i + 1; j < avail.length; j++) {
          const r = breed(BYID[avail[i]], BYID[avail[j]], userLevel);
          for (const id in r) {
            const idn = +id, p = r[id];
            if (obtainable.has(idn)) continue;
            recipe[idn] = { a: avail[i], b: avail[j], p };
            obtainable.add(idn); changed = true;
            if (BYID[idn].canBreedAsParent) available.add(idn);
          }
        }
      }
    }
    if (!obtainable.has(targetId)) return null;
    const steps = [], done = new Set(startIds);
    const build = (id) => {
      if (done.has(id)) return;
      const r = recipe[id]; if (!r) { done.add(id); return; }
      build(r.a); build(r.b);
      steps.push({ result: id, a: r.a, b: r.b, p: r.p });
      done.add(id);
    };
    build(targetId);
    return steps;
  };

  const all = () => DRAGONS;
  const byId = (id) => BYID[id];
  const byName = (nm) => BYNAME[nm];

  return { load, breed, failTime, expect, comboKeys, eligible,
           rareIds, ownedIdSet, parentPool, combosForTarget,
           bestSimultaneous, route, all, byId, byName, TIER_MAX };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Breed;

