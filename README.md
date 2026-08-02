# 드래곤빌리지3 도감 🐲

드래곤빌리지3의 **드래곤 113종**과 **보주 64종** 정보를 한곳에 모은 정적 웹 도감입니다.
인게임 도감 캡처(2026-06-14)를 직접 판독한 데이터를 기반으로 합니다.

## 주요 기능

- **드래곤 도감** — 113종을 카드로 표시. 이름·속성·특성·스킬 검색, 속성/등급/공격타입/획득처 필터, 6개 스탯(체력·공격·방어·마력·저항·속도) 및 합계 기준 정렬, 카드 클릭 시 상세 모달.
- **보주 도감** — 64종을 테이블로 표시. 속성·등급·타입 필터, 명중/위력 정렬, 효과·획득처 표시.
- **특성 사전** — 53종 어빌리티 효과와 보유 드래곤 목록(클릭 시 해당 드래곤 상세로 이동).
- **내 컬렉션** — 보유 드래곤을 ☆ 버튼으로 표시하고 달성률(보유/113)·등급별·속성별 진행도를 확인. '보유만/미보유만' 필터 제공.
- **로그인 · 클라우드 동기화** — Supabase 이메일/Google 로그인 시 보유 현황이 클라우드에 저장되어 기기 간 동기화. 미설정 시 브라우저(localStorage) 게스트 모드로 자동 동작.
- **요약 · 용어** — 속성·등급별 분포 통계, 상태이상·날씨 용어집, 자료 안내.

프론트엔드는 백엔드 없이 동작하며 Cloudflare Pages / GitHub Pages 등 정적 호스팅에 그대로 배포할 수 있습니다.

## 구조

```
index.html              # 단일 페이지 앱
assets/css/style.css    # 스타일 (다크 판타지 테마)
assets/js/app.js        # 필터·검색·정렬·모달 로직 (vanilla JS)
data/*.json             # 사이트용 데이터 (빌드 스크립트 산출물)
scripts/build_data.py   # 엑셀 원본 → data/*.json 변환 스크립트
scripts/*.xlsx          # 원본 데이터 (인게임 캡처 정리)
```

## 로컬 실행

`fetch`로 JSON을 불러오므로 정적 서버가 필요합니다(파일 직접 열기는 불가).

```bash
python3 -m http.server
# 브라우저에서 http://localhost:8000 접속
```

## 데이터 갱신

원본 엑셀(`scripts/*.xlsx`)을 수정한 뒤 아래를 실행하면 `data/*.json`이 다시 생성됩니다.

```bash
pip install openpyxl
python3 scripts/build_data.py
```

## 로그인 · 보유 현황 기능 설정 (Supabase)

설정하지 않아도 사이트는 게스트(로컬 저장) 모드로 동작합니다. 클라우드 로그인·동기화를 켜려면:

1. **프로젝트 생성** — [supabase.com](https://supabase.com)에서 무료 프로젝트를 만듭니다.
2. **키 입력** — `assets/js/config.js`에 Project URL과 `anon public` 키를 채웁니다
   (Supabase → Project Settings → API).
   ```js
   window.SUPABASE_CONFIG = {
     url: "https://xxxx.supabase.co",
     anonKey: "eyJhbGci..."
   };
   ```
3. **테이블 + 보안정책(RLS) 생성** — Supabase → SQL Editor에서 아래를 실행합니다.
   사용자는 자신의 보유 현황만 읽고 쓸 수 있습니다.
   ```sql
   create table if not exists public.collections (
     user_id    uuid primary key references auth.users(id) on delete cascade,
     owned      jsonb not null default '[]'::jsonb,
     updated_at timestamptz not null default now()
   );
   alter table public.collections enable row level security;

   create policy "본인 행 조회" on public.collections
     for select using (auth.uid() = user_id);
   create policy "본인 행 추가" on public.collections
     for insert with check (auth.uid() = user_id);
   create policy "본인 행 수정" on public.collections
     for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
4. **인증 설정** — Supabase → Authentication
   - 이메일 로그인은 기본 활성화. (이메일 인증 메일이 번거로우면 Providers → Email에서
     "Confirm email"을 꺼 즉시 로그인 가능)
   - Google 로그인은 Providers → Google에서 활성화하고, 아래 도메인을 등록합니다.
   - **URL Configuration → Redirect URLs**에 배포 도메인을 추가합니다
     (예: `https://<프로젝트>.pages.dev`, 커스텀 도메인, 로컬 `http://localhost:8000`).

> `anon` 키는 공개되어도 안전한 클라이언트용 키입니다(RLS로 데이터가 보호됨).
> `service_role` 키는 절대 프론트엔드/저장소에 넣지 마세요.

## Cloudflare Pages 배포

빌드 과정이 없는 정적 사이트입니다.

- **대시보드 연결**: Cloudflare Pages → Create application → Connect to Git에서 이 저장소 선택.
  - Framework preset: **None**
  - Build command: *(비움)*
  - Build output directory: **`/`** (루트)
- 또는 Wrangler로 직접 업로드:
  ```bash
  npx wrangler pages deploy . --project-name dragon-village-3
  ```

배포 후 발급된 `*.pages.dev` 주소(및 커스텀 도메인)를 위 Supabase **Redirect URLs**에 꼭 추가해야
Google/이메일 로그인 리다이렉트가 정상 동작합니다.

## 데이터 출처 / 면책

- 모든 수치는 인게임 도감 Lv.50 · 5성 기준 캡처값입니다.
- 본 사이트는 팬 제작 비공식 자료이며, 원작 권리는 각 권리자에게 있습니다.
