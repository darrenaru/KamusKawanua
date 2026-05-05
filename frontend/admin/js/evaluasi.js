var API_BASE = 'http://127.0.0.1:8000';

/** Urutan kolom jika semua algoritma tersedia */
var ALGO_COLS = ['xlm-r', 'mbert', 'indobert', 'word2vec', 'glove'];
var TRANSFORMER_KEYS = ['xlm-r', 'mbert', 'indobert'];
var CLASSIC_KEYS = ['word2vec', 'glove'];

var ALGO_LABELS = {
    'xlm-r': 'XLM-R',
    mbert: 'mBERT',
    indobert: 'INDOBERT',
    word2vec: 'Word2Vec',
    glove: 'GloVe',
};

/** Kolom aktif (subset ALGO_COLS) — diisi setelah fetch */
var CURRENT_TABLE_COLS = ALGO_COLS.slice();

/** Instance chart untuk destroy sebelum render ulang */
var evaluationChartInstances = [];

function canonicalAlgoKey(raw) {
    var v = String(raw || '')
        .toLowerCase()
        .trim()
        .replace(/_/g, '-');
    if (v === 'indo-bert' || v === 'indobenchmark') return 'indobert';
    if (v === 'm-bert' || v === 'multilingual-bert' || v === 'bert-base-multilingual-cased')
        return 'mbert';
    if (v === 'xlmr' || v === 'xlm-r') return 'xlm-r';
    if (v === 'word2vec' || v === 'word-2-vec') return 'word2vec';
    if (v === 'glove') return 'glove';
    return v;
}

function escapeHtml(s) {
    var t = document.createElement('div');
    t.textContent = s == null ? '' : String(s);
    return t.innerHTML;
}

var METRIC_TOOLTIPS = {
    default:
        '<strong>Metric info:</strong> Metrics use different scales. Scores that naturally fall in 0-1 are shown as percentages for readability, while error/dispersion values are often kept as decimals.',
    accuracy:
        '<strong>Accuracy:</strong> Overall fraction of correct predictions.<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is a proportion, so percentage is easier to read quickly.',
    precision:
        '<strong>Precision:</strong> Of all predicted positive cases, how many are truly positive.<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is a proportion/ratio.',
    recall:
        '<strong>Recall:</strong> Of all actual positive cases, how many are correctly found by the model.<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is a proportion/ratio.',
    f1_score:
        '<strong>F1-Score (F1 = harmonic mean of Precision and Recall):</strong> Balances precision and recall into one score.<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is derived from ratio-based metrics.',
    macro_avg:
        '<strong>Macro avg (F1):</strong> Unweighted average of per-class F1 values (each class contributes equally).<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is still an F1-type proportion.',
    weighted_avg:
        '<strong>Weighted F1:</strong> Average F1 weighted by class support (class sample count).<br><strong>Range:</strong> 0 to 1 (displayed here as 0% to 100%).<br><strong>Why %:</strong> It is a weighted proportion-based score.',
    std_deviation:
        '<strong>Std dev (F1/class):</strong> Standard deviation of class-wise F1 values (how spread out class performance is).<br><strong>Range:</strong> 0 and above (no fixed upper bound).<br><strong>Why decimal:</strong> It is a dispersion magnitude, not a direct success ratio.',
    train_loss:
        '<strong>Loss (avg.):</strong> Average training objective value (model error signal used by optimizer).<br><strong>Range:</strong> Usually 0 and above for common losses (exact scale depends on loss function/setup).<br><strong>Why decimal:</strong> Loss is an optimization value, not a probability or ratio.',
    mcc:
        '<strong>MCC (Matthews Correlation Coefficient):</strong> Correlation-style score between predictions and true labels, robust under class imbalance.<br><strong>Range:</strong> -1 to 1 (here shown as -100% to 100%).<br><strong>Interpretation:</strong> 1 = perfect, 0 = random-like, -1 = total disagreement.<br><strong>Why % on this page:</strong> The dashboard rescales the native -1..1 value for easier visual comparison.',
    roc_auc:
        '<strong>ROC-AUC (Receiver Operating Characteristic - Area Under the Curve):</strong> Measures class-separation ability across all thresholds.<br><strong>Range:</strong> 0 to 1 (typically displayed here as 0% to 100%).<br><strong>Interpretation:</strong> 0.5 is random baseline; closer to 1 is better.<br><strong>Why %:</strong> It is naturally a bounded 0-1 score.',
};

function renderMetricLabelWithTooltip(label, tooltipKey) {
    var tooltip = METRIC_TOOLTIPS[tooltipKey] || METRIC_TOOLTIPS.default;
    return (
        '<span class="metric-label-with-help">' +
        '<span>' +
        escapeHtml(label) +
        '</span>' +
        '<span class="metric-help-icon" tabindex="0" aria-label="Info about ' +
        escapeHtml(label) +
        '">i' +
        '<span class="metric-help-tooltip">' +
        tooltip +
        '</span>' +
        '</span>' +
        '</span>'
    );
}

function emDashSpan() {
    return '<span class="metric-value empty">\u2014</span>';
}

function buildByAlgoMap(items) {
    var byAlgo = {};
    for (var i = 0; i < items.length; i++) {
        var row = items[i];
        var k = row.canonical_algorithm || canonicalAlgoKey(row.algoritma);
        if (k) byAlgo[k] = row;
    }
    return byAlgo;
}

