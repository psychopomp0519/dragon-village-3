# 드래곤빌리지3 도감 사이트 — 에이전트 인수인계 문서

> 이 문서 하나로 새 에이전트가 이 프로젝트의 목적·구조·데이터·엔진·배포·주의사항을 완전히 파악하고 이어서 작업할 수 있다.
> 기준일: 2026-08-02. 라이브/저장소가 이 문서와 충돌하면 **코드·데이터 파일이 정답**이다.

---

## 0. 한눈에 보기

- **무엇**: 모바일 게임 "드래곤빌리지3(DV3)"의 비공식 팬 도감 + **교배 계산기** 웹사이트. 순수 정적 사이트(빌드 없음).
- **라이브**: https://dragon-village-3.pages.dev (Cloudflare Pages)
- **저장소**: GitHub `psychopomp0519/dragon-village-3`
- **작업 브랜치**: `claude/dragon-village-3-site-qgwjyl` (기본 브랜치 아님)
- **PR**: #1 (https://github.com/psychopomp0519/dragon-village-3/pull/1). 이 브랜치에 push하면 PR이 갱신된다. **새 PR 만들지 말 것.**
- **탭 8개**: 드래곤 · 보주 · 특성 · 교배 🧬 · 상성 ⚔️ · 요청 ✍️ · 내 컬렉션 · 요약·용어
- **데이터 규모**: 드래곤 121종 · 보주 72종 · 특성 57종(동적) · 교배 드래곤 121종 · 14속성 상성표
- **백엔드**: Supabase(선택). 없으면 게스트(로컬) 모드로 완전 동작. 로그인·클라우드 동기화·픽업·요청 기능만 Supabase 필요.

---

## 1. 기술 스택 & 아키텍처

- **프론트엔드**: 순수 HTML/CSS/Vanilla JS. 프레임워크·번들러·빌드 단계 **없음**. `index.html`이 `data/*.json`을 `fetch`해서 렌더.
- **호스팅**: Cloudflare Pages (프로젝트명 `dragon-village-3`). `wrangler pages deploy`로 배포.
- **백엔드(선택)**: Supabase (Postgres + Auth + RLS). `assets/js/config.js`에 URL/anon key가 있으면 "클라우드 모드"(로그인·동기화), 없으면 게스트 모드.
- **외부 CDN**: `@supabase/supabase-js@2`(jsdelivr), Google Fonts(Noto Sans KR). CSP 없음.
- **테마**: 라이트 테마. CSS 변수는 `:root`에 정의(`assets/css/style.css` 최상단).

### 정적 사이트의 핵심 제약 (중요)
런타임에 서버 파일을 쓸 수 없다. 그래서:
- 신규 드래곤/보주는 보통 **개발자가 `data/*.json`을 직접 수정 → 커밋 → 재배포**.
- 사용자 "요청 승인 등록"은 파일을 고치는 게 아니라 **Supabase `submissions` 테이블에 저장 → 앱이 로드 시 도감에 병합**(`mergeApproved`)한다. 즉 승인분은 재배포 없이 반영되지만 정적 JSON엔 남지 않는다.

---

## 2. 파일 구조 & 역할

