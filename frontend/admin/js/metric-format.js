/**
 * Normalisasi skala metrik untuk tampilan UI.
 * - Nilai 0–1 (sklearn / respons testing baru) → dikonversi ke persen 0–100.
 * - Nilai sudah persen (kolom models / API latest_testing) → dipakai apa adanya.
 */
function normalizePercent(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n >= 0 && n <= 1 ? n * 100 : n;
}

/** MCC: korelasi [-1, 1], bukan persen. Perbaiki data lama yang ter-skala ×100. */
function normalizeMcc(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n >= -1 && n <= 1) return n;
    return n / 100;
}

function formatPercentDisplay(raw) {
    var n = normalizePercent(raw);
    if (n == null) return '—';
    return (Math.round(n * 10) / 10).toFixed(1) + '%';
}

function formatMccDisplay(raw) {
    var n = normalizeMcc(raw);
    if (n == null) return '—';
    return (Math.round(n * 100) / 100).toFixed(2);
}

/** Ringkasan dari Supabase (latest_testing) — biasanya sudah skala persen. */
function mapStoredTestingSummary(summary) {
    if (!summary) return null;
    return {
        acc: normalizePercent(summary.accuracy),
        prec: normalizePercent(summary.precision_macro),
        f1: normalizePercent(summary.f1_macro),
        macro: normalizePercent(summary.f1_macro),
        rec: normalizePercent(summary.recall_macro),
        std: normalizePercent(summary.std_deviation),
        weighted: normalizePercent(summary.weighted_avg),
        roc: normalizePercent(summary.roc_auc),
        mcc: normalizeMcc(summary.mcc),
    };
}

/** Hasil POST /testing/* — metrik sklearn skala 0–1. */
function mapFreshTestingResult(result) {
    if (!result) return null;
    return {
        acc: normalizePercent(result.accuracy),
        prec: normalizePercent(result.precision_macro),
        f1: normalizePercent(result.f1_macro),
        macro: normalizePercent(result.f1_macro),
        rec: normalizePercent(result.recall_macro),
        std: normalizePercent(result.std_deviation),
        weighted: normalizePercent(result.weighted_avg),
        roc: normalizePercent(result.roc_auc),
        mcc: normalizeMcc(result.mcc),
    };
}

function renderTestingMetricCells(metrics) {
    if (!metrics) return;
    var ids = ['acc', 'prec', 'f1', 'macro', 'rec', 'std', 'weighted', 'roc', 'mcc'];
    var headerIds = ['mAcc', 'mPrec', 'mF1', 'mMacro', 'mRec', 'mStd', 'mWeighted', 'mRoc', 'mMcc'];
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var headerEl = document.getElementById(headerIds[i]);
        var metricEl = document.getElementById(id);
        if (headerEl) headerEl.classList.add('revealed');
        if (metricEl) metricEl.classList.add('revealed');
        if (!metricEl) continue;
        var v = metrics[id];
        if (v == null || !Number.isFinite(v)) {
            metricEl.textContent = id === 'mcc' ? '0.00' : '0%';
            continue;
        }
        metricEl.textContent =
            id === 'mcc' ? v.toFixed(2) : Math.round(v) + '%';
    }
}
