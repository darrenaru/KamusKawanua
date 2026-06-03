/**
 * Kontrak data evaluasi (hindari konflik training vs testing):
 * - Kolom training di `models`: accuracy, precision, recall, f1_score, train_*.
 * - Kolom testing di `models`: test_* (+ nested `testing_result` dari API).
 * - Tabel training metrics: hanya sumber training (tanpa fallback testing).
 * - Tabel Training vs Testing: metrik testing untuk std/weighted/roc/loss memakai
 *   nilai testing yang sama di kedua kolom (perilaku perbandingan selaras versi lama).
 */
var API_BASE = 'http://127.0.0.1:8000';
var ALGO_ORDER = ['indobert', 'mbert', 'xlm-r', 'word2vec', 'glove'];
var ALGO_LABELS = {
    'xlm-r': 'XLM-R',
    mbert: 'mBERT',
    indobert: 'INDOBERT',
    word2vec: 'Word2Vec',
    glove: 'GloVe',
};
var TRANSFORMER_KEYS = ['indobert', 'mbert', 'xlm-r'];
var CLASSIC_KEYS = ['word2vec', 'glove'];
var CHART_COLORS = {
    transformerDark: 'rgba(28, 20, 10, 0.9)',
    transformerDarkSoft: 'rgba(28, 20, 10, 0.7)',
    classicLight: 'rgba(220, 186, 131, 0.9)',
    classicLightSoft: 'rgba(220, 186, 131, 0.7)',
};
var CHART_METRIC_DEFS = [
    { key: 'accuracy', label: 'Accuracy', testField: 'accuracy', asPercent: true },
    { key: 'accuracy_vs_f1', label: 'Accuracy vs F1', asPercent: true },
    { key: 'precision', label: 'Precision', testField: 'precision_macro', asPercent: true },
    { key: 'recall', label: 'Recall', testField: 'recall_macro', asPercent: true },
    { key: 'f1', label: 'F1', testField: 'f1_macro', asPercent: true },
    { key: 'weighted', label: 'Weighted Avg', testField: 'weighted_avg', asPercent: true },
    { key: 'std_dev', label: 'Std Dev', testField: 'std_deviation', asPercent: false },
    { key: 'mcc', label: 'MCC', testField: 'mcc', asPercent: false },
    { key: 'roc_auc', label: 'ROC-AUC', testField: 'roc_auc', asPercent: true },
];
var TABLE_METRIC_DEFS = [
    { key: 'accuracy', label: 'Accuracy', trainField: 'accuracy', testField: 'accuracy', type: 'percent' },
    { key: 'precision', label: 'Precision', trainField: 'precision', testField: 'precision_macro', type: 'percent' },
    { key: 'recall', label: 'Recall', trainField: 'recall', testField: 'recall_macro', type: 'percent' },
    { key: 'f1', label: 'F1', trainField: 'f1_score', testField: 'f1_macro', type: 'percent' },
    { key: 'macro_avg', label: 'Macro Avg', trainField: 'macro_avg', testField: null, type: 'percent' },
    { key: 'weighted_avg', label: 'Weighted Avg', trainField: 'train_weighted_avg', testField: 'weighted_avg', type: 'percent' },
    { key: 'std_dev', label: 'Std Dev', trainField: 'train_std_deviation', testField: 'std_deviation', type: 'float2' },
    { key: 'loss', label: 'Loss', trainField: 'train_loss', testField: null, type: 'float4' },
    { key: 'mcc', label: 'MCC', trainField: 'train_mcc', testField: 'mcc', type: 'mcc' },
    { key: 'roc_auc', label: 'ROC-AUC', trainField: 'train_roc_auc', testField: 'roc_auc', type: 'percent' },
];

/** Supabase training_logs keyed by nama_model|algo (filled on page load). */
var trainingLogCache = {};
/** model_epoch_metrics keyed by model id (detail modal + metric fallbacks). */
var modelEpochsCache = {};

var state = {
    allItems: [],
    byAlgo: {},
    orderedAlgos: [],
    selectedTableAlgo: '',
    selectedChartMetric: 'accuracy',
    charts: [],
};

function canonicalAlgoKey(raw) {
    var v = String(raw || '').toLowerCase().trim().replace(/_/g, '-');
    if (v === 'indo-bert' || v === 'indobenchmark') return 'indobert';
    if (v === 'm-bert' || v === 'multilingual-bert' || v === 'bert-base-multilingual-cased') return 'mbert';
    if (v === 'xlm-r-2' || v === 'xlmr' || v === 'xlm-r') return 'xlm-r';
    if (v === 'word2vec' || v === 'word-2-vec') return 'word2vec';
    return v;
}

function escapeHtml(s) {
    var t = document.createElement('div');
    t.textContent = s == null ? '' : String(s);
    return t.innerHTML;
}

function normalizeLossPercent(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n >= 0 && n <= 1) return n * 100;
    return n;
}

function formatLossPct(raw) {
    var n = normalizeLossPercent(raw);
    if (n == null) return '—';
    return (Math.round(n * 100) / 100).toFixed(2) + '%';
}

function formatPercent(raw) {
    return formatPercentDisplay(raw);
}

function formatMcc(raw) {
    return formatMccDisplay(raw);
}

function formatFloatOrDash(raw, decimals) {
    if (raw === undefined || raw === null || raw === '') return '—';
    var n = Number(raw);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(decimals);
}

function formatByType(raw, type) {
    if (type === 'percent') return formatPercent(raw);
    if (type === 'mcc') return formatMcc(raw);
    if (type === 'loss_pct') return formatLossPct(raw);
    if (type === 'float4') return formatFloatOrDash(raw, 4);
    if (type === 'float2') return formatFloatOrDash(raw, 2);
    return raw == null ? '—' : String(raw);
}

function mean(values) {
    if (!values.length) return null;
    var sum = values.reduce(function (a, b) {
        return a + b;
    }, 0);
    return sum / values.length;
}

function stdDev(values) {
    if (!values || values.length < 2) return null;
    var m = mean(values);
    if (m == null) return null;
    var variance = values.reduce(function (acc, v) {
        var d = v - m;
        return acc + d * d;
    }, 0) / values.length;
    return Math.sqrt(variance);
}

function trainingMacroAvg(model) {
    var p = normalizePercent(model.precision);
    var r = normalizePercent(model.recall);
    var f = normalizePercent(model.f1_score);
    if (p == null || r == null || f == null) return null;
    return (p + r + f) / 3;
}

function trainingMetricResultRows(model) {
    var hist = findHistoryByModel(model);
    if (hist && Array.isArray(hist.hasil) && hist.hasil.length) {
        return hist.hasil;
    }
    if (model && model.id != null && Array.isArray(modelEpochsCache[model.id])) {
        return modelEpochsCache[model.id];
    }
    return [];
}

function trainingRocFromHistory(model) {
    var results = trainingMetricResultRows(model);
    var rocVals = results
        .map(function (r) {
            return normalizePercent(r.roc_auc);
        })
        .filter(function (v) {
            return v != null;
        });
    return mean(rocVals);
}

function parseStoredNumber(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    var s = String(raw).trim().replace(',', '.');
    var n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/** Nilai numerik pertama yang ada dari daftar kunci (snake_case di Supabase). */
function pickFirstStoredNumber(row, keys) {
    if (!row) return null;
    for (var i = 0; i < keys.length; i++) {
        var n = parseStoredNumber(row[keys[i]]);
        if (n != null) return n;
    }
    return null;
}

/**
 * Satukan std dev ke skala 0–1 (selaras sklearn / test_std_deviation).
 * Data lama: std F1 antar epoch sering tersimpan sebagai persen (mis. 1.69 → 0.0169).
 */
function normalizeStdDevComparisonScale(n) {
    if (n == null || !Number.isFinite(n)) return null;
    var x = Number(n);
    if (x > 1) return x / 100;
    if (x > 0.15) return x / 100;
    return x;
}

/**
 * Std dev training dari Supabase.
 * Utama: `std_deviation` (kolom Anda). Jika `train_std_deviation` lama bentrok, pilih yang
 * paling dekat dengan nilai testing (hindari 1.69 vs 0.02 palsu).
 */
function trainStdDevFromSupabase(model) {
    if (!model) return null;
    var legacy = normalizeStdDevComparisonScale(parseStoredNumber(model.std_deviation));
    var trainCol = normalizeStdDevComparisonScale(
        pickFirstStoredNumber(model, ['train_std_deviation', 'train_std_dev']),
    );
    var testN = testStdDevFromSupabase(model);
    if (legacy != null && trainCol != null && testN != null) {
        if (Math.abs(legacy - testN) <= Math.abs(trainCol - testN)) return legacy;
        return trainCol;
    }
    if (legacy != null) return legacy;
    if (trainCol != null) return trainCol;
    return normalizeStdDevComparisonScale(
        pickFirstStoredNumber(model, ['std_deviation', 'train_std_deviation', 'train_std_dev']),
    );
}

/** Std dev testing: `test_std_deviation` atau nested `testing_result.std_deviation`. */
function testStdDevFromSupabase(model) {
    if (!model) return null;
    var nested = model.testing_result || {};
    var n = pickFirstStoredNumber(model, ['test_std_deviation', 'test_std_dev']);
    if (n == null) {
        n = parseStoredNumber(nested.std_deviation);
    }
    return normalizeStdDevComparisonScale(n);
}

function trainingMccFromHistory(model) {
    var results = trainingMetricResultRows(model);
    var mccVals = results
        .map(function (r) {
            return normalizeMcc(r.mcc);
        })
        .filter(function (v) {
            return v != null;
        });
    return mean(mccVals);
}

function resolveTrainingMetricRaw(model, metricDef) {
    if (!model || !metricDef) return null;

    if (metricDef.key === 'std_dev') {
        return trainStdDevFromSupabase(model);
    }

    var raw = metricDef.trainField ? model[metricDef.trainField] : null;
    if (raw !== null && raw !== undefined && raw !== '') return raw;

    if (metricDef.key === 'macro_avg') {
        raw = trainingMacroAvg(model);
        if (raw != null) return raw;
    }
    if (metricDef.key === 'weighted_avg') {
        raw = model.train_weighted_avg != null ? model.train_weighted_avg : model.f1_score;
    }
    if (metricDef.key === 'roc_auc') {
        if (raw === null || raw === undefined || raw === '') {
            raw = model.train_roc_auc;
        }
        if (raw === null || raw === undefined || raw === '') {
            raw = trainingRocFromHistory(model);
        }
    }
    if (metricDef.key === 'mcc') {
        if (raw === null || raw === undefined || raw === '') {
            raw = trainingMccFromHistory(model);
        }
    }
    return raw;
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
        } catch (e) {}
    }
    return typeof window.Chart !== 'undefined';
}