```
index.html                 # 전체 마크업(탭/섹션 구조). <head>에 config→store→breed→app 순 스크립트 로드
assets/css/style.css       # 전 스타일(라이트 테마, :root 변수). 신규 UI는 파일 끝에 append해 옴
assets/js/config.js        # window.SUPABASE_CONFIG = {url, anonKey}. 공개 anon key(문제 없음)
assets/js/store.js         # 인증 + 클라우드 저장(보유/픽업/요청) 모듈 (const Store = IIFE)
assets/js/breed.js         # 교배 계산 엔진 (const Breed = IIFE). DV3 확률 모델 포팅
assets/js/app.js           # UI 전체: 렌더 함수·이벤트·탭·모달·요청 시스템·데이터 파생
data/dragons.json          # 전투 도감 121종 (Lv.50·5성 스탯 스키마)
data/orbs.json             # 보주 72종
data/abilities.json        # 특성 사전 57종 (※ 런타임엔 dragons.json에서 재생성됨. 이 파일은 효과문구 시드)
data/breeding_dragons.json # 교배 전용 121종 (id·tier·portion·fixedProportion 등 교배 파라미터)
data/type_chart.json       # 14×14 속성 상성표 (인게임 캡처 기반)
data/dragon_summary.json   # (레거시 스냅샷) 요약표 — 런타임엔 동적 계산으로 대체됨
data/orb_summary.json      # (레거시 스냅샷) 동일
data/terms.json            # 상태이상·날씨 용어
data/dragon_notes.json / orb_notes.json  # 자료 안내 문구
supabase/settings.sql      # settings 테이블(픽업 전역 설정) + RLS
supabase/submissions.sql   # submissions 테이블(요청/제보) + RLS
scripts/build_data.py      # 원본 xlsx→data JSON 생성(초기 도감용). 신규분은 여기 안 거침
scripts/*.xlsx             # 초기 도감 원본
README.md                  # 사용자용 개요
HANDOFF.md                 # (이 문서)
```

로드 순서(index.html 하단): `config.js → store.js → breed.js → app.js`. `app.js`가 `DOMContentLoaded`에서 `init()` 실행.

---

## 3. 데이터 파일 상세

### 3-1. `data/dragons.json` (전투 도감, 121종)
스키마(한 항목):
```json
{
  "element": "불", "subElements": ["땅","빛"], "grade": "전설", "name": "플렘버",
  "attackType": "마법", "total": 6547,
  "stats": {"hp":1037,"atk":827,"def":867,"mag":1452,"res":1202,"spd":1162},
  "ability": "불쏘시개", "abilityEffect": "...",
  "basicAttack": "불의 파동", "ultimate": "화염 낙인", "ultimateType": "마법",
  "accuracy": 100, "power": 60, "ultimateEffect": "...", "source": "뽑기"
}
```
- `stats`는 **Lv.50·5성** 기준(게임 상세창 캡처값). `total`=6스탯 합.
- `accuracy`/`power`는 **필살기(궁)** 값. 평타는 게임상 전부 명중100/위력30·에너지1이라 개별 저장 안 함(모달에 공통 표기).
- `grade`: 전설/영웅/희귀. `attackType`: 물리/마법. `source`: 뽑기/교배/레이드 등.
- 승인 병합된 드래곤은 `__approved:true` 플래그가 붙는다.

### 3-2. `data/orbs.json` (보주, 72종)
```json
{"element":"불","grade":"전설","name":"안식의 소각 보주","skill":"안식의 소각",
 "type":"마법","accuracy":85,"power":90,"cost":2,"statBonus":"+22","effect":"...","source":"뽑기"}
```
- `type`: 물리/마법/변화. **변화 타입은 `power`가 `"-"`**(문자열).

### 3-3. `data/breeding_dragons.json` (교배 전용, 121종) — 교배 계산기의 데이터셋
스키마:
```
id, code, name, rarity, tier, elementIds[], sortedElementIds[], elementNames[],
elementCount, breedingSeconds, hatchingSeconds, canBreedAsParent,
requireUserLevel, requireUserLevelByElement, portion, fixedProportion,
requireParentElementRule, parentElementCount, parentElementRequirementIds[],
parentDidRequirements[], drop
```
- **이 파일과 dragons.json은 별개 스키마지만 `name`이 1:1로 일치**(둘 다 121종, 완전 대응).
- 속성 id 매핑: 1불 2물 3바람 4강철 5땅 6번개 7빛 8어둠 9꿈 10영혼 11여명 12황혼 13신성 14혼돈.
- `drop`: `"breed_normal"`이면 교배로 얻을 수 있음(교배 목표 검색에 노출). 그 외(`gacha`/`raid`/`event_ended`)는 교배 결과로 안 나옴.
- **파루파루**는 게임에서 교배 획득 종료되어 우리가 의도적으로 `fixedProportion:0, portion:0, drop:"event_ended"`로 바꿔둠(dv3ex엔 아직 원값이라 대조 시 유일한 차이 — 정상).