/** Kolom tabel: hanya algoritma yang punya baris terbaik di respons API */
function setActiveTableCols(items) {
    var present = {};
    for (var i = 0; i < items.length; i++) {
        var k = items[i].canonical_algorithm || canonicalAlgoKey(items[i].algoritma);
        if (k) present[k] = true;
    }
    CURRENT_TABLE_COLS = ALGO_COLS.filter(function (key) {
        return present[key];
    });
    if (CURRENT_TABLE_COLS.length === 0) CURRENT_TABLE_COLS = ALGO_COLS.slice();
}

function normalizeCompare(val) {
    if (val === undefined || val === null || val === '') return NaN;
    var n = Number(val);
    if (!Number.isFinite(n)) return NaN;
    if (n <= 1 && n >= 0) return n * 100;
    return n;
}

/** Tinggi batang chart (skala 0–100): nilai sudah persen tidak dikali lagi */
function metricToChartHeight(metricKey, raw) {
    if (raw === undefined || raw === null || raw === '') return 0;
    var n = Number(raw);
    if (!Number.isFinite(n)) return 0;

    if (metricKey === 'mcc') {
        if (n >= -1 && n <= 1) return ((n + 1) / 2) * 100;
        return Math.min(Math.max(n, 0), 100);
    }
    if (metricKey === 'roc_auc' || metricKey === 'weighted_avg') {
        if (n <= 1 && n >= 0) return n * 100;
        return Math.min(Math.max(n, 0), 100);
    }
    if (metricKey === 'std_deviation') {
        if (n <= 1 && n >= 0) return n * 100;
        return Math.min(Math.max(n, 0), 100);
    }
    /* accuracy, precision, recall, f1 */
    if (n <= 1 && n >= 0) return n * 100;
    return Math.min(Math.max(n, 0), 100);
}

/** Teks di atas batang */
function formatBarLabel(metricKey, raw) {
    if (raw === undefined || raw === null || raw === '') return '';
    var n = Number(raw);
    if (!Number.isFinite(n)) return '';

    if (metricKey === 'std_deviation') {
        if (n <= 1 && n >= 0) return (n * 100).toFixed(1) + '%';
        return n.toFixed(2);
    }
    if (metricKey === 'mcc') {
        if (n >= -1 && n <= 1) return (n * 100).toFixed(1) + '%';
        return n.toFixed(2);
    }
    if (metricKey === 'roc_auc' || metricKey === 'weighted_avg') {
        if (n <= 1 && n >= 0) return (n * 100).toFixed(1) + '%';
        return (Math.round(n * 10) / 10).toFixed(1) + '%';
    }
    if (n <= 1 && n >= 0) return (n * 100).toFixed(1) + '%';
    return (Math.round(n * 10) / 10).toFixed(1) + '%';
}

function rowHasFieldData(byAlgo, cols, field) {
    for (var i = 0; i < cols.length; i++) {
        var m = byAlgo[cols[i]];
        if (!m || m[field] === undefined || m[field] === null || m[field] === '') continue;
        var n = Number(m[field]);
        if (Number.isFinite(n)) return true;
    }
    return false;
}

function bestIndexForRow(byAlgo, field, cols, mode) {
    mode = mode || 'max';
    var nums = cols.map(function (key) {
        var m = byAlgo[key];
        return m && m[field] !== undefined && m[field] !== null ? normalizeCompare(m[field]) : NaN;
    });
    var bi = -1;
    var bv = NaN;
    var any = false;
    for (var i = 0; i < nums.length; i++) {
        if (!isNaN(nums[i])) {
            any = true;
            if (mode === 'min') {
                if (isNaN(bv) || nums[i] < bv) {
                    bv = nums[i];
                    bi = i;
                }
            } else {
                if (isNaN(bv) || nums[i] > bv) {
                    bv = nums[i];
                    bi = i;
                }
            }
        }
    }
    return any ? bi : -1;
}

/** Sorot nilai terbaik pakai angka mentah (penting untuk MCC -1..1 dan ROC-AUC 0..1). */
function bestIndexRawField(byAlgo, cols, field, mode) {
    mode = mode || 'max';
    var nums = cols.map(function (key) {
        var m = byAlgo[key];
        if (!m || m[field] === undefined || m[field] === null) return NaN;
        var n = Number(m[field]);
        return Number.isFinite(n) ? n : NaN;
    });
    var bi = -1;
    var bv = NaN;
    var any = false;
    for (var i = 0; i < nums.length; i++) {
        if (!isNaN(nums[i])) {
            any = true;
            if (mode === 'min') {
                if (isNaN(bv) || nums[i] < bv) {
                    bv = nums[i];
                    bi = i;
                }
            } else {
                if (isNaN(bv) || nums[i] > bv) {
                    bv = nums[i];
                    bi = i;
                }
            }
        }
    }
    return any ? bi : -1;
}

function formatPercentDisplay(val) {
    if (val === undefined || val === null || val === '') return null;
    var n = Number(val);
    if (!Number.isFinite(n)) return null;
    var pct = n <= 1 && n >= 0 ? n * 100 : n;
    return Math.round(pct * 10) / 10 + '%';
}