function destroyCharts() {
    for (var i = 0; i < state.charts.length; i++) {
        try {
            state.charts[i].destroy();
        } catch (e) {}
    }
    state.charts = [];
}

function formatPercentOrDash(value) {
    return value == null ? '—' : (Math.round(value * 10) / 10).toFixed(1) + '%';
}

function readPreferredAlgorithm() {
    try {
        var raw =
            localStorage.getItem('kamusWorkflowAlgorithm') ||
            localStorage.getItem('selectedAlgorithm') ||
            '';
        try {
            var sess = sessionStorage.getItem('evaluasi_selectedTableAlgo');
            if (sess) raw = sess;
        } catch (e2) {}
        return canonicalAlgoKey(raw || '');
    } catch (e) {
        return '';
    }
}

function groupByAlgorithm(items) {
    var out = {};
    for (var i = 0; i < items.length; i++) {
        var row = items[i];
        var key = canonicalAlgoKey(row.canonical_algorithm || row.algoritma);
        if (!key) continue;
        row.canonical_algorithm = key;
        if (key === 'xlm-r') {
            row.algoritma = 'xlm-r';
        }
        if (!out[key]) out[key] = [];
        out[key].push(row);
    }
    if (out['xlm-r-2']) {
        out['xlm-r'] = (out['xlm-r'] || []).concat(out['xlm-r-2']);
        delete out['xlm-r-2'];
    }
    return out;
}

function orderedAlgorithmKeys(byAlgo) {
    var present = Object.keys(byAlgo).map(function (k) {
        return canonicalAlgoKey(k);
    }).filter(function (k) {
        return !!k;
    });
    var unique = [];
    for (var u = 0; u < present.length; u++) {
        if (unique.indexOf(present[u]) < 0) unique.push(present[u]);
    }
    var ordered = ALGO_ORDER.filter(function (k) {
        return unique.indexOf(k) >= 0;
    });
    for (var i = 0; i < unique.length; i++) {
        if (ordered.indexOf(unique[i]) < 0) ordered.push(unique[i]);
    }
    return ordered;
}

async function fetchEvaluationItems() {
    if (typeof window.kamusSyncXlmModelsToSupabase === 'function') {
        try {
            await window.kamusSyncXlmModelsToSupabase({ silent: true });
        } catch (syncErr) {
            console.warn('evaluasi: XLM Supabase sync skipped', syncErr);
        }
    }
    var res = await fetch(API_BASE + '/evaluasi/models-metrics');
    var data = await res.json();
    if (!res.ok) {
        throw new Error(
            data && (data.detail || data.message)
                ? data.detail || data.message
                : 'Failed to fetch evaluation data.',
        );
    }
    var items = Array.isArray(data.items) ? data.items : [];
    if (typeof window.kamusFilterXlmModelRows === 'function') {
        items = window.kamusFilterXlmModelRows(items);
    } else if (typeof window.kamusFilterXlmEvaluationItems === 'function') {
        items = window.kamusFilterXlmEvaluationItems(items);
    }
    return items;
}

function trainingLogCacheKey(model) {
    var name = String(model.nama_model || '').trim().toLowerCase();
    var algo = canonicalAlgoKey(model.canonical_algorithm || model.algoritma || '');
    return name + '|' + (algo || '');
}

async function fetchTrainingLogForModel(model) {
    var key = trainingLogCacheKey(model);
    if (Object.prototype.hasOwnProperty.call(trainingLogCache, key)) {
        return trainingLogCache[key];
    }
    var name = String(model.nama_model || '').trim();
    if (!name) {
        trainingLogCache[key] = null;
        return null;
    }
    try {
        var qs = new URLSearchParams({ nama_model: name });
        var algo = model.canonical_algorithm || model.algoritma;
        if (algo) qs.set('algoritma', String(algo));
        var res = await fetch(API_BASE + '/evaluasi/training-log?' + qs.toString());
        var data = await res.json();
        if (!res.ok) {
            trainingLogCache[key] = null;
            return null;
        }
        trainingLogCache[key] = data.log || null;
        return trainingLogCache[key];
    } catch (e) {
        console.warn('evaluasi: training-log lookup failed', e);
        trainingLogCache[key] = null;
        return null;
    }
}

async function prefetchTrainingLogsForModels(items) {
    var seen = {};
    var tasks = [];
    for (var i = 0; i < items.length; i++) {
        var key = trainingLogCacheKey(items[i]);
        if (seen[key]) continue;
        seen[key] = true;
        tasks.push(fetchTrainingLogForModel(items[i]));
    }
    await Promise.all(tasks);
}

async function fetchModelEpochsForModel(model) {
    if (model.id == null) return [];
    if (Object.prototype.hasOwnProperty.call(modelEpochsCache, model.id)) {
        return modelEpochsCache[model.id];
    }
    try {
        var res = await fetch(API_BASE + '/evaluasi/model-epochs/' + model.id);
        var data = await res.json();
        if (res.ok && Array.isArray(data.items)) {
            modelEpochsCache[model.id] = data.items;
            return data.items;
        }
    } catch (e) {
        console.warn('evaluasi: model-epochs prefetch failed', e);
    }
    modelEpochsCache[model.id] = [];
    return [];
}

async function prefetchEpochMetricsForModels(items) {
    var need = items.filter(function (m) {
        if (m.id == null) return false;
        var needsStd =
            (m.train_std_deviation == null || m.train_std_deviation === '') &&
            (m.std_deviation == null || m.std_deviation === '');
        var needsMcc = m.train_mcc == null || m.train_mcc === '';
        var needsRoc = m.train_roc_auc == null || m.train_roc_auc === '';
        return needsStd || needsMcc || needsRoc;
    });
    await Promise.all(need.map(fetchModelEpochsForModel));
}

function renderAlgoSelect(selectId, keys, selected) {
    var el = document.getElementById(selectId);
    if (!el) return;
    var html = keys
        .map(function (k) {
            var label = ALGO_LABELS[k] || k.toUpperCase();
            var isSel = k === selected ? ' selected' : '';
            return '<option value="' + escapeHtml(k) + '"' + isSel + '>' + escapeHtml(label) + '</option>';
        })
        .join('');
    el.innerHTML = html;
}

