/* ===== Supabase 설정 =====
 * 본인 Supabase 프로젝트의 값을 채우면 "로그인 + 클라우드 동기화"가 켜집니다.
 * 비워두면 로그인 없이 브라우저(localStorage)에만 저장하는 게스트 모드로 동작합니다.
 *
 * 값 위치: Supabase 대시보드 → Project Settings → API
 *   - url     : Project URL
 *   - anonKey : Project API keys 의 "anon public" 키
 *
 * 테이블/보안정책(RLS) 설정 SQL 은 README "보유 현황 기능 설정" 참고.
 */
window.SUPABASE_CONFIG = {
  url: "https://holzzclvoeixwchepnnn.supabase.co",
  anonKey: ""
};
