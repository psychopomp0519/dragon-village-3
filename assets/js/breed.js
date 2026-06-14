"use strict";
/* ============================================================
 * Breed — DV3 교배 계산 엔진
 *  - 명세서(에이전트 인수인계용) 8장 Python 엔진을 그대로 포팅
 *  - 데이터: data/breeding_dragons.json (113종, 교배 스키마)
 *  - 도감(dragons.json)과 이름이 100% 일치 → 보유 현황 연동
 * ========================================================== */
const Breed = (() => {
  let DRAGONS = [], BYID = {}, BYNAME = {};
  let PICKUP = new Set();   // 픽업(확률업) 드래곤 id 집합
  // 티어별 고정확률 예산 (basis point; bp/100 = %)
  const TIER_MAX = { 1:0, 2:0, 3:0, 4:0, 5:1000, 6:600, 7:300, 8:150, 9:0, 10:0 };

  const load = (data) => {
    DRAGONS = data; BYID = {}; BYNAME = {};
    for (const d of data) { BYID[d.id] = d; BYNAME[d.name] = d; }
  };

  /* ---- 픽업(확률업) 설정: 이름 배열 → id 집합 ---- */
  const setPickup = (names) => {
    PICKUP = new Set();
    for (const nm of (names || [])) { const d = BYNAME[nm]; if (d) PICKUP.add(d.id); }
  };
  const getPickupNames = () => [...PICKUP].map(id => BYID[id] && BYID[id].name).filter(Boolean);
  const isPickup = (id) => PICKUP.has(id);

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
      for (const did in m) {
        const fp = m[did];
        let c = fp * scale / 100;
        if (PICKUP.has(+did)) c += fp * 0.5 / 100;   // 픽업: 기본 고정확률의 절반 가산 (dv3guide be 함수)
        res[did] = c; totalFixed += c;
      }
    }
    const p = Math.max(0, 100 - totalFixed);
    // 픽업 가중치 드래곤은 weight ×2.5 (portion + portion×1.5)
    const wt = d => (d.portion || 0) * (PICKUP.has(d.id) ? 2.5 : 1);
    const h = portion.reduce((s, d) => s + wt(d), 0);
    for (const d of portion) {
      res[d.id] = h > 0 ? (wt(d) / h * p) : 0;
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

  /* ---- 여러 타깃을 '하나의 부모 조합'으로 모두 얻을 수 있는지 ----
   * 부모쌍 하나의 결과 풀에 선택한 타깃들이 모두(또는 최대한 많이) 포함되는지 탐색.
   * 반환: { pairs:[{a,b,probs:{tid:p},count,minP,sumP}], n, maxCount, impossible:[tid] }
   * 정렬: 포함 수 desc → 최저확률(병목) desc → 확률합 desc
   */
  const commonPairs = (targetIds, parentIds, userLevel, limit = 30) => {
    const tset = targetIds;
    const everProduced = new Set();
    let out = [];
    for (let i = 0; i < parentIds.length; i++) {
      const a = BYID[parentIds[i]];
      for (let j = i + 1; j < parentIds.length; j++) {
        const b = BYID[parentIds[j]];
        const r = breed(a, b, userLevel);
        const probs = {}; let count = 0, minP = Infinity, sumP = 0;
        for (const t of tset) {
          const p = r[t] || 0;
          if (p > 0) { probs[t] = p; count++; sumP += p; if (p < minP) minP = p; everProduced.add(t); }
        }
        if (count > 0) out.push({ a: a.id, b: b.id, probs, count, minP: count ? minP : 0, sumP });
      }
    }
    out.sort((x, y) => (y.count - x.count) || (y.minP - x.minP) || (y.sumP - x.sumP));
    const maxCount = out.length ? out[0].count : 0;
    const impossible = tset.filter(t => !everProduced.has(t));
    return { pairs: limit ? out.slice(0, limit) : out, n: tset.length, maxCount, impossible };
  };

  /* ---- n배럭 조합기: 부모가 겹치지 않는 n개 배럭으로 1~2마리 노리기 ----
   * 그리디: 매 배럭마다 '기대 성공 증가분(failProb_t × p)'이 최대인 타깃·조합 선택.
   * 1마리면 확률 높은 서로소 조합 n개, 2마리면 두 타깃에 자동 배분.
   * 반환: { perTarget:[{target,picks:[{a,b,p,ft}],successPct,barracks}], used, requested }
   */
  const barracks = (targetIds, n, parentIds, userLevel) => {
    const cand = {};
    for (const t of targetIds) cand[t] = combosForTarget(t, parentIds, userLevel);
    const used = new Set(), failP = {};
    for (const t of targetIds) failP[t] = 1;
    const picks = [];
    for (let step = 0; step < n; step++) {
      let best = null, bestGain = -1;
      for (const t of targetIds) {
        for (const c of cand[t]) {
          if (used.has(c.a) || used.has(c.b)) continue;
          const gain = failP[t] * (c.p / 100);
          if (gain > bestGain) { bestGain = gain; best = { t, c }; }
          break;                                  // cand 내림차순 → 첫 비충돌이 그 타깃 최선
        }
      }
      if (!best || bestGain <= 0) break;
      used.add(best.c.a); used.add(best.c.b);
      failP[best.t] *= (1 - best.c.p / 100);
      picks.push({ target: best.t, a: best.c.a, b: best.c.b, p: best.c.p, ft: best.c.ft });
    }
    const perTarget = targetIds.map(t => {
      const ps = picks.filter(x => x.target === t);
      const success = (1 - ps.reduce((m, x) => m * (1 - x.p / 100), 1)) * 100;
      return { target: t, picks: ps, successPct: success, barracks: ps.length };
    });
    return { perTarget, used: picks.length, requested: n };
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
           commonPairs, barracks, route, all, byId, byName, TIER_MAX,
           setPickup, getPickupNames, isPickup };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Breed;