function renderTrainingTable(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    var thead = document.getElementById('training-metrics-thead');
    var tbody = document.getElementById('training-metrics-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML =
        '<tr><th>Model</th>' +
        TABLE_METRIC_DEFS.map(function (d) {
            return '<th>' + d.label + '</th>';
        }).join('') +
        '</tr>';
    if (!rows.length) {
        tbody.innerHTML =
            '<tr><td colspan="' +
            String(TABLE_METRIC_DEFS.length + 1) +
            '" class="empty-row">No training data available.</td></tr>';
        return;
    }

    var bestTraining = getBestTrainingModel(rows);
    renderTrainingBestInfo(algoKey, bestTraining);

    var bodyRows = rows
        .map(function (m) {
            var trClass = bestTraining && m === bestTraining ? ' class="row-best-training"' : '';
            var metricCells = TABLE_METRIC_DEFS.map(function (d) {
                var raw =
                    d.key === 'std_dev'
                        ? trainStdDevFromSupabase(m)
                        : resolveTrainingMetricRaw(m, d);
                return '<td>' + formatByType(raw, d.type) + '</td>';
            }).join('');
            return (
                '<tr' + trClass + '>' +
                '<td><button type="button" class="model-link-btn" data-model-id="' + escapeHtml(String(m.id || '')) + '">' + escapeHtml(m.nama_model || '-') + '</button></td>' +
                metricCells +
                '</tr>'
            );
        })
        .join('');
    tbody.innerHTML = bodyRows;
}

/** Export-only: Testing metrics sheet (no on-page testing table). */
function buildTestingMetricsExportMatrix(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    if (!rows.length) return null;
    var header = ['MODEL'].concat(
        TABLE_METRIC_DEFS.map(function (d) {
            return String(d.label || '').toUpperCase();
        }),
    );
    var body = rows.map(function (m) {
        var t = m.testing_result || {};
        var cells = TABLE_METRIC_DEFS.map(function (d) {
            var raw = d.testField ? t[d.testField] : null;
            if ((raw === null || raw === undefined || raw === '') && d.key === 'macro_avg') {
                var p = normalizePercent(t.precision_macro);
                var r = normalizePercent(t.recall_macro);
                var f = normalizePercent(t.f1_macro);
                if (p != null && r != null && f != null) {
                    raw = (p + r + f) / 3;
                }
            }
            if ((raw === null || raw === undefined || raw === '') && d.key === 'loss') {
                raw = m.train_loss;
            }
            return formatByType(raw, d.type);
        });
        return [m.nama_model || '-'].concat(cells);
    });
    return [header].concat(body);
}

function resolveParamDisplayEval(p, camel, snake) {
    if (!p || typeof p !== 'object') return undefined;
    var c = p[camel];
    if (c !== undefined && c !== null && c !== '') return c;
    if (snake && p[snake] !== undefined && p[snake] !== null && p[snake] !== '') {
        return p[snake];
    }
    return undefined;
}

function resolveMaxLengthDisplayEval(p) {
    var v = resolveParamDisplayEval(p || {}, 'maxLength', 'max_length');
    return v === undefined || v === null || v === '' ? '-' : String(v);
}

function isTransformerAlgoEval(algo) {
    var k = canonicalAlgoKey(algo);
    return TRANSFORMER_KEYS.indexOf(k) >= 0;
}

function buildModelParameterViewFromRow(model) {
    if (!model) return {};
    var hist = findHistoryByModel(model);
    var p = hist && hist.parameter ? Object.assign({}, hist.parameter) : {};
    var algo = p.algo || model.canonical_algorithm || model.algoritma;
    p.algo = algo;
    if (resolveParamDisplayEval(p, 'maxLength', 'max_length') === undefined && model.max_length != null) {
        p.maxLength = model.max_length;
    }
    if (!p.batchSize && model.batch_size != null) p.batchSize = model.batch_size;
    if (!p.lr && model.learning_rate != null) p.lr = model.learning_rate;
    if (!p.epoch && model.epoch != null) p.epoch = model.epoch;
    if (!p.seed && model.seed != null) p.seed = model.seed;
    if (!p.optimizer && model.optimizer) p.optimizer = model.optimizer;
    if (!p.weightDecay && model.weight_decay != null) p.weightDecay = model.weight_decay;
    if (!p.scheduler && model.scheduler) p.scheduler = model.scheduler;
    if (!p.dropout && model.dropout != null) p.dropout = model.dropout;
    if (!p.warmup && model.warmup_ratio != null) p.warmup = model.warmup_ratio;
    if (!p.gradAccum && model.gradient_accumulation != null) {
        p.gradAccum = model.gradient_accumulation;
    }
    if (!p.earlyStopping && model.early_stopping != null) {
        p.earlyStopping = model.early_stopping;
    }
    return p;
}

function buildLayeredParameterHtml(p) {
    if (!p) return '<p style="color:#999;">Parameter not available</p>';
    var algo = String(p.algo || p.canonical_algorithm || p.algoritma || '').toLowerCase();
    var algoKey = canonicalAlgoKey(algo);
    var gridStart = '<div class="layer-grid">';
    var gridEnd = '</div>';
    var sectionWrapStart = '<div class="layer-block"><h5 class="layer-title">';
    var sectionMid = '</h5>';
    var sectionWrapEnd = '</div>';

    function value(v) { return v == null || v === '' ? '-' : String(v); }
    function item(label, v) { return '<span><strong>' + label + ':</strong> ' + escapeHtml(value(v)) + '</span>'; }
    var inputReprLabel =
        algoKey === 'xlm-r'
            ? 'SentencePiece tokens (XLM-RoBERTa)'
            : isTransformerAlgoEval(algoKey)
              ? 'WordPiece Tokens + [CLS]/[SEP]'
              : 'Word Embedding';
    var inputLayerItems = [
        item('Batch Size', resolveParamDisplayEval(p, 'batchSize', 'batch_size')),
    ];
    if (isTransformerAlgoEval(algoKey)) {
        inputLayerItems.push(item('Max Length', resolveMaxLengthDisplayEval(p)));
        inputLayerItems.push(item('Seed', p.seed));
    }
    inputLayerItems.push(item('Input Representation', inputReprLabel));

    var inputLayer = sectionWrapStart + '1. Input Layer' + sectionMid + gridStart +
        inputLayerItems.join('') +
        gridEnd + sectionWrapEnd;

    var hiddenLayerItems = [
        item('Learning Rate', p.lr || p.learning_rate),
        item('Epoch', p.epoch),
        item('Optimizer', p.optimizer),
        item('Weight Decay', p.weightDecay || p.weight_decay),
        item('Scheduler', p.scheduler),
        item('Dropout', p.dropout),
    ];

    if (isTransformerAlgoEval(algoKey)) {
        hiddenLayerItems.push(item('Warmup', p.warmup || p.warmup_ratio));
        hiddenLayerItems.push(
            item(
                'Gradient Accumulation',
                resolveParamDisplayEval(p, 'gradAccum', 'gradient_accumulation'),
            ),
        );
    } else if (algo === 'word2vec') {
        hiddenLayerItems.push(item('Vector Size', p.vectorSize || p.vector_size));
        hiddenLayerItems.push(item('Window Size', p.windowSize || p.window_size));
        hiddenLayerItems.push(item('Min Count', p.minCount || p.min_count));
        hiddenLayerItems.push(item('Model Type', p.modelType || p.model_type));
        hiddenLayerItems.push(item('Negative', p.negative));
    } else if (algo === 'glove') {
        hiddenLayerItems.push(item('Vector Size', p.vectorSize || p.vector_size));
        hiddenLayerItems.push(item('Window Size', p.windowSize || p.window_size));
        hiddenLayerItems.push(item('Min Count', p.minCount || p.min_count));
        hiddenLayerItems.push(item('X Max', p.xMax || p.x_max));
        hiddenLayerItems.push(item('Alpha', p.alpha));
    }

    var hiddenLayer = sectionWrapStart + '2. Hidden Layer' + sectionMid + gridStart + hiddenLayerItems.join('') + gridEnd + sectionWrapEnd;
    var outputLayer = sectionWrapStart + '3. Output Layer' + sectionMid + gridStart +
        item('Output Activation', 'Softmax') +
        item('Loss Function', 'Cross Entropy') +
        item('Early Stopping', (p.earlyStopping || p.early_stopping) === '0' ? 'Disabled' : (p.earlyStopping || p.early_stopping)) +
        gridEnd + sectionWrapEnd;

    return inputLayer + hiddenLayer + outputLayer;
}

async function openEvaluationModelDetail(model) {
    var modal = document.getElementById('eval-model-detail-modal');
    if (!modal || !model) return;
    var modelNameEl = document.getElementById('eval-detail-model-name');
    var algoEl = document.getElementById('eval-detail-algo');
    var ratioEl = document.getElementById('eval-detail-ratio');
    var datasetEl = document.getElementById('eval-detail-dataset');
    var dateEl = document.getElementById('eval-detail-date');
    var paramsEl = document.getElementById('eval-detail-params');
    var resultsBody = document.getElementById('eval-history-results-body');
    var avgFoot = document.getElementById('eval-history-average-row');
    var confusionSection = document.getElementById('eval-history-confusion-section');
    var confusionMeta = document.getElementById('eval-history-confusion-meta');
    var confusionTable = document.getElementById('eval-history-confusion-table');
    var confusionEmpty = document.getElementById('eval-history-confusion-empty');

    if (modelNameEl) modelNameEl.textContent = model.nama_model || '-';
    if (algoEl) algoEl.textContent = ALGO_LABELS[model.canonical_algorithm] || model.algoritma || '-';
    if (ratioEl) ratioEl.textContent = model.split_ratio || '-';
    if (datasetEl) datasetEl.textContent = model.dataset_name || '-';
    if (dateEl) dateEl.textContent = model.created_at ? new Date(model.created_at).toLocaleString('en-US') : '-';
    var paramView = buildModelParameterViewFromRow(model);
    if (paramsEl) paramsEl.innerHTML = buildLayeredParameterHtml(paramView);

    if (resultsBody) {
        resultsBody.innerHTML =
            '<tr><td colspan="6" style="text-align:center; color:#999;">Loading...</td></tr>';
    }
    if (avgFoot) avgFoot.innerHTML = '';
    if (confusionSection) confusionSection.style.display = 'none';
    modal.style.display = 'flex';

    var results = [];
    if (model.id != null) {
        try {
            var res = await fetch(API_BASE + '/evaluasi/model-epochs/' + model.id);
            var data = await res.json();
            if (res.ok && Array.isArray(data.items)) {
                results = data.items;
                if (model.id != null) {
                    modelEpochsCache[model.id] = results;
                }
            } else if (!res.ok && data.detail) {
                console.error('Failed to fetch model epochs:', data.detail);
            }
        } catch (e) {
            console.error('Failed to fetch model epochs:', e);
        }
    }

    if (!results.length) {
        var hist = findHistoryByModel(model);
        if (hist && Array.isArray(hist.hasil)) {
            results = hist.hasil;
        }
    }

    renderEvaluationEpochMetrics(
        results,
        resultsBody,
        avgFoot,
        confusionSection,
        confusionMeta,
        confusionTable,
        confusionEmpty,
    );
}

function loadTrainingHistoryItems() {
    try {
        var raw = localStorage.getItem('training_history');
        var parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function findHistoryByModel(model) {
    var cacheKey = trainingLogCacheKey(model);
    if (trainingLogCache[cacheKey]) {
        return trainingLogCache[cacheKey];
    }

    var history = loadTrainingHistoryItems();
    if (!history.length) return null;
    var modelName = String(model.nama_model || '').trim().toLowerCase();
    var algo = String(model.canonical_algorithm || model.algoritma || '').trim().toLowerCase();
    var modelCanon = canonicalAlgoKey(algo);
    var filtered = history.filter(function (h) {
        var params = h.parameter || {};
        var hn = String(
            h.model_name ||
                h.nama_model ||
                params.model_name ||
                '',
        )
            .trim()
            .toLowerCase();
        var ha = String(
            h.algo || params.algo || (params && params.algo) || '',
        )
            .trim()
            .toLowerCase();
        var histCanon = canonicalAlgoKey(ha);
        return (
            hn === modelName &&
            (!modelCanon || !histCanon || modelCanon === histCanon)
        );
    });
    if (!filtered.length) return null;
    filtered.sort(function (a, b) {
        return new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime();
    });
    return filtered[0];
}

/** Confusion matrix row/column labels: keep dataset / model class strings as stored. */
function confusionMatrixLabelAsStored(raw) {
    return String(raw == null ? '' : raw).trim();
}

function pickEpochF1(row) {
    if (row.f1 != null && row.f1 !== '') return Number(row.f1);
    if (row.f1_score != null && row.f1_score !== '') return Number(row.f1_score);
    return NaN;
}

function renderEvaluationEpochMetrics(results, tbody, avgFoot, confusionSection, confusionMeta, confusionTable, confusionEmpty) {
    if (!tbody || !avgFoot) return;
    if (!results || !results.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">Result data not available</td></tr>';
        avgFoot.innerHTML = '';
        if (confusionSection) confusionSection.style.display = 'none';
        return;
    }

    var bestAcc = -Infinity;
    var bestEpoch = -1;
    for (var i = 0; i < results.length; i++) {
        var acc = Number(results[i].accuracy);
        if (Number.isFinite(acc) && acc > bestAcc) {
            bestAcc = acc;
            bestEpoch = results[i].epoch;
        }
    }

    tbody.innerHTML = results.map(function (r) {
        var isBest = r.epoch === bestEpoch;
        var f1Val = pickEpochF1(r);
        return (
            '<tr class="' + (isBest ? 'best-row' : '') + '">' +
            '<td>' + escapeHtml(String(r.epoch == null ? '-' : r.epoch)) + '</td>' +
            '<td>' + formatFloatOrDash(r.accuracy, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.precision, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.recall, 2) + '%</td>' +
            '<td>' + (Number.isFinite(f1Val) ? f1Val.toFixed(2) : '—') + '%</td>' +
            '<td>' + formatFloatOrDash(r.loss, 4) + '</td>' +
            '</tr>'
        );
    }).join('');

    var count = results.length;
    var sum = results.reduce(function (acc, r) {
        acc.accuracy += Number(r.accuracy) || 0;
        acc.precision += Number(r.precision) || 0;
        acc.recall += Number(r.recall) || 0;
        acc.f1 += Number.isFinite(pickEpochF1(r)) ? pickEpochF1(r) : 0;
        acc.loss += Number(r.loss) || 0;
        return acc;
    }, { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0 });
    avgFoot.innerHTML =
        '<tr>' +
        '<td><strong>Average</strong></td>' +
        '<td>' + (sum.accuracy / count).toFixed(2) + '%</td>' +
        '<td>' + (sum.precision / count).toFixed(2) + '%</td>' +
        '<td>' + (sum.recall / count).toFixed(2) + '%</td>' +
        '<td>' + (sum.f1 / count).toFixed(2) + '%</td>' +
        '<td>' + (sum.loss / count).toFixed(4) + '</td>' +
        '</tr>';

    if (!(confusionSection && confusionMeta && confusionTable && confusionEmpty)) return;
    var bestResult = results.find(function (r) { return r.epoch === bestEpoch; });
    var cm = bestResult && bestResult.confusion_matrix;
    var labels = bestResult && bestResult.confusion_labels;
    if (cm && labels && Array.isArray(cm) && Array.isArray(labels) && cm.length === labels.length) {
        var size = labels.length;
        var labelsEn = labels.map(function (l) { return confusionMatrixLabelAsStored(l); });
        confusionSection.style.display = 'block';
        confusionEmpty.style.display = 'none';
        confusionMeta.innerText = 'Best epoch: ' + bestEpoch + ' | Accuracy: ' + Number(bestAcc).toFixed(2) + '%';
        var header = '<tr><th>Actual \\ Predicted</th>' + labelsEn.map(function (l) { return '<th>' + escapeHtml(String(l)) + '</th>'; }).join('') + '</tr>';
        var body = cm.slice(0, size).map(function (row, i) {
            var cells = labelsEn.slice(0, size).map(function (_, j) {
                var v = row && row[j] != null ? row[j] : 0;
                var cls = i === j ? 'diag' : '';
                return '<td class="' + cls + '">' + escapeHtml(String(v)) + '</td>';
            }).join('');
            return '<tr><th>' + escapeHtml(String(labelsEn[i])) + '</th>' + cells + '</tr>';
        }).join('');
        confusionTable.innerHTML = header + body;
    } else {
        confusionSection.style.display = 'none';
        confusionEmpty.style.display = 'block';
        confusionTable.innerHTML = '';
    }
}

function closeEvaluationModelDetail() {
    var modal = document.getElementById('eval-model-detail-modal');
    if (modal) modal.style.display = 'none';
}

function averageMetric(rows, trainField, testField) {
    var trVals = [];
    var teVals = [];
    for (var i = 0; i < rows.length; i++) {
        var tr = normalizePercent(rows[i][trainField]);
        if (tr != null) trVals.push(tr);
        var t = rows[i].testing_result || {};
        var te = normalizePercent(t[testField]);
        if (te != null) teVals.push(te);
    }
    return {
        train: mean(trVals),
        test: mean(teVals),
    };
}

function fittingStatus(trainValue, testValue, type) {
    if (trainValue == null || testValue == null) return '—';
    var diff = Math.abs(trainValue - testValue);
    var pctLike = type === 'percent' || type === 'loss_pct';
    var mccLike = type === 'mcc';
    var stdLike = type === 'float2';
    var rawText = pctLike ? diff.toFixed(4) + '%' : diff.toFixed(6);
    var txt = pctLike ? (Math.round(diff * 10) / 10).toFixed(1) + '%' : diff.toFixed(4);
    // Metrik persen: gap < 2% dianggap seimbang (sama seperti sebelum perbaikan format).
    if (pctLike && diff < 2) {
        return '<span class="fit good">Balanced <small>(raw ' + rawText + ')</small></span>';
    }
    // MCC pada skala [-1, 1]: gap kecil (mis. 0.80 vs 0.82) bukan under/overfitting.
    if (mccLike && diff < 0.05) {
        return '<span class="fit good">Balanced <small>(raw ' + rawText + ')</small></span>';
    }
    // Std dev (0–1): gap kecil dianggap seimbang — training epoch vs sklearn testing beda definisi.
    if (stdLike && diff < 0.02) {
        return '<span class="fit good">Balanced <small>(raw ' + rawText + ')</small></span>';
    }
    if (trainValue > testValue) {
        return '<span class="fit over">Overfitting ' + txt + ' <small>(raw ' + rawText + ')</small></span>';
    }
    if (testValue > trainValue) {
        return '<span class="fit under">Underfitting ' + txt + ' <small>(raw ' + rawText + ')</small></span>';
    }
    return '<span class="fit good">Balanced <small>(raw ' + rawText + ')</small></span>';
}

function renderSummaryTable(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    var thead = document.getElementById('fitting-summary-thead');
    var tbody = document.getElementById('fitting-summary-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '<tr><th>Metrics</th><th>Training</th><th>Testing</th><th>Difference</th></tr>';
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No data available for fitting summary.</td></tr>';
        renderFittingBestInfo(algoKey, null);
        return;
    }

    var referenceModel = getBestTrainingModel(rows);
    renderFittingBestInfo(algoKey, referenceModel);

    var rowsSummary = TABLE_METRIC_DEFS.map(function (d) {
        var resolved = resolveSummaryComparisonValues(referenceModel, d);
        return {
            label: d.label,
            train: resolved.train,
            test: resolved.test,
            type: resolved.type,
            diff:
                resolved.train != null && resolved.test != null
                    ? fittingStatus(resolved.train, resolved.test, resolved.type)
                    : '—',
        };
    });

    var modelReferenceRow = '';
    if (referenceModel) {
        var modelName = referenceModel.nama_model || '-';
        var hasTesting = referenceModel.testing_result && referenceModel.testing_result.accuracy != null;
        modelReferenceRow =
            '<tr class="row-model-reference">' +
            '<td><strong>Model Used</strong></td>' +
            '<td colspan="2"><strong>' + escapeHtml(modelName) + '</strong></td>' +
            '<td><span class="fit good">Best training model' +
            (hasTesting ? ' (tested)' : ' (not tested yet)') +
            '</span></td>' +
            '</tr>';
    }

    tbody.innerHTML = modelReferenceRow + rowsSummary
        .map(function (r, idx) {
            var klass = '';
            return (
                '<tr' + klass + '>' +
                '<td>' + escapeHtml(r.label) + '</td>' +
                '<td>' + (r.train == null ? '—' : formatByType(r.train, r.type)) + '</td>' +
                '<td>' + (r.test == null ? '—' : formatByType(r.test, r.type)) + '</td>' +
                '<td>' + r.diff + '</td>' +
                '</tr>'
            );
        })
        .join('');
}

function getLeastOverfittingModel(rows) {
    var best = null;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var trainAcc = normalizePercent(row.accuracy);
        var testAcc = normalizePercent((row.testing_result || {}).accuracy);
        if (trainAcc == null || testAcc == null) continue;
        var gap = Math.abs(trainAcc - testAcc);
        if (!best || gap < best.gap || (gap === best.gap && testAcc > best.testAcc)) {
            best = { row: row, gap: gap, testAcc: testAcc };
        }
    }
    return best ? best.row : null;
}

function getAlgoReferenceModelForComparison(algoKey, rows) {
    var items = rows || [];
    // Special rule requested: only mBERT uses least-overfitting reference.
    if (algoKey === 'mbert') {
        return getLeastOverfittingModel(items) || getBestTrainingModel(items);
    }
    return getBestTrainingModel(items);
}

function getBestTestingModel(rows) {
    var best = null;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var t = row.testing_result || {};
        var acc = normalizePercent(t.accuracy);
        var f1 = normalizePercent(t.f1_macro);
        if (acc == null) continue;
        var f1Score = f1 == null ? -Infinity : f1;
        if (!best || acc > best.acc || (acc === best.acc && f1Score > best.f1)) {
            best = { row: row, acc: acc, f1: f1Score };
        }
    }
    return best ? best.row : null;
}

function getAlgoComparisonValue(algoKey, metricDef) {
    var rows = state.byAlgo[algoKey] || [];
    var bestTraining = getAlgoReferenceModelForComparison(algoKey, rows);
    var bestTesting = getBestTestingModel(rows);
    var tTrain = bestTraining ? bestTraining.testing_result || {} : {};
    var tTest = bestTesting ? bestTesting.testing_result || {} : {};

    var value = null;
    if (metricDef.key === 'std_dev' && bestTraining) {
        value = normalizeMetricValue(testStdDevFromSupabase(bestTraining), 'float2');
        if (value == null) {
            value = normalizeMetricValue(trainStdDevFromSupabase(bestTraining), 'float2');
        }
    }
    if (value == null && metricDef.testField) {
        value = normalizeMetricValue(tTrain[metricDef.testField], metricDef.type);
    }
    if (value == null && metricDef.key === 'macro_avg') {
        var p = normalizePercent(tTrain.precision_macro);
        var r = normalizePercent(tTrain.recall_macro);
        var f = normalizePercent(tTrain.f1_macro);
        if (p != null && r != null && f != null) value = (p + r + f) / 3;
    }
    if (value == null && metricDef.key === 'loss' && bestTraining) {
        value = normalizeMetricValue(bestTraining.train_loss, metricDef.type);
    }
    if (value == null && metricDef.testField) {
        value = normalizeMetricValue(tTest[metricDef.testField], metricDef.type);
    }
    if (value == null && metricDef.key === 'macro_avg') {
        var p2 = normalizePercent(tTest.precision_macro);
        var r2 = normalizePercent(tTest.recall_macro);
        var f2 = normalizePercent(tTest.f1_macro);
        if (p2 != null && r2 != null && f2 != null) value = (p2 + r2 + f2) / 3;
    }
    if (value == null && bestTraining) {
        value = normalizeMetricValue(resolveTrainingMetricRaw(bestTraining, metricDef), metricDef.type);
    }
    return value;
}

function testingMetricFromBestModel(algoKey, testField, asPercent) {
    var best = getBestTrainingModel(state.byAlgo[algoKey] || []);
    if (!best) return null;
    var t = best.testing_result || {};
    if (testField === 'mcc') return normalizeMcc(t[testField]);
    if (!asPercent) {
        var n = Number(t[testField]);
        return Number.isFinite(n) ? n : null;
    }
    return normalizePercent(t[testField]);
}

function metricValueFromReferenceModel(algoKey, metricKey, testField, asPercent) {
    var refModel = getBestTrainingModel(state.byAlgo[algoKey] || []);
    if (!refModel) return null;
    var t = refModel.testing_result || {};

    var value = null;
    if (testField) {
        if (testField === 'mcc') {
            value = normalizeMcc(t[testField]);
        } else if (asPercent) {
            value = normalizePercent(t[testField]);
        } else {
            value = normalizeMetricValue(t[testField], 'float2');
        }
    }

    if (value == null && metricKey === 'macro_avg') {
        var p = normalizePercent(t.precision_macro);
        var r = normalizePercent(t.recall_macro);
        var f = normalizePercent(t.f1_macro);
        if (p != null && r != null && f != null) {
            value = (p + r + f) / 3;
        }
    }

    if (value == null && metricKey === 'loss') {
        value = normalizeMetricValue(refModel.train_loss, 'float4');
    }

    return value;
}

function normalizeMetricValue(raw, type) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (type === 'percent') return normalizePercent(raw);
    if (type === 'mcc') return normalizeMcc(raw);
    if (type === 'loss_pct') return normalizeLossPercent(raw);
    if (type === 'float2' || type === 'float4') return parseStoredNumber(raw);
    var n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/** Nilai untuk tabel Training vs Testing — selaras perilaku sebelum tabel testing dihapus. */
function resolveSummaryComparisonValues(referenceModel, metricDef) {
    var t = referenceModel ? referenceModel.testing_result || {} : {};
    var trainValue = null;
    var testValue = metricDef.testField
        ? normalizeMetricValue(t[metricDef.testField], metricDef.type)
        : null;

    if (metricDef.key === 'macro_avg') {
        if (testValue == null) {
            var p = normalizePercent(t.precision_macro);
            var r = normalizePercent(t.recall_macro);
            var f = normalizePercent(t.f1_macro);
            if (p != null && r != null && f != null) testValue = (p + r + f) / 3;
        }
        trainValue = normalizeMetricValue(resolveTrainingMetricRaw(referenceModel, metricDef), 'percent');
    } else if (metricDef.key === 'std_dev') {
        testValue = referenceModel
            ? normalizeMetricValue(testStdDevFromSupabase(referenceModel), 'float2')
            : null;
        trainValue = referenceModel
            ? normalizeMetricValue(trainStdDevFromSupabase(referenceModel), 'float2')
            : null;
    } else if (metricDef.key === 'weighted_avg' || metricDef.key === 'roc_auc') {
        // Dulu hanya ada di metrik testing → bandingkan nilai testing di kedua kolom.
        testValue = metricDef.testField
            ? normalizeMetricValue(t[metricDef.testField], 'percent')
            : null;
        trainValue = testValue;
    } else if (metricDef.key === 'loss') {
        trainValue = referenceModel
            ? normalizeMetricValue(referenceModel.train_loss, 'loss_pct')
            : null;
        testValue = trainValue;
    } else if (metricDef.trainField) {
        trainValue = referenceModel
            ? normalizeMetricValue(resolveTrainingMetricRaw(referenceModel, metricDef), metricDef.type)
            : null;
    }

    // Jangan salin testing → training (MCC / std dev harus dari Supabase masing-masing).
    if (
        metricDef.type !== 'mcc' &&
        metricDef.key !== 'mcc' &&
        metricDef.key !== 'std_dev'
    ) {
        if (trainValue == null && testValue != null) trainValue = testValue;
        if (testValue == null && trainValue != null) testValue = trainValue;
    }

    var diffType =
        metricDef.key === 'loss'
            ? 'loss_pct'
            : metricDef.key === 'std_dev'
              ? 'float2'
              : metricDef.type;

    return { train: trainValue, test: testValue, type: diffType };
}

function getBestTrainingModel(rows) {
    var best = null;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var acc = normalizePercent(row.accuracy);
        var f1 = normalizePercent(row.f1_score);
        if (acc == null) continue;
        var f1Score = f1 == null ? -Infinity : f1;
        if (!best || acc > best.acc || (acc === best.acc && f1Score > best.f1)) {
            best = { row: row, acc: acc, f1: f1Score };
        }
    }
    return best ? best.row : null;
}