function formatRocAucDisplay(val) {
    if (val === undefined || val === null || val === '') return null;
    var n = Number(val);
    if (!Number.isFinite(n)) return null;
    if (n <= 1 && n >= 0) return (Math.round(n * 1000) / 10).toFixed(2) + '%';
    return n.toFixed(2);
}

function formatMccDisplay(val) {
    if (val === undefined || val === null || val === '') return null;
    var n = Number(val);
    if (!Number.isFinite(n)) return null;
    if (n <= 1 && n >= -1) return (Math.round(n * 1000) / 10).toFixed(2) + '%';
    return n.toFixed(2);
}

function cellPercent(byAlgo, field, hiIdx, cols) {
    var html = '';
    for (var j = 0; j < cols.length; j++) {
        var key = cols[j];
        var m = byAlgo[key];
        var cls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';
        var disp = m ? formatPercentDisplay(m[field]) : null;
        var hl = j === hiIdx && hiIdx >= 0;
        if (disp == null) {
            html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
        } else {
            html +=
                '<td class="' +
                cls +
                '"><span class="metric-value' +
                (hl ? ' hl' : '') +
                '">' +
                escapeHtml(disp) +
                '</span></td>';
        }
    }
    return html;
}

function cellFloat(byAlgo, field, decimals, hiIdx, cols) {
    var html = '';
    for (var j = 0; j < cols.length; j++) {
        var key = cols[j];
        var m = byAlgo[key];
        var cls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';
        var v = m && m[field] !== undefined && m[field] !== null ? Number(m[field]) : NaN;
        var hl = j === hiIdx && hiIdx >= 0;
        if (!Number.isFinite(v)) {
            html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
        } else {
            html +=
                '<td class="' +
                cls +
                '"><span class="metric-value' +
                (hl ? ' hl' : '') +
                '">' +
                escapeHtml(v.toFixed(decimals != null ? decimals : 2)) +
                '</span></td>';
        }
    }
    return html;
}

function cellRocAuc(byAlgo, hiIdx, cols) {
    var html = '';
    for (var j = 0; j < cols.length; j++) {
        var key = cols[j];
        var m = byAlgo[key];
        var cls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';
        var disp = m ? formatRocAucDisplay(m.roc_auc) : null;
        var hl = j === hiIdx && hiIdx >= 0;
        if (disp == null) {
            html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
        } else {
            html +=
                '<td class="' +
                cls +
                '"><span class="metric-value' +
                (hl ? ' hl' : '') +
                '">' +
                escapeHtml(disp) +
                '</span></td>';
        }
    }
    return html;
}

function cellMcc(byAlgo, hiIdx, cols, field) {
    field = field || 'mcc';
    var html = '';
    for (var j = 0; j < cols.length; j++) {
        var key = cols[j];
        var m = byAlgo[key];
        var cls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';
        var raw = m && m[field] !== undefined && m[field] !== null ? m[field] : null;
        var disp = raw != null ? formatMccDisplay(raw) : null;
        var hl = j === hiIdx && hiIdx >= 0;
        if (disp == null) {
            html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
        } else {
            html +=
                '<td class="' +
                cls +
                '"><span class="metric-value' +
                (hl ? ' hl' : '') +
                '">' +
                escapeHtml(disp) +
                '</span></td>';
        }
    }
    return html;
}

function rowAllDash(cols) {
    var html = '';
    for (var j = 0; j < cols.length; j++) {
        var key = cols[j];
        var cls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';
        html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
    }
    return html;
}

function renderEvaluationTheads(cols) {
    var splitHead = document.getElementById('split-ratio-thead');
    if (splitHead) {
        var hSplit =
            '<tr><th>Iteration</th>' +
            cols
                .map(function (k) {
                    return '<th>' + escapeHtml(ALGO_LABELS[k] || k) + '</th>';
                })
                .join('') +
            '</tr>';
        splitHead.innerHTML = hSplit;
    }

    var compHead = document.getElementById('comparative-thead');
    if (!compHead) return;

    /* Dua baris: per algoritma colspan 2, subkolom Train | Test (dibandingkan berdampingan). */
    var rowAlgo =
        '<tr><th rowspan="2" class="th-metric-corner">Metric</th>' +
        cols
            .map(function (k) {
                var thClass = TRANSFORMER_KEYS.indexOf(k) >= 0 ? 'th-tf' : 'th-cl';
                return (
                    '<th class="' +
                    thClass +
                    ' th-algo-pair" colspan="2">' +
                    escapeHtml(String(ALGO_LABELS[k] || k).toUpperCase()) +
                    '</th>'
                );
            })
            .join('') +
        '</tr>';
    var rowSub =
        '<tr>' +
        cols
            .map(function (k) {
                var thClass = TRANSFORMER_KEYS.indexOf(k) >= 0 ? 'th-tf' : 'th-cl';
                return (
                    '<th class="' +
                    thClass +
                    ' th-sub-comp" title="Training (processing)">Tr</th><th class="' +
                    thClass +
                    ' th-sub-comp th-sub-test" title="Testing (testing module)">Te</th>'
                );
            })
            .join('') +
        '</tr>';

    compHead.innerHTML = rowAlgo + rowSub;
}

