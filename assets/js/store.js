"use strict";
/* ============================================================
 * Store — 인증 + 보유 드래곤 현황 저장
 *  - Supabase 설정(config.js)이 있으면 클라우드 모드(로그인/동기화)
 *  - 없으면 localStorage 게스트 모드
 *  - 로그인 시 게스트 보유 현황을 클라우드와 자동 병합
 * ========================================================== */
const Store = (() => {
  const LS_KEY = "dv3_owned";
  const ADMIN_EMAIL = "admin@dv3.com";
  const DEFAULT_PICKUP = ["닌자 드래곤"];
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
  const signOut = () => client.auth.signOut();

  /* ---- 관리자 / 픽업(확률업) ---- */
  const isAdmin = () => !!(user && user.email === ADMIN_EMAIL);
  // 픽업 드래곤 이름 배열 로드 (공개 읽기). 없으면 기본값.
  const loadPickup = async () => {
    if (configured && client) {
      try {
        const { data, error } = await client.from("settings").select("value").eq("key", "pickup").maybeSingle();
        if (!error && data && Array.isArray(data.value)) return data.value;
      } catch (e) { console.warn("픽업 로드 실패:", e.message); }
    }
    return DEFAULT_PICKUP.slice();
  };
  // 픽업 저장 (관리자만). settings 테이블 필요.
  const savePickup = async (names) => {
    if (!isAdmin()) return { error: { message: "관리자만 변경할 수 있습니다." } };
    const { error } = await client.from("settings").upsert({
      key: "pickup", value: names, updated_at: new Date().toISOString()
    });
    return { error };
  };

  /* ---- 수정사항 요청(제보) — submissions 테이블 ---- */
  const isLoggedIn = () => !!user;
  // 요청 제출. 관리자면 즉시 승인 등록. 로그인 필요.
  const submitRequest = async (type, payload, note) => {
    if (!user) return { error: { message: "로그인이 필요합니다." } };
    const auto = isAdmin();
    const { error } = await client.from("submissions").insert({
      type, payload, note: note || null, created_by: user.email,
      status: auto ? "approved" : "pending",
      reviewed_at: auto ? new Date().toISOString() : null
    });
    return { error, approved: auto };
  };
  // 승인된 요청 로드(공개 읽기) → 도감 병합용
  const loadApproved = async () => {
    if (!(configured && client)) return [];
    const { data, error } = await client.from("submissions")
      .select("type,payload").eq("status", "approved");
    if (error) { console.warn("승인목록 로드 실패:", error.message); return []; }
    return data || [];
  };
  // 대기 목록(관리자)
  const loadPending = async () => {
    if (!isAdmin()) return [];
    const { data, error } = await client.from("submissions")
      .select("id,type,payload,note,created_by,created_at")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) { console.warn(error.message); return []; }
    return data || [];
  };
  // 내 요청 목록
  const loadMine = async () => {
    if (!user) return [];
    const { data } = await client.from("submissions")
      .select("id,type,payload,status,created_at")
      .eq("created_by", user.email).order("created_at", { ascending: false });
    return data || [];
  };
  // 승인/반려(관리자)
  const reviewSubmission = async (id, status) => {
    if (!isAdmin()) return { error: { message: "관리자만 가능합니다." } };
    const { error } = await client.from("submissions")
      .update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    return { error };
  };

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
           toggle, clearAll, signUp, signIn, signOut,
           isAdmin, isLoggedIn, loadPickup, savePickup, ADMIN_EMAIL, DEFAULT_PICKUP,
           submitRequest, loadApproved, loadPending, loadMine, reviewSubmission };
})();
