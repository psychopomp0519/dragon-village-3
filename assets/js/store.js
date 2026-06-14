"use strict";
/* ============================================================
 * Store — 인증 + 보유 드래곤 현황 저장
 *  - Supabase 설정(config.js)이 있으면 클라우드 모드(로그인/동기화)
 *  - 없으면 localStorage 게스트 모드
 *  - 로그인 시 게스트 보유 현황을 클라우드와 자동 병합
 * ========================================================== */
const Store = (() => {
  const LS_KEY = "dv3_owned";
  const listeners = { change: [], auth: [] };
  let client = null;
  let user = null;
  let owned = new Set();
  let saveTimer = null;

  const cfg = window.SUPABASE_CONFIG || {};
  const configured = !!(cfg.url && cfg.anonKey);

  const emit = (ev) => listeners[ev].forEach(fn => fn());
  const on = (ev, fn) => { listeners[ev].push(fn); };

  /* ---- 로컬 저장 ---- */
  const loadLocal = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); }
    catch { return new Set(); }
  };
  const saveLocal = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...owned])); } catch {}
  };

  /* ---- 클라우드 저장 ---- */
  const loadCloud = async () => {
    const { data, error } = await client.from("collections")
      .select("owned").eq("user_id", user.id).maybeSingle();
    if (error) { console.warn("로드 실패:", error.message); return new Set(); }
    return new Set((data && data.owned) || []);
  };
  const saveCloud = async () => {
    const { error } = await client.from("collections").upsert({
      user_id: user.id, owned: [...owned], updated_at: new Date().toISOString()
    });
    if (error) console.warn("저장 실패:", error.message);
  };

  const persist = () => {
    if (isCloud()) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCloud, 600); // 디바운스
    } else {
      saveLocal();
    }
  };

  /* ---- 인증 상태 전환 ---- */
  const onSignedIn = async (u) => {
    user = u;
    const guest = owned;                  // 로그인 직전 게스트 현황
    const cloud = await loadCloud();
    const merged = new Set([...cloud, ...guest]);
    owned = merged;
    if (merged.size !== cloud.size) await saveCloud();   // 병합분 반영
    if (guest.size) { try { localStorage.removeItem(LS_KEY); } catch {} }
    emit("auth"); emit("change");
  };
  const onSignedOut = () => {
    user = null;
    owned = loadLocal();
    emit("auth"); emit("change");
  };

  /* ---- public API ---- */
  const isConfigured = () => configured;
  const isCloud = () => !!(configured && user);
  const getUser = () => user;
  const has = (name) => owned.has(name);
  const list = () => [...owned];
  const size = () => owned.size;

  const toggle = (name) => {
    if (owned.has(name)) owned.delete(name); else owned.add(name);
    persist(); emit("change");
    return owned.has(name);
  };
  const clearAll = () => { owned.clear(); persist(); emit("change"); };

  const signUp = (email, password) => client.auth.signUp({ email, password });
  const signIn = (email, password) => client.auth.signInWithPassword({ email, password });
  const signInGoogle = () => client.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: location.href.split("#")[0] }
  });
  const signOut = () => client.auth.signOut();

  const init = async () => {
    owned = loadLocal();
    if (!configured) return;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn("Supabase 라이브러리를 불러오지 못했습니다. 게스트 모드로 동작합니다.");
      return;
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey);
    const { data } = await client.auth.getSession();
    if (data.session) await onSignedIn(data.session.user);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && (!user || user.id !== session.user.id)) onSignedIn(session.user);
      else if (event === "SIGNED_OUT") onSignedOut();
    });
  };

  return { init, on, isConfigured, isCloud, getUser, has, list, size,
           toggle, clearAll, signUp, signIn, signInGoogle, signOut };
})();
