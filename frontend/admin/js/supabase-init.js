/**
 * Inisialisasi Supabase admin — file ini IKUT Git (bukan rahasia).
 * Kredensial di `supabase-config.js` (gitignored) menimpa window.KAMUS_SUPABASE.
 */
(function () {
  "use strict";

  if (!window.KAMUS_SUPABASE) {
    window.KAMUS_SUPABASE = { url: "", anonKey: "" };
  }

  window.createKamusSupabaseClient = function createKamusSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }
    var cfg = window.KAMUS_SUPABASE || {};
    var url = String(cfg.url || "").trim();
    var key = String(cfg.anonKey || "").trim();
    if (!url || !key || key.indexOf("PASTE_") === 0) {
      return null;
    }
    return window.supabase.createClient(url, key);
  };

  window.kamusSupabaseConfigMissing = function kamusSupabaseConfigMissing() {
    return !window.createKamusSupabaseClient();
  };
})();