### 3-4. `data/type_chart.json` (14×14 상성표)
```json
{ "order": ["불","물",...,"혼돈"],
  "levels": {"strong":{"label":"굉장함",...},"normal":..,"weak":..,"veryweak":..},
  "chart": { "불": {"물":"weak","강철":"strong",...}, ... } }
```
- `chart[공격속성][방어속성]` = strong/normal/weak/veryweak. 인게임 "속성 상성 계산기" 캡처를 전수 판독한 값(공격/방어 요약과 교차검증 완료).

### 3-5. 데이터 갱신 방법
- 신규 드래곤/보주: `data/dragons.json`·`data/orbs.json`에 직접 추가(스키마 준수, `total`은 스탯합).
- 교배 대상이면 `data/breeding_dragons.json`에도 추가(정확한 tier/portion/fixedProportion 필요 → **dv3ex.com에서 추출 권장**, 4장 참조).
- **특성 사전(abilities)과 요약표는 런타임에 dragons/orbs에서 자동 재생성**되므로 별도 수정 불필요(단, abilities.json은 효과문구 시드로 유지).
- 데이터 추가 후 `index.html` 푸터/`<meta>`의 "드래곤 N종·보주 N종·특성 N종" 숫자도 갱신.

---

## 4. 교배 엔진 `assets/js/breed.js` (핵심)

DV3 교배 확률 모델을 dv3guide.com 클라이언트 번들에서 역공학해 포팅했고, dv3ex.com 데이터셋(게임 v1.0.10, 121종)과 **전 조합 대조 검증(오차 0)** 완료.

### 4-1. 확률 모델
- 교배 = 부모 2마리(서로 다른 품종) → 결과 알 1개. 결과는 여러 후보에 대한 **확률분포(합 100%)**.
- **적격(eligible) 판정**: 타깃 t를 부모 a,b로 얻을 수 있는지. (1)테이머레벨 (2)부모 합산속성이 t 속성조합 포함(`requireParentElementRule`) (3)3속성 타깃은 부모 둘 다 2속성+ (4)부모 합산 distinct 속성 수 ≥ `parentElementCount` (5)`parentElementRequirementIds` 전부 포함 (6)`parentDidRequirements` 부모로 포함. 하나라도 위반 시 불가.
- **콤보 키**: 부모 합집합 속성의 크기 1~3 부분조합을 정렬·`-`join. 적격 (2),(5) 판정에 사용.
- **2단계 확률**:
  - (A) **고정확률**(`fixedProportion>0`, bp단위): 티어별 예산 `TIER_MAX = {5:1000,6:600,7:300,8:150, 나머지:0}` 안에서. 한 티어의 eligible 고정합 o가 예산 초과면 `scale=budget/o`로 비례축소. 확률(%) = `fixedProportion*scale/100`.
  - (B) **가중치 풀**(`fixedProportion=0`): 남은 확률 `p=100-Σ고정%`를 `portion` 가중치 비례 분배.
- **픽업(확률업)**: 현재 픽업 드래곤에 대해 — 고정확률이면 `+ fixedProportion*0.5/100`(기본의 절반 가산, 예산 미적용), 가중치면 `weight ×2.5`. (dv3guide `be` 함수 그대로.)
- **실패 교배시간 기댓값**: 타깃 아닌 결과들의 조건부확률 가중 `breedingSeconds` 평균.
- **기대 횟수/누적시간**: 기하분포 `기대시도=100/p`, 누적시간 ≈ `실패수×실패평균시간 + 타깃시간`.