function renderSplitRatioTable(byAlgo, cols) {
    var tbody = document.getElementById('split-ratio-tbody');
    if (!tbody) return;
    var tr =
        '<tr><td class="metric-name">Split ratio (best model per algorithm)</td>';
    for (var j = 0; j < cols.length; j++) {
        var m = byAlgo[cols[j]];
        var sr = m && m.split_ratio != null && m.split_ratio !== '' ? String(m.split_ratio) : '';
        tr +=
            '<td><span class="ratio-cell">' +
            (sr ? escapeHtml(sr) : '\u2014') +
            '</span></td>';
    }
    tr += '</tr>';
    tbody.innerHTML = tr;
}

/** Satu baris per algoritma: metrik dari `testing_result` (modul testing), tanpa menimpa field training. */
function buildTestingByAlgo(byAlgo, cols) {
    var out = {};
    for (var i = 0; i < cols.length; i++) {
        var k = cols[i];
        var m = byAlgo[k];
        var tr = m && m.testing_result;
        if (!tr) continue;
        out[k] = {
            accuracy: tr.accuracy,
            precision: tr.precision_macro,
            recall: tr.recall_macro,
            f1_score: tr.f1_macro,
            std_deviation: tr.std_deviation,
            weighted_avg: tr.weighted_avg,
            roc_auc: tr.roc_auc,
            mcc: tr.mcc,
        };
    }
    return out;
}

/** Tampilan satu sel untuk kind: percent | float2 | float4 | mcc | roc | std */
function valueDisplayForKind(m, field, kind) {
    if (!m) return null;
    if (kind === 'roc') {
        return formatRocAucDisplay(m.roc_auc);
    }
    if (field == null) return null;
    if (m[field] === undefined || m[field] === '') return null;
    if (kind === 'percent') return formatPercentDisplay(m[field]);
    var n = Number(m[field]);
    if (!Number.isFinite(n)) return null;
    if (kind === 'float2') return n.toFixed(2);
    if (kind === 'float4') return n.toFixed(4);
    if (kind === 'mcc') return formatMccDisplay(m[field]);
    if (kind === 'std') return n.toFixed(2);
    return null;
}

function rowHasPairedField(byAlgo, byTest, cols, fieldTrain, fieldTest) {
    if (fieldTrain && rowHasFieldData(byAlgo, cols, fieldTrain)) return true;
    if (fieldTest && rowHasFieldData(byTest, cols, fieldTest)) return true;
    return false;
}

function bestIdxForKind(map, cols, field, kind, mode) {
    if (!map || !field) return -1;
    mode = mode || 'max';
    if (kind === 'roc') return bestIndexRawField(map, cols, 'roc_auc', 'max');
    if (kind === 'mcc') return bestIndexRawField(map, cols, field, 'max');
    if (kind === 'std') return bestIndexRawField(map, cols, 'std_deviation', 'min');
    if (kind === 'float4') return bestIndexRawField(map, cols, field, 'min');
    if (kind === 'percent' || kind === 'float2') {
        if (field === 'train_loss') return bestIndexRawField(map, cols, 'train_loss', 'min');
        return bestIndexForRow(map, field, cols, mode);
    }
    return -1;
}