function renderTrainingBestInfo(algoKey, bestTraining) {
    var trainEl = document.getElementById('training-best-info');
    var algoLabel = escapeHtml(ALGO_LABELS[algoKey] || algoKey || '-');
    if (!trainEl) return;
    trainEl.innerHTML = bestTraining
        ? 'Best training model (' +
          algoLabel +
          '): <strong>' +
          escapeHtml(bestTraining.nama_model || '-') +
          '</strong> (Accuracy ' +
          formatPercent(bestTraining.accuracy) +
          ', F1 ' +
          formatPercent(bestTraining.f1_score) +
          '). This model is used for testing and comparison below.'
        : 'Best training model (' + algoLabel + '): no data available.';
}

function renderFittingBestInfo(algoKey, bestModel) {
    var el = document.getElementById('fitting-best-info');
    var algoLabel = escapeHtml(ALGO_LABELS[algoKey] || algoKey || '-');
    if (!el) return;
    if (!bestModel) {
        el.innerHTML = 'Training vs testing comparison (' + algoLabel + '): no model available.';
        return;
    }
    var t = bestModel.testing_result || {};
    var tested = t.accuracy != null;
    el.innerHTML = tested
        ? 'Comparing training vs testing for best model (' +
          algoLabel +
          '): <strong>' +
          escapeHtml(bestModel.nama_model || '-') +
          '</strong> (test Accuracy ' +
          formatPercent(t.accuracy) +
          ', test F1 ' +
          formatPercent(t.f1_macro) +
          ').'
        : 'Best model <strong>' +
          escapeHtml(bestModel.nama_model || '-') +
          '</strong> (' +
          algoLabel +
          ') has not been tested yet. Run Testing on this model to fill the testing column.';
}