### 4-2. 공개 함수 (`Breed.*`)
```
load(data)                         // breeding_dragons.json 로드
setPickup(names) / getPickupNames() / isPickup(id)   // 픽업 설정(전역)
breed(a,b,userLevel,allowSame)     // {dragonId: 확률%}
failTime(out,targetId) / expect(p,ft,targetId)
comboKeys(a,b) / eligible(t,a,b,keys,ecount,userLevel)
rareIds() / ownedIdSet(names) / parentPool(ownedSet, ownedOnly)
combosForTarget(targetId,parentIds,userLevel,limit)   // 한 타깃의 부모쌍 목록(확률↓·실패시간↑)
commonPairs(targetIds,...)          // 여러 타깃을 '한 조합(부모1쌍)'으로 모두 내는 쌍
commonSubsets(targetIds,...)        // 한 조합으로 함께 되는 극대 부분집합들(크기순)
barracks(targetIds,n,...)           // n배럭으로 1~2마리 노리기(서로소 부모, 성공확률)
barracksForSet(targetIds,n,...)     // n배럭으로 '집합 전부' 얻기(최소배럭 커버+병목보강, 불가시 최대커버)
route(targetId,startIds,userLevel)  // 보유분으로 직접 못 만들 때 다단계 교배 순서(BFS)
all() / byId(id) / byName(name) / TIER_MAX
```
- `rareIds()`=희귀(rarity3) 10종 → **항상 보유로 간주**(교배 부모풀 기본 포함). "보유"는 도감 컬렉션(Store.list())과 연동.
- Node에서 `require('./assets/js/breed.js')` 가능(파일 끝에 `module.exports` 조건부).

### 4-3. 검증된 수치(회귀 기준)
- 파루파루(과거): 8티어 fp75 → 0.75%. 주작: 7티어 fp150 → 1.5%. 닌자: 5티어 fp500 → 5%(픽업 시 7.5%).
- 원더 드래곤 t7(1.5%) · 에레보스 t6(3.0%) · 슬로스 t4(가중, ~46%) · 고대주니어 t8(0.75%).

---

## 5. 상성표 (app.js `renderTypes`, `typeSectionFor`)
- `data/type_chart.json` 기반 14×14 매트릭스(세로=공격, 가로=방어). 색상: strong=청록, weak=주황, veryweak=빨강.
- 드래곤 상세 모달에도 해당 드래곤 속성별 "공격 강/약 · 방어 약점/저항" 자동 표기.

---

## 6. 인증/클라우드 `assets/js/store.js` + Supabase

### 6-1. 동작 모드
- `config.js`에 `url`+`anonKey` 있으면 클라우드 모드, 없으면 게스트(localStorage) 모드. **게스트 모드에서도 도감/교배/상성/컬렉션 전부 동작**(로그인·동기화만 비활성).

### 6-2. Supabase 프로젝트
- URL/anon key는 `assets/js/config.js`에 있음(anon key는 공개돼도 무방한 값 — RLS가 보호).
- **관리자 계정**: `admin@dv3.com` (비밀번호는 사용자가 보관 — 이 문서/저장소에 넣지 말 것). 관리자 판정은 `Store.isAdmin()` = 로그인 이메일 === `admin@dv3.com`.
- **무료 플랜 주의**: 약 7일 미사용 시 프로젝트가 자동 일시정지(pause)됨 → 로그인/DB가 521 에러. 이땐 Supabase 대시보드에서 **Restore/Resume** 필요. (실제로 한 번 발생했었음.)

### 6-3. 테이블 & RLS (SQL은 `supabase/*.sql`)
- `collections(user_id, owned jsonb, updated_at)` — 사용자별 보유 드래곤 이름 배열. RLS: 본인 행만 read/write.
- `settings(key, value jsonb, updated_at)` — 전역 설정. `key='pickup'`에 픽업 드래곤 이름 배열. RLS: **공개 read**, **관리자만 write**. 없으면 앱은 `Store.DEFAULT_PICKUP=["닌자 드래곤"]` 폴백.
- `submissions(id, type, status, payload jsonb, note, created_by, created_at, reviewed_at)` — 요청/제보. RLS: 승인분 공개 read / 본인 것 read / 관리자 전체 read / **로그인 사용자만 insert(status=pending, created_by=본인)** / **관리자만 update·delete**.
- 세 테이블 모두 실기기 E2E 검증 완료(인증·RLS 차단 포함).