function renderComparativeTable(byAlgo, cols) {
    var tbody = document.getElementById('comparative-tbody');
    if (!tbody) return;

    var byTest = buildTestingByAlgo(byAlgo, cols);
    var html = '';

    var defs = [
        {
            label: 'Accuracy',
            tooltipKey: 'accuracy',
            fieldTrain: 'accuracy',
            fieldTest: 'accuracy',
            kindTrain: 'percent',
            kindTest: 'percent',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'Precision',
            tooltipKey: 'precision',
            fieldTrain: 'precision',
            fieldTest: 'precision',
            kindTrain: 'percent',
            kindTest: 'percent',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'Recall',
            tooltipKey: 'recall',
            fieldTrain: 'recall',
            fieldTest: 'recall',
            kindTrain: 'percent',
            kindTest: 'percent',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'F1-Score',
            tooltipKey: 'f1_score',
            fieldTrain: 'f1_score',
            fieldTest: 'f1_score',
            kindTrain: 'percent',
            kindTest: 'percent',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'Macro avg (F1)',
            tooltipKey: 'macro_avg',
            fieldTrain: 'macro_avg',
            fieldTest: null,
            kindTrain: 'percent',
            kindTest: null,
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'Weighted F1',
            tooltipKey: 'weighted_avg',
            fieldTrain: null,
            fieldTest: 'weighted_avg',
            kindTrain: null,
            kindTest: 'percent',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'Std dev (F1/class)',
            tooltipKey: 'std_deviation',
            fieldTrain: null,
            fieldTest: 'std_deviation',
            kindTrain: null,
            kindTest: 'std',
            modeTrain: 'max',
            modeTest: 'min',
        },
        {
            label: 'Loss (avg.)',
            tooltipKey: 'train_loss',
            fieldTrain: 'train_loss',
            fieldTest: null,
            kindTrain: 'float4',
            kindTest: null,
            modeTrain: 'min',
            modeTest: 'max',
        },
        {
            label: 'MCC',
            tooltipKey: 'mcc',
            fieldTrain: 'train_mcc',
            fieldTest: 'mcc',
            kindTrain: 'mcc',
            kindTest: 'mcc',
            modeTrain: 'max',
            modeTest: 'max',
        },
        {
            label: 'ROC-AUC',
            tooltipKey: 'roc_auc',
            fieldTrain: null,
            fieldTest: 'roc_auc',
            kindTrain: null,
            kindTest: 'roc',
            modeTrain: 'max',
            modeTest: 'max',
        },
    ];

    for (var r = 0; r < defs.length; r++) {
        var d = defs[r];
        if (!rowHasPairedField(byAlgo, byTest, cols, d.fieldTrain, d.fieldTest)) continue;

        var hiTr =
            d.fieldTrain != null
                ? bestIdxForKind(byAlgo, cols, d.fieldTrain, d.kindTrain, d.modeTrain)
                : -1;
        var hiTe =
            d.fieldTest != null
                ? bestIdxForKind(byTest, cols, d.fieldTest, d.kindTest, d.modeTest)
                : -1;

        html +=
            '<tr><td class="metric-name">' +
            renderMetricLabelWithTooltip(d.label, d.tooltipKey) +
            '</td>';

        for (var j = 0; j < cols.length; j++) {
            var key = cols[j];
            var baseCls = TRANSFORMER_KEYS.indexOf(key) >= 0 ? 'cell-tf' : 'cell-cl';

            var mTr = d.fieldTrain ? byAlgo[key] : null;
            var mTe = d.fieldTest ? byTest[key] : null;
            var dispTr = valueDisplayForKind(mTr, d.fieldTrain, d.kindTrain);
            var dispTe = valueDisplayForKind(mTe, d.fieldTest, d.kindTest);

            var hlTr = d.fieldTrain && j === hiTr && hiTr >= 0;
            var hlTe = d.fieldTest && j === hiTe && hiTe >= 0;

            if (dispTr == null) {
                html += '<td class="' + baseCls + ' cell-pair-train">' + emDashSpan() + '</td>';
            } else {
                html +=
                    '<td class="' +
                    baseCls +
                    ' cell-pair-train"><span class="metric-value' +
                    (hlTr ? ' hl' : '') +
                    '">' +
                    escapeHtml(dispTr) +
                    '</span></td>';
            }
            if (dispTe == null) {
                html += '<td class="' + baseCls + ' cell-pair-test">' + emDashSpan() + '</td>';
            } else {
                html +=
                    '<td class="' +
                    baseCls +
                    ' cell-pair-test"><span class="metric-value' +
                    (hlTe ? ' hl' : '') +
                    '">' +
                    escapeHtml(dispTe) +
                    '</span></td>';
            }
        }
        html += '</tr>';
    }

    tbody.innerHTML = html;
}

/**
 * Pilih model dengan akurasi tertinggi pada kolom aktif; imbang F1-score.
 */
function pickBestModelAmong(byAlgo, cols) {
    var bestKey = null;
    var bestAcc = -Infinity;
    var bestF1 = -Infinity;
    var bestIdx = 999;
    for (var i = 0; i < cols.length; i++) {
        var k = cols[i];
        var m = byAlgo[k];
        if (!m) continue;
        var acc = normalizeCompare(m.accuracy);
        if (!Number.isFinite(acc)) continue;
        var f1Raw = normalizeCompare(m.f1_score);
        var f1v = Number.isFinite(f1Raw) ? f1Raw : -Infinity;
        var better = false;
        if (bestKey === null) better = true;
        else if (acc > bestAcc) better = true;
        else if (acc === bestAcc && f1v > bestF1) better = true;
        else if (acc === bestAcc && f1v === bestF1 && i < bestIdx) better = true;
        if (better) {
            bestKey = k;
            bestAcc = acc;
            bestF1 = f1v;
            bestIdx = i;
        }
    }
    if (!bestKey) return null;
    return { key: bestKey, model: byAlgo[bestKey], accuracyPct: bestAcc, f1Pct: Number.isFinite(bestF1) ? bestF1 : null };
}

/**
 * Rank algorithms by the same rule as pickBestModelAmong; build English outcome paragraphs.
 */
