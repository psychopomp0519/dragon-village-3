-- 픽업(확률업) 등 전역 설정 저장용 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- (실행 전에는 앱이 기본 픽업 [파루파루, 닌자 드래곤] 으로 동작하며,
--  관리자 '픽업 편집' 저장 기능만 비활성 상태입니다.)

create table if not exists public.settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

-- 픽업 정보는 모든 방문자가 읽을 수 있어야 함(공개 읽기)
drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings
  for select using (true);

-- 쓰기/수정은 관리자 계정(admin@dv3.com)만
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings
  for all
  using (auth.jwt() ->> 'email' = 'admin@dv3.com')
  with check (auth.jwt() ->> 'email' = 'admin@dv3.com');

-- 초기 픽업 값(현재 픽업: 닌자 드래곤)
insert into public.settings (key, value)
values ('pickup', '["닌자 드래곤"]'::jsonb)
on conflict (key) do nothing;