### 6-4. `Store.*` 함수
```
init / on(event,fn) [events: change, auth]
isConfigured / isCloud / isLoggedIn / isAdmin / getUser
has(name)/list()/size()/toggle(name)/clearAll()      // 보유 드래곤
signUp/signIn/signOut                                 // 이메일 인증 (Google 로그인은 제거됨)
loadPickup()/savePickup(names)                        // 픽업(settings)
submitRequest(type,payload,note)/loadApproved()/loadPending()/loadMine()/reviewSubmission(id,status)
ADMIN_EMAIL / DEFAULT_PICKUP
```
- 로그인 시 게스트 보유현황을 클라우드와 자동 병합. 이메일 확인(confirm email)은 꺼져 있어 가입 즉시 로그인 가능.

---

## 7. 요청(제보) 시스템 (app.js `renderRequest` 등)
- **요청 탭**: 로그인 사용자가 신규 드래곤/보주 정보를 폼으로 제출 → `submissions`에 `pending`.
  - 드래곤 폼: 이름·주/부속성·등급·공격타입·획득방법·능력치6·특성(이름+효과)·평타·필살기(이름/타입/명중/위력/효과) + **교배 확률(부모·결과확률)로 티어 예측**(`predictTier`: 0.75%→t8, 1.5%→t7, 3%→t6, 5%→t5 매핑, 가중치 드래곤은 부정확).
  - 보주 폼: 이름·속성·등급·스킬·타입·명중·위력·비용·보너스·효과·획득처.
- **관리자**: 대기 목록에서 승인·등록/반려, 또는 폼에서 "바로 등록"(즉시 approved).
- **병합**(`mergeApproved`): 앱 로드 시 `Store.loadApproved()` → `DB.dragons`/`DB.orbs`에 push(중복 방지) → 특성·요약 자동 재생성. **교배 계산기엔 자동 편입 안 됨**(정확한 교배 파라미터 필요 → 미해결 항목, 9장).

---

## 8. UI/렌더 `assets/js/app.js`
- `DB` = 로드된 모든 데이터. `state` = 탭별 UI 상태.
- 렌더 함수: `renderDragons/openDragon(육각형 레이더 statRadar)/renderOrbs/renderAbilities/renderCodex/renderCollection/renderTypes/renderRequest` + 교배 `renderBreeding→renderBreedTarget|renderBreedBarracks|renderBreedParent`(+ `renderTargetChips/renderSelectResult/renderPickup`).
- **자동 갱신(중요)**: `rebuildAbilities()`(특성), `computeDragonSummary()/computeOrbSummary()`(요약표)가 **정적 JSON이 아니라 현재 DB에서 동적 생성** → 신규/승인분 즉시 반영.
- **교배 탭 3분할**: 🎯목표로 찾기(1마리=우선순위 조합 / 2+마리=한 조합으로 모두, 불가시 부분집합) · 🏠n배럭(1마리=성공확률↑ 서로소 배럭 / 2+마리=집합 전부 얻기 배정) · 👪부모로 찾기(부모2→결과 분포).
- **픽업 바**: 상단에 현재 픽업 표시. 관리자면 "픽업 편집" 가능(settings 테이블 저장, 전역 반영).
- 드래곤 칩/이름 클릭 → 도감 상세 모달(이벤트 위임).
- 모달은 `.modal-backdrop[hidden]{display:none}` 규칙으로 닫힘(과거 `display:flex`가 `[hidden]`을 덮어 안 닫히던 버그 수정됨). 막대 채움은 `.fill{display:block}` 필수(inline span은 height 무시).

---