function buildEnglishEvaluationOutcomeHtml(byAlgo, cols) {
    var rows = [];
    for (var i = 0; i < cols.length; i++) {
        var k = cols[i];
        var m = byAlgo[k];
        if (!m) continue;
        var acc = normalizeCompare(m.accuracy);
        if (!Number.isFinite(acc)) continue;
        var f1Raw = normalizeCompare(m.f1_score);
        var f1v = Number.isFinite(f1Raw) ? f1Raw : -Infinity;
        rows.push({ key: k, acc: acc, f1: f1v, idx: i });
    }
    rows.sort(function (a, b) {
        if (b.acc !== a.acc) return b.acc - a.acc;
        if (b.f1 !== a.f1) return b.f1 - a.f1;
        return a.idx - b.idx;
    });
    if (rows.length === 0) return '';

    var best = rows[0];
    var bestLabel = escapeHtml(ALGO_LABELS[best.key] || best.key);
    var bestAccStr = escapeHtml(formatPercentDisplay(byAlgo[best.key].accuracy) || '\u2014');
    var n = rows.length;
    var parts = [];
    parts.push(
        'In this evaluation snapshot, <strong>' +
            bestLabel +
            '</strong> achieves the highest accuracy (<strong>' +
            bestAccStr +
            '</strong>) among <strong>' +
            n +
            '</strong> algorithm' +
            (n === 1 ? '' : 's') +
            ' with reported metrics on this dashboard.',
    );

    if (rows.length >= 2) {
        var second = rows[1];
        var runnerLabel = escapeHtml(ALGO_LABELS[second.key] || second.key);
        var runnerAccStr = escapeHtml(formatPercentDisplay(byAlgo[second.key].accuracy) || '\u2014');
        var gap = Math.abs(best.acc - second.acc);
        var gapStr = (Math.round(gap * 10) / 10).toFixed(1);
        parts.push(
            '<strong>' +
                runnerLabel +
                '</strong> ranks second at <strong>' +
                runnerAccStr +
                '</strong> accuracy (<strong>' +
                gapStr +
                '</strong> percentage points behind on this ranking).',
        );
    }

    var bm = byAlgo[best.key];
    var p = bm ? normalizeCompare(bm.precision) : NaN;
    var r = bm ? normalizeCompare(bm.recall) : NaN;
    if (Number.isFinite(p) && Number.isFinite(r)) {
        var delta = p - r;
        if (Math.abs(delta) >= 2) {
            if (delta > 0) {
                parts.push(
                    'For the leading model, precision is higher than recall, suggesting relatively fewer false positives among predicted positive cases.',
                );
            } else {
                parts.push(
                    'For the leading model, recall is higher than precision, suggesting broader detection of true positives at the cost of more false positives.',
                );
            }
        } else {
            parts.push(
                'Precision and recall for the leading model are close, indicating a balanced trade-off between false positives and missed positives on this split.',
            );
        }
    }

    parts.push(
        'Together, these results summarize the current offline evaluation only; they should be validated against your target use case before deployment.',
    );

    var inner = parts
        .map(function (html) {
            return '<p class="conclusion-prose">' + html + '</p>';
        })
        .join('');
    return (
        '<section class="conclusion-block" aria-labelledby="conclusion-outcome-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-outcome-h">Evaluation outcome</h3>' +
        '<div class="conclusion-prose-stack">' +
        inner +
        '</div>' +
        '</section>'
    );
}

function renderEvaluationConclusion(byAlgo, cols) {
    var root = document.getElementById('eval-conclusion');
    var el = document.getElementById('eval-conclusion-content');
    if (!el || !root) return;

    var picked = pickBestModelAmong(byAlgo, cols);
    if (!picked) {
        el.innerHTML =
            '<div class="conclusion-stack conclusion-stack--empty">' +
            '<p class="conclusion-muted">No per-algorithm model data is available to build a conclusion yet. Make sure the backend is running and training data has been saved.</p>' +
            '</div>';
        root.style.display = 'block';
        return;
    }

    var m = picked.model;
    var algoLabel = ALGO_LABELS[picked.key] || picked.key;
    var namaModel = escapeHtml(String(m.nama_model || '\u2014').trim() || '\u2014');
    var accStr = formatPercentDisplay(m.accuracy) || '\u2014';
    var precStr = formatPercentDisplay(m.precision) || '\u2014';
    var recStr = formatPercentDisplay(m.recall) || '\u2014';
    var f1Str = formatPercentDisplay(m.f1_score) || '\u2014';
    var ds = m.dataset_name ? escapeHtml(String(m.dataset_name)) : null;
    var split = m.split_ratio != null && m.split_ratio !== '' ? escapeHtml(String(m.split_ratio)) : null;

    var isTransformer = TRANSFORMER_KEYS.indexOf(picked.key) >= 0;
    var isClassic = CLASSIC_KEYS.indexOf(picked.key) >= 0;

    var konteksTeknis = '';
    if (isTransformer) {
        konteksTeknis =
            'Transformers learn word context within whole sentences, which suits Manado text when spelling variation and sentence structure need finer modeling. They are a strong comparison to models that treat words in isolation.';
    } else if (isClassic) {
        konteksTeknis =
            'This model uses static word vectors: typically lighter and faster, useful as a baseline. For complex sentence patterns, results are often compared again with a Transformer when resources allow.';
    } else {
        konteksTeknis =
            'The figures above compare every algorithm on the same dataset snapshot shown on this page.';
    }

    var dlRows = '';
    dlRows += '<div><dt>Model name</dt><dd>' + namaModel + '</dd></div>';
    dlRows +=
        '<div><dt>Dataset</dt><dd>' +
        (ds ? ds : '<span class="conclusion-dl-empty">\u2014</span>') +
        '</dd></div>';
    dlRows +=
        '<div><dt>Data split</dt><dd>' +
        (split ? split : '<span class="conclusion-dl-empty">\u2014</span>') +
        '</dd></div>';

    function metricCell(label, valueHtml) {
        return (
            '<div class="conclusion-metric">' +
            '<span class="conclusion-metric-label">' +
            label +
            '</span>' +
            '<span class="conclusion-metric-value">' +
            valueHtml +
            '</span>' +
            '</div>'
        );
    }

    el.innerHTML =
        '<div class="conclusion-stack">' +
        '<div class="conclusion-winner">' +
        '<p class="conclusion-winner-eyebrow">Based on the highest accuracy on this page</p>' +
        '<p class="conclusion-winner-title">' +
        escapeHtml(algoLabel) +
        '</p>' +
        '<p class="conclusion-winner-lead">For Manado-language text classification under the same data setup, treat this as the <strong>primary candidate</strong> according to the metrics below.</p>' +
        '</div>' +
        buildEnglishEvaluationOutcomeHtml(byAlgo, cols) +
        '<section class="conclusion-block" aria-labelledby="conclusion-metrics-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-metrics-h">Metric summary</h3>' +
        '<div class="conclusion-metrics" role="list">' +
        metricCell('Accuracy', escapeHtml(accStr)) +
        metricCell('Precision', escapeHtml(precStr)) +
        metricCell('Recall', escapeHtml(recStr)) +
        metricCell('F1-score', escapeHtml(f1Str)) +
        '</div>' +
        '</section>' +
        '<section class="conclusion-block" aria-labelledby="conclusion-detail-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-detail-h">Model details</h3>' +
        '<dl class="conclusion-dl">' +
        dlRows +
        '</dl>' +
        '</section>' +
        '<section class="conclusion-block" aria-labelledby="conclusion-why-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-why-h">Why this is recommended</h3>' +
        '<p class="conclusion-prose">' +
        escapeHtml(konteksTeknis) +
        '</p>' +
        '</section>' +
        '<aside class="conclusion-note" role="note">' +
        '<strong>Important note.</strong> This conclusion follows numeric comparison on the dashboard (not field testing). If the corpus, labels, or domain change, run the evaluation again.' +
        '</aside>' +
        '</div>';

    root.style.display = 'block';
}

