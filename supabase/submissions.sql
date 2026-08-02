-- 신규 드래곤/보주 '수정사항 요청'(제보) 저장 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- (요청 탭은 로그인한 계정만 제출 가능, 관리자만 승인/반려, 승인된 항목은
--  사이트가 로드 시 도감에 자동 병합됩니다.)

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                 -- 'dragon' | 'orb'
  status      text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  payload     jsonb not null,                -- 드래곤/보주 데이터(도감 스키마)
  note        text,                          -- 제출자 메모
  created_by  text,                          -- 제출자 이메일
  created_at  timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.submissions enable row level security;

-- 승인된 항목은 누구나 읽기(도감 병합용)
drop policy if exists "sub read approved" on public.submissions;
create policy "sub read approved" on public.submissions
  for select using (status = 'approved');

-- 본인 제출 항목은 상태와 무관하게 읽기
drop policy if exists "sub read own" on public.submissions;
create policy "sub read own" on public.submissions
  for select using (auth.jwt() ->> 'email' = created_by);

-- 관리자는 전체 읽기(대기 목록 검토)
drop policy if exists "sub read admin" on public.submissions;
create policy "sub read admin" on public.submissions
  for select using (auth.jwt() ->> 'email' = 'admin@dv3.com');

-- 로그인 사용자만 제출 가능. created_by 는 본인, 상태는 pending
-- (관리자는 approved 로 바로 등록 가능)
drop policy if exists "sub insert" on public.submissions;
create policy "sub insert" on public.submissions
  for insert with check (
    auth.jwt() ->> 'email' = created_by
    and (status = 'pending' or auth.jwt() ->> 'email' = 'admin@dv3.com')
  );

-- 승인/반려는 관리자만
drop policy if exists "sub admin update" on public.submissions;
create policy "sub admin update" on public.submissions
  for update using (auth.jwt() ->> 'email' = 'admin@dv3.com')
  with check (auth.jwt() ->> 'email' = 'admin@dv3.com');

-- 삭제도 관리자만(선택)
drop policy if exists "sub admin delete" on public.submissions;
create policy "sub admin delete" on public.submissions
  for delete using (auth.jwt() ->> 'email' = 'admin@dv3.com');