## 9. 배포 절차 (Cloudflare Pages)
정적 자산만 임시 폴더에 모아 `wrangler pages deploy`.
```bash
# 1) 배포용 폴더 구성
rm -rf /tmp/dvdeploy && mkdir -p /tmp/dvdeploy/assets/css /tmp/dvdeploy/assets/js
cp index.html .nojekyll /tmp/dvdeploy/
cp assets/css/style.css /tmp/dvdeploy/assets/css/
cp assets/js/*.js /tmp/dvdeploy/assets/js/
cp -r data /tmp/dvdeploy/
# 2) 배포 (시크릿은 환경변수로만; 저장소/문서에 넣지 말 것)
export CLOUDFLARE_API_TOKEN='<사용자 보관 — Pages Edit 권한 토큰>'
export CLOUDFLARE_ACCOUNT_ID='<사용자 보관>'
export CI=1
npx --yes wrangler@latest pages deploy /tmp/dvdeploy \
  --project-name dragon-village-3 --branch main --commit-dirty=true
```
- 프로젝트명 `dragon-village-3`, `--branch main`이 프로덕션.
- **주의**: 프로덕션 배포는 자동승인 정책상 사용자 명시 동의가 필요할 수 있음. 배포 전 사용자에게 확인.
- Git 브랜치에 push는 코드 반영일 뿐 자동 배포되진 않음(Pages Git 연동은 미설정). 배포는 위 wrangler 수동 실행.
- `supabase/*.sql`은 웹에 올리지 않음(저장소 문서용). Supabase 변경 시 사용자가 대시보드 SQL Editor에서 실행.

---

## 10. 시크릿/보안 (이 저장소에 넣지 말 것)
- Cloudflare API 토큰, Cloudflare Account ID — 환경변수로만 사용. **커밋/문서 금지.**
- 관리자 비밀번호(admin@dv3.com) — 사용자 보관. 코드/문서/커밋 금지.
- Supabase anon key — 공개값이라 config.js에 있어도 됨(RLS가 보호).
- 채팅 로그에 노출됐던 옛 Cloudflare/R2 키가 있으면 **재발급 권장**.

---

## 11. 검증 방법 (jsdom 스모크 패턴)
브라우저 없이 실제 DOM으로 검증. jsdom은 CSS 레이아웃을 렌더하지 않으므로(시각 버그는 못 잡음) 로직/구조 검증용.
```bash
cd <repo> && npm i jsdom --no-save    # 프로젝트 폴더에서(스크립트도 이 폴더에 둬야 모듈 해석됨)
# JSDOM으로 index.html 로드 → window.fetch를 data/*.json 로컬 읽기로 스텁 →
# store.js+breed.js+app.js를 하나로 eval → DOMContentLoaded 디스패치 →
# 탭 클릭·함수 호출로 검증. (window.SUPABASE_CONFIG={}로 게스트 모드)
# 세션 내 예: 전 탭 전환 무에러, 카운트 121/72/57, 교배·상성·요청 렌더 확인.
rm -rf node_modules package-lock.json  # 정리(커밋 금지)
```
- Supabase 실기기 검증은 `curl`로 auth/rest 엔드포인트 직접 호출(가입→로그인→collections→RLS→submissions 흐름). 단, **이 컨테이너의 아웃바운드 프록시가 supabase.co를 막을 때가 있음**(502/521). 라이브 사이트는 브라우저→Supabase 직결이라 무관.
- 문법: `node --check assets/js/*.js`. 데이터: `python3 -c "import json;json.load(open('data/X.json'))"`.

---