function showChartLoadError(message) {
    console.error(message || 'Chart.js is not loaded. Check CDN access.');
    var main = document.querySelector('main.main') || document.body;
    var p = document.createElement('p');
    p.style.color = '#c62828';
    p.style.fontWeight = '600';
    p.style.margin = '0 0 12px';
    p.textContent = message || 'Failed to load evaluation chart.';
    main.prepend(p);
}

function loadScript(url) {
    return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function ensureChartJsLoaded() {
    if (typeof window.Chart !== 'undefined') return true;
    var cdnCandidates = [
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
        'https://unpkg.com/chart.js@4.4.7/dist/chart.umd.min.js',
    ];
    for (var i = 0; i < cdnCandidates.length; i++) {
        try {
            await loadScript(cdnCandidates[i]);
            if (typeof window.Chart !== 'undefined') return true;
        } catch (e) {
            console.warn('Failed to load Chart.js from:', cdnCandidates[i], e);
        }
    }
    return typeof window.Chart !== 'undefined';
}

/**
 * Plugin inline untuk Chart.js 4: label di atas batang.
 * Dipasang lewat array `plugins` di konfigurasi chart (bukan Chart.register),
 * agar tidak bergantung pada registry / versi UMD.
 */
function createBarValueLabelsPlugin() {
    /* Tanpa `id`: Chart.js tidak mencari options.plugins.<id> di registry */
    return {
        afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            chart.data.datasets.forEach(function (dataset, di) {
                var meta = chart.getDatasetMeta(di);
                if (meta.hidden || !meta.data) return;
                meta.data.forEach(function (element, index) {
                    var raw = dataset.rawValues ? dataset.rawValues[index] : null;
                    var mk = dataset.metricKey || 'accuracy';
                    var text = formatBarLabel(mk, raw);
                    if (!text) return;
                    var bx;
                    var by;
                    if (typeof element.getProps === 'function') {
                        var p = element.getProps(['x', 'y'], true);
                        bx = p.x;
                        by = p.y;
                    } else {
                        bx = element.x;
                        by = element.y;
                    }
                    if (bx == null || by == null) return;
                    var base = element.base;
                    var yTop = by;
                    if (base !== undefined && base !== null && Number.isFinite(Number(base))) {
                        yTop = Math.min(by, Number(base));
                    }
                    ctx.save();
                    ctx.font = '600 9px Inter, system-ui, sans-serif';
                    ctx.fillStyle = '#2c1f0e';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(text, bx, yTop - 4);
                    ctx.restore();
                });
            });
        },
    };
}

function destroyEvaluationCharts() {
    evaluationChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e) {}
    });
    evaluationChartInstances = [];
}

function buildLegend(id, cols, names) {
    var el = document.getElementById(id);
    if (!el) return;
    var h = '';
    for (var i = 0; i < names.length; i++) {
        h +=
            '<div class="leg-item"><span class="leg-dot" style="background:' +
            cols[i] +
            '"></span>' +
            names[i] +
            '</div>';
    }
    el.innerHTML = h;
}

function buildMetricDataset(metricKey, label, orderKeys, byAlgo, i, colors, borders) {
    var heights = [];
    var raws = [];
    var field = metricKey;
    if (metricKey === 'f1_score') field = 'f1_score';

    for (var k = 0; k < orderKeys.length; k++) {
        var m = byAlgo[orderKeys[k]];
        var raw = m ? m[field] : null;
        raws.push(raw);
        heights.push(metricToChartHeight(metricKey, raw));
    }

    return {
        label: label,
        metricKey: metricKey,
        rawValues: raws,
        data: heights,
        backgroundColor: colors[i % colors.length],
        hoverBackgroundColor: borders[i % borders.length],
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.58,
    };
}