function renderAlgoComparisonTable() {
    var thead = document.getElementById('algo-compare-thead');
    var tbody = document.getElementById('algo-compare-tbody');
    if (!thead || !tbody) return;

    var tf = TRANSFORMER_KEYS.filter(function (k) {
        return state.orderedAlgos.indexOf(k) >= 0;
    });
    var cl = CLASSIC_KEYS.filter(function (k) {
        return state.orderedAlgos.indexOf(k) >= 0;
    });
    var cols = tf.concat(cl);
    if (!cols.length) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td class="empty-row">No algorithm data available.</td></tr>';
        return;
    }

    thead.innerHTML =
        '<tr><th>Metrics</th><th colspan="' +
        tf.length +
        '">Transformer</th><th colspan="' +
        cl.length +
        '">Classic</th></tr>' +
        '<tr><th></th>' +
        cols
            .map(function (k) {
                return '<th>' + escapeHtml(ALGO_LABELS[k] || k) + '</th>';
            })
            .join('') +
        '</tr>' +
        '<tr><th>Model Used</th>' +
        cols
            .map(function (k) {
                var bestTraining = getAlgoReferenceModelForComparison(k, state.byAlgo[k] || []);
                var modelName = bestTraining ? bestTraining.nama_model || '-' : '-';
                return '<th class="model-ref-cell">' + escapeHtml(modelName) + '</th>';
            })
            .join('') +
        '</tr>';

    var rows = TABLE_METRIC_DEFS.map(function (d) {
        return {
            key: d.key,
            label: d.label,
            testField: d.testField,
            trainField: d.trainField,
            type: d.type,
        };
    });

    tbody.innerHTML = rows
        .map(function (r) {
            var highlightMetrics = ['accuracy', 'f1', 'mcc'];
            var values = cols.map(function (k) {
                return getAlgoComparisonValue(k, r);
            });
            var maxVal = -Infinity;
            if (highlightMetrics.indexOf(r.key) >= 0) {
                for (var i = 0; i < values.length; i++) {
                    if (values[i] != null && values[i] > maxVal) maxVal = values[i];
                }
            }

            return (
                '<tr><td>' +
                r.label +
                '</td>' +
                values
                    .map(function (value) {
                        var klass = (value != null && value === maxVal && highlightMetrics.indexOf(r.key) >= 0) ? ' class="highlight-best"' : '';
                        return '<td' + klass + '>' + (value == null ? '—' : formatByType(value, r.type)) + '</td>';
                    })
                    .join('') +
                '</tr>'
            );
        })
        .join('');
}