## 12. 데이터 출처 (신뢰순)
1. **인게임 캡처** — 드래곤/보주 상세창(Lv.50 스탯·특성·스킬·획득처), 속성 상성 계산기. 최우선.
2. **dv3ex.com** — 최신 게임 버전 반영 도감(개별 드래곤 페이지 + `/breeding/`). **교배 파라미터(tier/portion/fixed/속성/교배시간/요구레벨)의 정답 소스**. 데이터셋은 `https://dv3ex.com/_astro/dragons.<hash>.js`에 인라인(ES모듈, 배열 리터럴 추출해 eval). 필드명: `elements/eleId/brdSec/portion/fixed/canBreed/reqUserLv/breedLockLv/reqEleIds/reqEleCnt/reqParentEle/combat...` → 우리 스키마로 매핑.
3. **dv3guide.com** — 초기 교배 모델 역공학 출처(번들에 `be`/`_e`/`he` 함수, `tierFixedRateMax`). 최근 미갱신이라 신규 드래곤은 없음. 자기네 이벤트 픽업(플루모스·클렙토스)이 기본 적용돼 있어 확률이 우리와 다를 수 있음(계산 오류 아님, 픽업 대상 차이).
4. **커뮤니티** — 디시 DV3 갤러리(`gall.dcinside.com/mgallery/board/lists/?id=dv3`), 공식 공지(`dragonvillage.net/notice/<no>`). 신작/픽업 정보 교차검증. **네이버 게임 라운지는 JS 렌더라 도구로 본문 못 읽음.** 디시는 curl+UA로 본문 파싱 가능(WebFetch는 봇 차단으로 빈 응답).

> 오류 방지: 계산/데이터가 의심되면 dv3ex와 대조하고, 메커니즘은 커뮤니티로 교차검증. 확실치 않은 값은 지어내지 말고 캡처를 요청.

---

## 13. 지금까지 한 작업 (커밋 요약, 최신→과거)
요청 시스템+요약/특성 자동갱신 → 특성 57종 반영 → 정신지배 보주(보주72) → 교배 탭 3분할(목표/n배럭/부모) → dv3ex 대조검증+신규 교배데이터+리치몬드 → 신규 6종·보주6종 → 플렘버 속성수정 → 플렘버·안식의소각+파루파루 교배종료 → 막대 채움 버그수정 → 육각형 능력치 → 필터개선(다중선택·주속성) → 라이트 테마 → n배럭+계산검증 → 동시검색 재정의+픽업/관리자+구글제거 → 상성표 → 교배 도감연결+소요추정 → 교배 시스템 → 모달버그·게스트모드.

---

## 14. 알려진 제약 / 미해결 / 다음 작업 후보
1. **승인 등록 드래곤이 교배 계산기에 자동 편입 안 됨** — 도감/특성/상성/컬렉션/요약엔 병합되지만 교배엔 tier/portion/fixed 등 정확 파라미터가 필요. 관리자가 이 값을 확정해 breeding 데이터에 넣는 흐름이 필요(요청 폼의 티어 예측은 근사).
2. **요약표 레거시 JSON**(dragon_summary/orb_summary)은 이제 런타임 동적계산으로 대체됨 — 파일은 남아있지만 안 쓰임(정리 가능).
3. **없는 경로가 404 대신 200**(Cloudflare Pages 기본, 단일페이지라 영향 없음).
4. **정적 데이터 캐시**가 `max-age=0, must-revalidate`(Pages 기본) — 재방문 속도 위해 캐시 수명 늘릴 여지.
5. **Supabase 무료 플랜 자동 일시정지** 주의(11장 회복 절차).
6. 잠재 확장: 팀/덱 빌더, 드래곤 비교, 공유 딥링크(?dragon=), PWA(오프라인), 월드보스 딜러 추천 도구(상성+스탯 기반).

---

## 15. 새 에이전트를 위한 작업 수칙
- **브랜치 `claude/dragon-village-3-site-qgwjyl`에서 작업**, PR #1을 갱신(새 PR 만들지 말 것).
- 코드 변경 후: `node --check` + jsdom 스모크로 검증 → 커밋 → (사용자 동의 후) wrangler 배포.
- 데이터 추가 시 스키마 준수 + 카운트 표기 갱신 + (교배 대상이면) dv3ex에서 교배 파라미터 확보.
- 시크릿은 절대 커밋/문서화 금지. 불확실한 게임 수치는 캡처 요청.
- 사용자는 한국어로 소통. 결과는 정직하게(테스트 실패/미검증은 그대로 보고).
```
```
