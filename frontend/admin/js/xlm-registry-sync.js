/**
 * Generasi XLM — JANGAN ubah default di file ini.
 * Satu sumber: backend/xlm_generation.py → ACTIVE_XLM_PROFILE
 * (snapshot: xlm-generation.snapshot.json, dikonfirmasi API /config/xlm-generation)
 */
(function () {
  "use strict";

  var STORAGE_KEY = "kamusXlmGeneration";
  var SNAPSHOT_URL = "../js/xlm-generation.snapshot.json";
  var API_BASE = "http://127.0.0.1:8000";

  var client = null;
  if (window.createKamusSupabaseClient) {
    client = window.createKamusSupabaseClient();
  }

  var _generation = null;
  var _profile = null;
  var _ready = false;

  function normalizeXlmAlgo(raw) {
    var k = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    if (k === "xlm-r-2" || k === "xlmr" || k === "xlm-r") return "xlm-r";
    return "";
  }

  function applyConfig(data) {
    var g = data && data.generation;
    var p = data && data.profile;
    if (g === "gen1" || g === "gen2") {
      _generation = g;
      _profile = p === "xlm-r" || p === "xlm-r-2" ? p : g === "gen1" ? "xlm-r" : "xlm-r-2";
      _ready = true;
      try {
        localStorage.setItem(STORAGE_KEY, _generation);
      } catch (e) {}
      return _generation;
    }
    return null;
  }

  function getXlmGeneration() {
    if (_generation === "gen1" || _generation === "gen2") return _generation;
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "gen1" || v === "gen2") return v;
    } catch (e2) {}
    return null;
  }

  function getXlmActiveProfile() {
    if (_profile === "xlm-r" || _profile === "xlm-r-2") return _profile;
    var g = getXlmGeneration();
    return g === "gen1" ? "xlm-r" : g === "gen2" ? "xlm-r-2" : null;
  }

  function isXlmGen2Row(row) {
    var raw = String((row && row.algoritma) || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    var name = String((row && row.nama_model) || "").trim();
    if (raw === "xlm-r-2") return true;
    if (name.toUpperCase().indexOf("XLMR2") === 0) return true;
    return false;
  }

  function isXlmGen1LegacyName(name) {
    var n = String(name || "").trim().toLowerCase();
    return n.indexOf("xlmrfinal") === 0;
  }

  function modelMatchesActiveGeneration(row) {
    if (!row) return false;
    var gen = getXlmGeneration();
    if (!gen) return true;
    if (gen === "gen1") {
      if (isXlmGen1LegacyName(row.nama_model)) return true;
      return !isXlmGen2Row(row);
    }
    return isXlmGen2Row(row);
  }

  function filterXlmModelRows(items, generation) {
    if (!Array.isArray(items) || !items.length) return items || [];
    var gen = generation || getXlmGeneration();
    if (!gen) return items;
    var other = [];
    var xlm = [];
    items.forEach(function (row) {
      var key = normalizeXlmAlgo(
        (row && row.canonical_algorithm) || (row && row.algoritma),
      );
      if (key === "xlm-r") xlm.push(row);
      else other.push(row);
    });
    if (!xlm.length) return items;

    var kept;
    if (gen === "gen1") {
      var gen1Named = xlm.filter(function (r) {
        return isXlmGen1LegacyName(r.nama_model);
      });
      kept = gen1Named.length
        ? gen1Named
        : xlm.filter(function (r) {
            return !isXlmGen2Row(r);
          });
    } else {
      var gen2 = xlm.filter(isXlmGen2Row);
      if (gen2.length) {
        kept = gen2;
      } else {
        kept = xlm.filter(function (r) {
          return !isXlmGen1LegacyName(r.nama_model);
        });
        if (!kept.length) kept = xlm;
      }
    }

    // Pertahankan algoritma asli dari Supabase (xlm-r vs xlm-r-2) agar tidak bentrok gen.
    return other.concat(kept);
  }

  function loadSnapshotConfig() {
    return fetch(SNAPSHOT_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function loadApiConfig() {
    return fetch(API_BASE + "/config/xlm-generation", { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function initXlmGenerationFromBackend() {
    return loadSnapshotConfig()
      .then(function (snap) {
        applyConfig(snap);
        return loadApiConfig();
      })
      .then(function (api) {
        if (api) applyConfig(api);
        var g = getXlmGeneration();
        if (!g) {
          console.warn(
            "[XLM] Konfigurasi belum tersedia. Pastikan backend jalan dan ACTIVE_XLM_PROFILE valid di backend/xlm_generation.py",
          );
          _generation = "gen2";
          _profile = "xlm-r-2";
          _ready = true;
        }
        return getXlmGeneration();
      });
  }

  function parseMissingColumn(error) {
    var msg = [error && error.message, error && error.details]
      .filter(Boolean)
      .join(" ");
    var m = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
    return m ? m[1] : null;
  }

  async function insertModelRow(row) {
    if (!client) return { ok: false };
    var payload = Object.assign({}, row);
    for (var i = 0; i < 24; i++) {
      var res = await client.from("models").insert([payload]).select("id");
      if (!res.error) return { ok: true };
      var col = parseMissingColumn(res.error);
      if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
        delete payload[col];
        continue;
      }
      return { ok: false, error: res.error };
    }
    return { ok: false };
  }

  async function modelNameExists(namaModel) {
    if (!client || !namaModel) return false;
    var res = await client
      .from("models")
      .select("id")
      .eq("nama_model", namaModel)
      .limit(1);
    if (res.error) return false;
    return Array.isArray(res.data) && res.data.length > 0;
  }

  function buildRowFromHistoryEntry(entry) {
    var hasil = Array.isArray(entry.hasil) ? entry.hasil : [];
    if (!hasil.length) return null;
    var nama = String(entry.model_name || entry.nama_model || "").trim();
    if (!nama) return null;
    var p = entry.parameter || {};
    var sum = hasil.reduce(
      function (acc, r) {
        acc.accuracy += Number(r.accuracy) || 0;
        acc.precision += Number(r.precision) || 0;
        acc.recall += Number(r.recall) || 0;
        acc.f1 += Number(r.f1) || 0;
        return acc;
      },
      { accuracy: 0, precision: 0, recall: 0, f1: 0 },
    );
    var n = hasil.length;
    var datasetId = parseInt(
      localStorage.getItem("processing_selected_dataset_id") || "",
      10,
    );
    if (!Number.isFinite(datasetId) || datasetId <= 0) return null;

    return {
      nama_model: nama,
      algoritma: getXlmActiveProfile() || "xlm-r",
      mode: "training-final",
      dataset_id: datasetId,
      split_ratio: entry.rasio || "80:20",
      learning_rate: parseFloat(p.lr) || null,
      epoch: parseInt(p.epoch || "", 10) || null,
      batch_size: parseInt(p.batchSize || "", 10) || null,
      max_length:
        parseInt(p.maxLength || p.max_length || "", 10) || null,
      accuracy: sum.accuracy / n,
      precision: sum.precision / n,
      recall: sum.recall / n,
      f1_score: sum.f1 / n,
      created_at: entry.tanggal || new Date().toISOString(),
    };
  }

  function buildRowFromSavedEntry(entry) {
    var nama = String(entry.nama_model || "").trim();
    var datasetId = Number(entry.dataset_id);
    if (!nama || !Number.isFinite(datasetId) || datasetId <= 0) return null;
    return {
      nama_model: nama,
      algoritma: getXlmActiveProfile() || "xlm-r",
      mode: entry.mode || "training-final",
      dataset_id: datasetId,
      split_ratio: entry.split_ratio || "80:20",
      learning_rate: entry.learning_rate,
      epoch: entry.epoch,
      batch_size: entry.batch_size,
      max_length: entry.max_length,
      accuracy: entry.accuracy,
      precision: entry.precision,
      recall: entry.recall,
      f1_score: entry.f1_score,
      created_at: entry.created_at || new Date().toISOString(),
    };
  }

  async function syncPendingXlmModelsToSupabase(options) {
    var gen = getXlmGeneration();
    if (!gen) return { synced: 0 };
    var opts = options || {};
    var silent = opts.silent !== false;
    if (!client) return { synced: 0 };

    var synced = 0;
    var remainingSaved = [];

    try {
      var saved = JSON.parse(localStorage.getItem("saved_models") || "[]");
      if (Array.isArray(saved)) {
        for (var i = 0; i < saved.length; i++) {
          var entry = saved[i];
          if (normalizeXlmAlgo(entry && entry.algoritma) !== "xlm-r") {
            remainingSaved.push(entry);
            continue;
          }
          if (!modelMatchesActiveGeneration(entry)) {
            remainingSaved.push(entry);
            continue;
          }
          var rowSaved = buildRowFromSavedEntry(entry);
          if (!rowSaved) {
            remainingSaved.push(entry);
            continue;
          }
          if (await modelNameExists(rowSaved.nama_model)) {
            synced += 1;
            continue;
          }
          var ins = await insertModelRow(rowSaved);
          if (ins.ok) synced += 1;
          else remainingSaved.push(entry);
        }
        localStorage.setItem("saved_models", JSON.stringify(remainingSaved));
      }
    } catch (e) {}

    try {
      var histRaw = localStorage.getItem("training_history");
      var history = histRaw ? JSON.parse(histRaw) : [];
      if (Array.isArray(history)) {
        for (var h = 0; h < history.length; h++) {
          var he = history[h];
          var algo = normalizeXlmAlgo(
            (he.parameter && he.parameter.algo) || "",
          );
          if (algo !== "xlm-r") continue;
          var pseudo = {
            algoritma: he.parameter && he.parameter.algo,
            nama_model: he.model_name || he.nama_model,
          };
          if (!modelMatchesActiveGeneration(pseudo)) continue;
          var rowHist = buildRowFromHistoryEntry(he);
          if (!rowHist) continue;
          if (await modelNameExists(rowHist.nama_model)) continue;
          var insH = await insertModelRow(rowHist);
          if (insH.ok) synced += 1;
        }
      }
    } catch (e2) {}

    if (synced && !silent && typeof window.showToast === "function") {
      window.showToast(
        synced === 1
          ? "1 model XLM (" + gen + ") disinkronkan ke Supabase."
          : synced + " model XLM (" + gen + ") disinkronkan ke Supabase.",
        "success",
      );
    }

    return { synced: synced };
  }

  window.kamusGetXlmGeneration = getXlmGeneration;
  window.kamusGetXlmActiveProfile = getXlmActiveProfile;
  window.kamusXlmGenerationReady = function () {
    return _ready;
  };
  window.kamusFilterXlmModelRows = filterXlmModelRows;
  window.kamusFilterXlmEvaluationItems = filterXlmModelRows;
  window.kamusModelMatchesActiveXlmGeneration = modelMatchesActiveGeneration;
  window.kamusInitXlmGeneration = initXlmGenerationFromBackend;
  window.kamusSyncXlmModelsToSupabase = syncPendingXlmModelsToSupabase;
})();