function makeChart(canvasId, labels, datasets, asPercent) {
    var el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    if (!labels.length) labels = ['No Data'];
    if (!Array.isArray(datasets) || !datasets.length) {
        datasets = [
            {
                label: 'No Data',
                data: [0],
                backgroundColor: 'rgba(140,140,140,0.5)',
                borderRadius: 5,
                barPercentage: 0.62,
                categoryPercentage: 0.7,
            },
        ];
    }
    var valueLabelPlugin = {
        id: 'valueLabelPlugin_' + canvasId,
        afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            ctx.save();
            ctx.font = '600 12px Inter, sans-serif';
            ctx.fillStyle = '#2c1f0e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            for (var d = 0; d < chart.data.datasets.length; d++) {
                var meta = chart.getDatasetMeta(d);
                var ds = chart.data.datasets[d];
                if (!meta || !meta.data || !ds) continue;
                for (var i = 0; i < meta.data.length; i++) {
                    var raw = Array.isArray(ds.data) ? Number(ds.data[i]) : NaN;
                    if (!Number.isFinite(raw) || raw <= 0) continue;
                    var p = meta.data[i].tooltipPosition();
                    var txt = asPercent
                        ? (Math.round(raw * 10) / 10).toFixed(1) + '%'
                        : raw.toFixed(4);
                    ctx.fillText(txt, p.x, p.y - 4);
                }
            }
            ctx.restore();
        },
    };
    var c = new Chart(el, {
        type: 'bar',
        plugins: [valueLabelPlugin],
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    labels: {
                        font: { size: 13, weight: '600' },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: 13, weight: '600' },
                    },
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: asPercent ? 100 : undefined,
                    ticks: {
                        font: { size: 12, weight: '600' },
                        callback: function (v) {
                            return asPercent ? v + '%' : v;
                        },
                    },
                },
            },
        },
    });
    state.charts.push(c);
}