function createPerformanceChart(canvasId, labels, datasets, yMaxHint) {
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    var maxVal = 0;
    for (var d = 0; d < datasets.length; d++) {
        var arr = datasets[d].data || [];
        for (var x = 0; x < arr.length; x++) {
            if (Number(arr[x]) > maxVal) maxVal = Number(arr[x]);
        }
    }
    var yMax = Math.min(100, Math.ceil(Math.max(maxVal * 1.08, 10)));
    if (yMaxHint != null) yMax = yMaxHint;

    var chart = new Chart(ctx, {
        type: 'bar',
        plugins: [createBarValueLabelsPlugin()],
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 28, left: 4, right: 4 } },
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        callback: function (v) {
                            return v + '%';
                        },
                    },
                },
            },
        },
    });
    evaluationChartInstances.push(chart);
}

async function fetchBestModels() {
    var res = await fetch(API_BASE + '/evaluasi/best-models');
    var data = await res.json();
    if (!res.ok)
        throw new Error(
            data && (data.detail || data.message)
                ? data.detail || data.message
                : 'Failed to fetch evaluation data.',
        );
    return Array.isArray(data.items) ? data.items : [];
}

async function initEvaluationCharts(itemsOptional, byAlgoOptional) {
    if (typeof window.Chart === 'undefined') {
        showChartLoadError('Chart.js is not loaded.');
        return;
    }

    var items = itemsOptional || (await fetchBestModels());
    var byAlgo = byAlgoOptional || buildByAlgoMap(items);

    /* Grafik Transformer & Classic: identik — hanya Accuracy/Precision/Recall/F1 (sumber models).
       Metrik testing_results tetap di tabel Comparative Analysis, bukan di chart. */
    var metricDefsChart = [
        { key: 'accuracy', label: 'Accuracy' },
        { key: 'precision', label: 'Precision' },
        { key: 'recall', label: 'Recall' },
        { key: 'f1_score', label: 'F1-Score' },
    ];

    var colors = [
        'rgba(44, 31, 14, 0.88)',
        'rgba(70, 52, 30, 0.85)',
        'rgba(100, 70, 40, 0.82)',
        'rgba(130, 90, 50, 0.78)',
        'rgba(90, 110, 55, 0.82)',
        'rgba(120, 85, 60, 0.78)',
        'rgba(55, 75, 95, 0.82)',
        'rgba(95, 65, 90, 0.75)',
    ];
    var borders = [
        '#2c1f0e',
        '#46341e',
        '#644628',
        '#825a32',
        '#5a6e37',
        '#8b5a40',
        '#3d556e',
        '#6e4570',
    ];

    var transformerOrder = TRANSFORMER_KEYS.filter(function (k) {
        return byAlgo[k];
    });
    var classicOrder = CLASSIC_KEYS.filter(function (k) {
        return byAlgo[k];
    });
    var transformerLabels = transformerOrder.map(function (k) {
        return ALGO_LABELS[k] || k;
    });
    var classicLabels = classicOrder.map(function (k) {
        return ALGO_LABELS[k] || k;
    });

    destroyEvaluationCharts();

    /* Hanya metrik yang punya minimal satu nilai di grup chart */
    function defsWithData(orderKeys) {
        return metricDefsChart.filter(function (def) {
            for (var i = 0; i < orderKeys.length; i++) {
                var m = byAlgo[orderKeys[i]];
                if (!m || m[def.key] === undefined || m[def.key] === null || m[def.key] === '')
                    continue;
                if (Number.isFinite(Number(m[def.key]))) return true;
            }
            return false;
        });
    }

    var defsTf = defsWithData(transformerOrder);
    var defsCl = defsWithData(classicOrder);

    if (transformerOrder.length && defsTf.length) {
        var dsTf = defsTf.map(function (def, idx) {
            return buildMetricDataset(
                def.key,
                def.label,
                transformerOrder,
                byAlgo,
                idx,
                colors,
                borders,
            );
        });
        createPerformanceChart('chartTransformer', transformerLabels, dsTf);
        buildLegend(
            'legendTransformer',
            colors,
            defsTf.map(function (d) {
                return d.label;
            }),
        );
    }

    if (classicOrder.length && defsCl.length) {
        var dsCl = defsCl.map(function (def, idx) {
            return buildMetricDataset(def.key, def.label, classicOrder, byAlgo, idx, colors, borders);
        });
        createPerformanceChart('chartClassic', classicLabels, dsCl);
        buildLegend(
            'legendClassic',
            colors,
            defsCl.map(function (d) {
                return d.label;
            }),
        );
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    var items;
    try {
        items = await fetchBestModels();
        setActiveTableCols(items);
        var cols = CURRENT_TABLE_COLS;
        var byAlgo = buildByAlgoMap(items);
        renderEvaluationTheads(cols);
        renderSplitRatioTable(byAlgo, cols);
        renderComparativeTable(byAlgo, cols);
        renderEvaluationConclusion(byAlgo, cols);
    } catch (e) {
        showChartLoadError(e && e.message ? e.message : 'Failed to load evaluation tables.');
        items = [];
        renderEvaluationConclusion({}, []);
    }

    var loaded = await ensureChartJsLoaded();
    if (!loaded) {
        showChartLoadError('Failed to load Chart.js.');
        return;
    }
    try {
        var byAlgoChart =
            items && items.length ? buildByAlgoMap(items) : {};
        await initEvaluationCharts(items, byAlgoChart);
    } catch (e) {
        showChartLoadError(e && e.message ? e.message : 'Failed to render evaluation chart.');
    }
});