function renderCharts(metricKey) {
    if (typeof window.Chart === 'undefined') return;
    destroyCharts();
    var def = CHART_METRIC_DEFS.find(function (d) {
        return d.key === metricKey;
    });
    if (!def) return;
    var asPercent = def.asPercent !== false;

    var tf = TRANSFORMER_KEYS.filter(function (k) {
        return state.orderedAlgos.indexOf(k) >= 0;
    });
    var cl = CLASSIC_KEYS.filter(function (k) {
        return state.orderedAlgos.indexOf(k) >= 0;
    });
    var all = tf.concat(cl);

    var tfLabels = tf.map(function (k) {
        return ALGO_LABELS[k] || k;
    });
    var clLabels = cl.map(function (k) {
        return ALGO_LABELS[k] || k;
    });
    var allLabels = all.map(function (k) {
        return ALGO_LABELS[k] || k;
    });
    var isDualMetric = def.key === 'accuracy_vs_f1';

    if (isDualMetric) {
        makeChart(
            'chartTransformer',
            tfLabels,
            [
                {
                    label: 'Accuracy',
                    data: tf.map(function (k) { return getAlgoComparisonValue(k, { key: 'accuracy', testField: 'accuracy', trainField: 'accuracy', type: 'percent' }); }),
                    backgroundColor: CHART_COLORS.transformerDark,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: tf.map(function (k) { return getAlgoComparisonValue(k, { key: 'f1', testField: 'f1_macro', trainField: 'f1_score', type: 'percent' }); }),
                    backgroundColor: CHART_COLORS.transformerDarkSoft,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
            ],
            true,
        );
        makeChart(
            'chartClassic',
            clLabels,
            [
                {
                    label: 'Accuracy',
                    data: cl.map(function (k) { return getAlgoComparisonValue(k, { key: 'accuracy', testField: 'accuracy', trainField: 'accuracy', type: 'percent' }); }),
                    backgroundColor: CHART_COLORS.classicLight,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: cl.map(function (k) { return getAlgoComparisonValue(k, { key: 'f1', testField: 'f1_macro', trainField: 'f1_score', type: 'percent' }); }),
                    backgroundColor: CHART_COLORS.classicLightSoft,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
            ],
            true,
        );
        makeChart(
            'chartCombined',
            allLabels,
            [
                {
                    label: 'Accuracy',
                    data: all.map(function (k) { return getAlgoComparisonValue(k, { key: 'accuracy', testField: 'accuracy', trainField: 'accuracy', type: 'percent' }); }),
                    backgroundColor: all.map(function (k) {
                        return TRANSFORMER_KEYS.indexOf(k) >= 0 ? CHART_COLORS.transformerDark : CHART_COLORS.classicLight;
                    }),
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: all.map(function (k) { return getAlgoComparisonValue(k, { key: 'f1', testField: 'f1_macro', trainField: 'f1_score', type: 'percent' }); }),
                    backgroundColor: all.map(function (k) {
                        return TRANSFORMER_KEYS.indexOf(k) >= 0 ? CHART_COLORS.transformerDarkSoft : CHART_COLORS.classicLightSoft;
                    }),
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
            ],
            true,
        );
        return;
    }

    makeChart('chartTransformer', tfLabels, [{
        label: def.label,
        data: tf.map(function (k) {
            var metricDef = TABLE_METRIC_DEFS.find(function (d) { return d.key === def.key; }) || { key: def.key, testField: def.testField, trainField: null, type: asPercent ? 'percent' : 'float2' };
            return getAlgoComparisonValue(k, metricDef);
        }),
        backgroundColor: CHART_COLORS.transformerDark,
        borderRadius: 5,
        barPercentage: 0.62,
        categoryPercentage: 0.7,
    }], asPercent);

    makeChart('chartClassic', clLabels, [{
        label: def.label,
        data: cl.map(function (k) {
            var metricDef = TABLE_METRIC_DEFS.find(function (d) { return d.key === def.key; }) || { key: def.key, testField: def.testField, trainField: null, type: asPercent ? 'percent' : 'float2' };
            return getAlgoComparisonValue(k, metricDef);
        }),
        backgroundColor: CHART_COLORS.classicLight,
        borderRadius: 5,
        barPercentage: 0.62,
        categoryPercentage: 0.7,
    }], asPercent);

    makeChart('chartCombined', allLabels, [{
        label: def.label,
        data: all.map(function (k) {
            var metricDef = TABLE_METRIC_DEFS.find(function (d) { return d.key === def.key; }) || { key: def.key, testField: def.testField, trainField: null, type: asPercent ? 'percent' : 'float2' };
            return getAlgoComparisonValue(k, metricDef);
        }),
        backgroundColor: all.map(function (k) {
            return TRANSFORMER_KEYS.indexOf(k) >= 0 ? CHART_COLORS.transformerDark : CHART_COLORS.classicLight;
        }),
        borderRadius: 5,
        barPercentage: 0.62,
        categoryPercentage: 0.7,
    }], asPercent);
}

function renderChartMetricButtons() {
    var wrap = document.getElementById('chart-metric-buttons');
    if (!wrap) return;
    wrap.innerHTML = CHART_METRIC_DEFS.map(function (d) {
        var active = d.key === state.selectedChartMetric ? ' active' : '';
        return '<button type="button" class="metric-btn' + active + '" data-metric="' + d.key + '">' + d.label + '</button>';
    }).join('');
}

function renderTableAlgoButtons() {
    var wrap = document.getElementById('table-algo-buttons');
    if (!wrap) return;
    wrap.innerHTML = state.orderedAlgos
        .map(function (k) {
            var active = k === state.selectedTableAlgo ? ' active' : '';
            return (
                '<button type="button" class="algo-btn' +
                active +
                '" data-algo="' +
                escapeHtml(k) +
                '">' +
                escapeHtml(ALGO_LABELS[k] || k.toUpperCase()) +
                '</button>'
            );
        })
        .join('');
}

function pickBestModel(items) {
    return getBestTrainingModel(items || []);
}

function bestAlgorithmInFamily(keys, testField) {
    var best = null;
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (state.orderedAlgos.indexOf(k) < 0) continue;
        var val = testingMetricFromBestModel(k, testField, true);
        if (val == null) continue;
        if (!best || val > best.avg) best = { key: k, avg: val };
    }
    return best;
}

function overallTestingScoreByAlgo(algoKey) {
    var metrics = [
        testingMetricFromBestModel(algoKey, 'accuracy', true),
        testingMetricFromBestModel(algoKey, 'precision_macro', true),
        testingMetricFromBestModel(algoKey, 'recall_macro', true),
        testingMetricFromBestModel(algoKey, 'f1_macro', true),
        testingMetricFromBestModel(algoKey, 'weighted_avg', true),
        testingMetricFromBestModel(algoKey, 'mcc', true),
        testingMetricFromBestModel(algoKey, 'roc_auc', true),
    ].filter(function (v) {
        return v != null;
    });
    return mean(metrics);
}

function bestAlgorithmOverallInFamily(keys) {
    var best = null;
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (state.orderedAlgos.indexOf(k) < 0) continue;
        var score = overallTestingScoreByAlgo(k);
        if (score == null) continue;
        if (!best || score > best.score) best = { key: k, score: score };
    }
    return best;
}

function renderEvaluationConclusion(items) {
    var el = document.getElementById('eval-conclusion-content');
    if (!el) return;
    try {

    var bestModel = pickBestModel(items || []);
    var bestTf = bestAlgorithmOverallInFamily(TRANSFORMER_KEYS);
    var bestCl = bestAlgorithmOverallInFamily(CLASSIC_KEYS);
    if (!bestModel && !bestTf && !bestCl) {
        el.innerHTML =
            '<div class="conclusion-stack conclusion-stack--empty">' +
            '<p class="conclusion-muted">No final-training model data is available to build a conclusion yet.</p>' +
            '</div>';
        return;
    }

    var transformerConclusion = bestTf
        ? '<p class="conclusion-prose"><strong>Best Transformer:</strong> ' +
          escapeHtml(ALGO_LABELS[bestTf.key] || bestTf.key) +
          ' with an overall testing-metrics score of <strong>' +
          formatPercentOrDash(bestTf.score) +
          '</strong>.</p>'
        : '<p class="conclusion-prose">Transformer data is not sufficient for comparison yet.</p>';
    var classicConclusion = bestCl
        ? '<p class="conclusion-prose"><strong>Best Classic:</strong> ' +
          escapeHtml(ALGO_LABELS[bestCl.key] || bestCl.key) +
          ' with an overall testing-metrics score of <strong>' +
          formatPercentOrDash(bestCl.score) +
          '</strong>.</p>'
        : '<p class="conclusion-prose">Classic-model data is not sufficient for comparison yet.</p>';

    var compareText = 'Direct comparison is not available yet because one group has insufficient data.';
    if (bestTf && bestCl) {
        var gap = Math.abs(bestTf.score - bestCl.score);
        if (bestTf.score > bestCl.score) {
            compareText =
                escapeHtml(ALGO_LABELS[bestTf.key]) +
                ' (Transformer) outperforms ' +
                escapeHtml(ALGO_LABELS[bestCl.key]) +
                ' (Classic) based on the combined testing metrics, with a score gap of ' +
                (Math.round(gap * 10) / 10).toFixed(1) +
                '%.';
        } else if (bestCl.score > bestTf.score) {
            compareText =
                escapeHtml(ALGO_LABELS[bestCl.key]) +
                ' (Classic) outperforms ' +
                escapeHtml(ALGO_LABELS[bestTf.key]) +
                ' (Transformer) based on the combined testing metrics, with a score gap of ' +
                (Math.round(gap * 10) / 10).toFixed(1) +
                '%.';
        } else {
            compareText = 'The top Transformer and Classic performances are balanced based on the combined testing metrics.';
        }
    }

    var bestModelBlock = '';
    if (bestModel) {
        var trainAcc = normalizePercent(bestModel.accuracy);
        var testAcc = normalizePercent((bestModel.testing_result || {}).accuracy);
        var fStatus = "Normal";
        if (trainAcc != null && testAcc != null) {
            var diff = Math.abs(trainAcc - testAcc);
            if (diff >= 2) {
                if (trainAcc > testAcc) fStatus = "Overfitting";
                else fStatus = "Underfitting";
            }
        }
        var statusColor = fStatus === "Normal" ? "var(--success)" : (fStatus === "Overfitting" ? "#b33a2f" : "#1e6da5");

        bestModelBlock =
            '<div style="margin-top: 16px; padding: 16px; background: rgba(200, 169, 110, 0.1); border-left: 4px solid rgba(200, 169, 110, 0.9); border-radius: 8px;">' +
            '<p class="conclusion-prose" style="margin: 0; font-size: 14.5px;">' +
            '<strong>Interpretation:</strong> ' + escapeHtml(ALGO_LABELS[bestModel.canonical_algorithm] || bestModel.algoritma || '-') + ' (' + escapeHtml(bestModel.nama_model || '-') + ') ' +
            'achieved the best performance with the highest F1-score (<strong>' + escapeHtml(formatPercent(bestModel.f1_score)) + '</strong>) ' +
            'and Accuracy (<strong>' + escapeHtml(formatPercent(bestModel.accuracy)) + '</strong>).<br>' +
            '<span style="display:inline-block; margin-top:8px;">Model fitting status: <strong style="color: ' + statusColor + ';">' + fStatus + '</strong>.</span></p></div>';
    }

    el.innerHTML =
        '<div class="conclusion-stack">' +
        '<ol class="conclusion-points conclusion-points-numbered">' +
        '<li>' + transformerConclusion + '</li>' +
        '<li>' + classicConclusion + '</li>' +
        '<li><p class="conclusion-prose"><strong>Transformer vs Classic Comparison:</strong> ' + compareText + '</p></li>' +
        '</ol>' +
        (bestModel ? bestModelBlock : '') +
        '</div>';
    } catch (err) {
        el.innerHTML =
            '<div class="conclusion-stack conclusion-stack--empty">' +
            '<p class="conclusion-muted">Conclusion could not be displayed: ' +
            escapeHtml(err && err.message ? err.message : 'unknown error') +
            '</p>' +
            '</div>';
    }
}

function findChartForCanvasId(canvasId) {
    for (var i = 0; i < state.charts.length; i++) {
        var ch = state.charts[i];
        if (ch && ch.canvas && ch.canvas.id === canvasId) return ch;
    }
    return null;
}

function exportChartDataUrlHiRes(chart, targetW, targetH) {
    return new Promise(function (resolve) {
        if (!chart || !chart.canvas) {
            resolve('');
            return;
        }
        var prevW = chart.width;
        var prevH = chart.height;
        if (!prevW || !prevH) {
            prevW = chart.canvas.clientWidth || 640;
            prevH = chart.canvas.clientHeight || 360;
        }
        var tw = Math.max(480, Math.floor(targetW));
        var th = Math.max(280, Math.floor(targetH));
        try {
            chart.resize(tw, th);
            chart.update('none');
        } catch (e) {
            resolve('');
            return;
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                var url = '';
                try {
                    url = chart.canvas.toDataURL('image/png', 1.0);
                } catch (e2) {
                    url = '';
                }
                try {
                    if (prevW >= 16 && prevH >= 16) {
                        chart.resize(prevW, prevH);
                    } else {
                        chart.resize();
                    }
                    chart.update('none');
                } catch (e3) {}
                resolve(url || '');
            });
        });
    });
}

function scaledCanvasDataUrlFromElement(canvasEl, targetW, targetH) {
    if (!canvasEl || typeof canvasEl.toDataURL !== 'function') return '';
    var tw = Math.max(480, Math.floor(targetW));
    var th = Math.max(280, Math.floor(targetH));
    var tmp = document.createElement('canvas');
    tmp.width = tw;
    tmp.height = th;
    var ctx = tmp.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tw, th);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
        ctx.drawImage(canvasEl, 0, 0, tw, th);
        return tmp.toDataURL('image/png', 1.0);
    } catch (e) {
        return '';
    }
}

async function buildEvalChartExportImages(chartLabel) {
    var specs = [
        { id: 'chartTransformer', title: 'Transformer models', expW: 1040, expH: 540, excelW: 780, excelH: 405 },
        { id: 'chartClassic', title: 'Classic models', expW: 1040, expH: 540, excelW: 780, excelH: 405 },
        { id: 'chartCombined', title: 'Transformer vs classic (combined)', expW: 1280, expH: 560, excelW: 820, excelH: 359 },
    ];
    var imgs = [];
    for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        var ch = findChartForCanvasId(spec.id);
        var dataUrl = '';
        if (ch) {
            dataUrl = await exportChartDataUrlHiRes(ch, spec.expW, spec.expH);
        }
        if (!dataUrl || dataUrl.length < 64) {
            var el = document.getElementById(spec.id);
            dataUrl = scaledCanvasDataUrlFromElement(el, spec.expW, spec.expH);
        }
        if (dataUrl && dataUrl.length > 64) {
            imgs.push({
                title: spec.title + ' — ' + chartLabel,
                base64: dataUrl,
                width: spec.excelW,
                height: spec.excelH,
            });
        }
    }
    return imgs;
}

function matrixFromElementPlainLines(el) {
    if (!el) return [['(empty)']];
    var text = String(el.innerText || '')
        .split(/\r?\n/)
        .map(function (s) {
            return s.trim();
        })
        .filter(Boolean);
    if (!text.length) return [['(empty)']];
    return text.map(function (line) {
        return [line];
    });
}

async function exportEvaluasiWorkbook() {
    if (!window.KamusExcel) {
        alert('Excel export module is not loaded.');
        return;
    }
    var btn = document.getElementById('btn-export-evaluasi-xlsx');
    var orig = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Exporting…';
    }
    try {
        await window.KamusExcel.ensureExcelJs();
        var algo = state.selectedTableAlgo;
        var algoLabel = ALGO_LABELS[algo] || algo || '-';
        var chartDef = CHART_METRIC_DEFS.find(function (d) {
            return d.key === state.selectedChartMetric;
        });
        var chartLabel = chartDef ? chartDef.label : state.selectedChartMetric;
        var ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

        var trainingTable = document.querySelector('#training-metrics-card table.data-table');
        var testingExportMatrix = buildTestingMetricsExportMatrix(algo);
        var fittingTable = document.querySelector('#fitting-summary-card table.summary-table');
        var algoTable = document.querySelector('#algo-compare-card table.comp-table');
        var conclusionEl = document.getElementById('eval-conclusion-content');

        var sheets = [
            {
                name: 'Metadata',
                layout: 'metadata',
                matrix: [
                    ['Exported (local time)', new Date().toLocaleString()],
                    ['Table algorithm', algoLabel],
                    ['Chart metric (images)', chartLabel],
                ],
            },
            {
                name: 'Training metrics',
                title: 'Training metrics — ' + algoLabel,
                table: trainingTable,
                tableOpts: { skipEmptyRows: true, uppercaseHeader: true },
            },
        ];

        if (testingExportMatrix && testingExportMatrix.length) {
            sheets.push({
                name: 'Testing metrics',
                title: 'Testing metrics — ' + algoLabel,
                matrix: testingExportMatrix,
                tableOpts: { uppercaseHeaderRows: 1 },
            });
        }

        sheets.push(
            {
                name: 'Train vs test',
                title: 'Best metrics comparison (selected model)',
                table: fittingTable,
                tableOpts: { skipEmptyRows: true, uppercaseHeader: true },
            },
            {
                name: 'Algo comparison',
                title: 'Algorithm comparison (all algos)',
                table: algoTable,
                tableOpts: { skipEmptyRows: true, uppercaseHeaderRows: 3 },
            },
            {
                name: 'Conclusion',
                layout: 'conclusion',
                title: 'Evaluation conclusion',
                matrix: matrixFromElementPlainLines(conclusionEl),
            },
        );

        var imgs = await buildEvalChartExportImages(chartLabel);
        if (imgs.length) {
            sheets.push({
                name: 'Charts',
                title: 'Comparison charts (high-resolution images)',
                images: imgs,
            });
        }

        await window.KamusExcel.exportWorkbook('evaluasi_' + algo + '_' + ts, sheets);
    } catch (err) {
        alert(err && err.message ? err.message : String(err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = orig || 'Export Excel';
        }
    }
}

function bindEvents() {
    var algoWrap = document.getElementById('table-algo-buttons');
    if (algoWrap) {
        algoWrap.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.classList || !t.classList.contains('algo-btn')) return;
            state.selectedTableAlgo = t.getAttribute('data-algo') || state.selectedTableAlgo;
            try {
                localStorage.setItem('selectedAlgorithm', state.selectedTableAlgo);
            } catch (err) {}
            renderTableAlgoButtons();
            renderTrainingTable(state.selectedTableAlgo);
            renderSummaryTable(state.selectedTableAlgo);
        });
    }
    var trainingTbody = document.getElementById('training-metrics-tbody');
    if (trainingTbody) {
        trainingTbody.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.classList || !t.classList.contains('model-link-btn')) return;
            var modelId = Number(t.getAttribute('data-model-id'));
            if (!Number.isFinite(modelId)) return;
            var models = state.byAlgo[state.selectedTableAlgo] || [];
            var model = models.find(function (m) { return Number(m.id) === modelId; });
            if (model) void openEvaluationModelDetail(model);
        });
    }
    var closeBtn = document.getElementById('eval-model-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', closeEvaluationModelDetail);
    var closeX = document.getElementById('eval-model-detail-close-x');
    if (closeX) closeX.addEventListener('click', closeEvaluationModelDetail);
    var modal = document.getElementById('eval-model-detail-modal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeEvaluationModelDetail();
        });
    }
    var btnWrap = document.getElementById('chart-metric-buttons');
    if (btnWrap) {
        btnWrap.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.classList || !t.classList.contains('metric-btn')) return;
            state.selectedChartMetric = t.getAttribute('data-metric') || state.selectedChartMetric;
            renderChartMetricButtons();
            renderCharts(state.selectedChartMetric);
        });
    }
    var exportEvalBtn = document.getElementById('btn-export-evaluasi-xlsx');
    if (exportEvalBtn) {
        exportEvalBtn.addEventListener('click', function () {
            void exportEvaluasiWorkbook();
        });
    }
}

function showError(message) {
    var wrap = document.querySelector('.eval-wrapper');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'section-card';
    el.innerHTML = '<div class="section-card-body"><p class="empty-row">' + escapeHtml(message) + '</p></div>';
    wrap.prepend(el);
}

function showChartHint(message) {
    var card = document.getElementById('testing-chart-card');
    if (!card) return;
    var body = card.querySelector('.section-card-body');
    if (!body) return;
    var p = document.createElement('p');
    p.className = 'empty-row';
    p.textContent = message;
    body.prepend(p);
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        if (typeof window.kamusInitXlmGeneration === 'function') {
            await window.kamusInitXlmGeneration();
        }
        var chartReady = await ensureChartJsLoaded();
        if (!chartReady) {
            showChartHint('Chart.js failed to load. Please check internet/CDN access.');
        }
        var items = await fetchEvaluationItems();
        await prefetchTrainingLogsForModels(items);
        await prefetchEpochMetricsForModels(items);
        state.byAlgo = groupByAlgorithm(items);
        state.orderedAlgos = orderedAlgorithmKeys(state.byAlgo);
        state.allItems = items;

        if (!state.orderedAlgos.length) {
            showError('Evaluation data is not available yet.');
            return;
        }

        var preferredAlgo = readPreferredAlgorithm();
        state.selectedTableAlgo =
            preferredAlgo && state.orderedAlgos.indexOf(preferredAlgo) >= 0
                ? preferredAlgo
                : state.orderedAlgos[0];

        renderTableAlgoButtons();
        renderChartMetricButtons();

        try {
            renderTrainingTable(state.selectedTableAlgo);
            renderSummaryTable(state.selectedTableAlgo);
            renderAlgoComparisonTable();
        } catch (tableErr) {
            showError('Failed to render table section: ' + (tableErr && tableErr.message ? tableErr.message : 'unknown error'));
        }

        try {
            renderCharts(state.selectedChartMetric);
        } catch (chartErr) {
            showChartHint('Chart failed to render: ' + (chartErr && chartErr.message ? chartErr.message : 'unknown error'));
        }

        renderEvaluationConclusion(items);
        bindEvents();
    } catch (err) {
        showError(err && err.message ? err.message : 'Failed to load evaluation.');
    }
});
