var API_BASE = 'http://127.0.0.1:8000';

/** Urutan kolom tabel & grafik (samakan dengan evaluasi.html) */
var ALGO_COLS = ['xlm-r', 'mbert', 'indobert', 'word2vec', 'glove'];

function canonicalAlgoKey(raw) {
    var v = String(raw || '').toLowerCase().trim().replace(/_/g, '-');
    if (v === 'indo-bert' || v === 'indobenchmark') return 'indobert';
    if (v === 'm-bert' || v === 'multilingual-bert' || v === 'bert-base-multilingual-cased') return 'mbert';
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

function normalizeCompare(val) {
    if (val === undefined || val === null || val === '') return NaN;
    var n = Number(val);
    if (!Number.isFinite(n)) return NaN;
    if (n <= 1 && n >= 0) return n * 100;
    return n;
}

function bestIndexForRow(byAlgo, field) {
    var nums = ALGO_COLS.map(function (key) {
        var m = byAlgo[key];
        return m && m[field] !== undefined && m[field] !== null ? normalizeCompare(m[field]) : NaN;
    });
    var bi = -1;
    var bv = NaN;
    var any = false;
    for (var i = 0; i < nums.length; i++) {
        if (!isNaN(nums[i])) {
            any = true;
            if (isNaN(bv) || nums[i] > bv) {
                bv = nums[i];
                bi = i;
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

function cellPercent(byAlgo, field, hiIdx) {
    var html = '';
    for (var j = 0; j < ALGO_COLS.length; j++) {
        var key = ALGO_COLS[j];
        var m = byAlgo[key];
        var cls = j < 3 ? 'cell-tf' : 'cell-cl';
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

function cellFloat(byAlgo, field, decimals, hiIdx) {
    var html = '';
    for (var j = 0; j < ALGO_COLS.length; j++) {
        var key = ALGO_COLS[j];
        var m = byAlgo[key];
        var cls = j < 3 ? 'cell-tf' : 'cell-cl';
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

function cellPlain(byAlgo, formatter, hiIdx) {
    var html = '';
    for (var j = 0; j < ALGO_COLS.length; j++) {
        var key = ALGO_COLS[j];
        var m = byAlgo[key];
        var cls = j < 3 ? 'cell-tf' : 'cell-cl';
        var text = formatter(m);
        var hl = j === hiIdx && hiIdx >= 0;
        if (text === '\u2014' || text === '-' || text === '') {
            html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
        } else {
            html +=
                '<td class="' +
                cls +
                '"><span class="metric-value' +
                (hl ? ' hl' : '') +
                '">' +
                escapeHtml(text) +
                '</span></td>';
        }
    }
    return html;
}

function rowAllDash() {
    var html = '';
    for (var j = 0; j < ALGO_COLS.length; j++) {
        var cls = j < 3 ? 'cell-tf' : 'cell-cl';
        html += '<td class="' + cls + '">' + emDashSpan() + '</td>';
    }
    return html;
}

function formatTrainingTime(m) {
    if (!m) return '\u2014';
    var s =
        m.training_time_seconds != null
            ? m.training_time_seconds
            : m.training_duration_seconds != null
              ? m.training_duration_seconds
              : m.train_time_sec;
    if (s === undefined || s === null || s === '') return '\u2014';
    var n = Number(s);
    if (!Number.isFinite(n)) return '\u2014';
    if (n >= 60) return (Math.round((n / 60) * 10) / 10).toFixed(1) + ' menit';
    return Math.round(n) + ' detik';
}

function formatInferenceTime(m) {
    if (!m) return '\u2014';
    var ms = m.inference_time_ms != null ? m.inference_time_ms : m.inference_ms;
    if (ms === undefined || ms === null || ms === '') return '\u2014';
    var n = Number(ms);
    if (!Number.isFinite(n)) return '\u2014';
    return Math.round(n) + ' ms';
}

function formatParametersSummary(m) {
    if (!m) return '\u2014';
    if (m.vector_size != null && m.vector_size !== '') return String(m.vector_size) + ' dim';
    var bits = [];
    if (m.max_length != null && m.max_length !== '') bits.push('max_len ' + m.max_length);
    if (m.epoch != null && m.epoch !== '') bits.push('epoch ' + m.epoch);
    if (m.batch_size != null && m.batch_size !== '') bits.push('batch ' + m.batch_size);
    return bits.length ? bits.join(', ') : '\u2014';
}

function renderSplitRatioTable(byAlgo) {
    var tbody = document.getElementById('split-ratio-tbody');
    if (!tbody) return;
    var tr =
        '<tr><td class="metric-name">Split ratio (model terbaik per algoritma)</td>';
    for (var j = 0; j < ALGO_COLS.length; j++) {
        var m = byAlgo[ALGO_COLS[j]];
        var sr = m && m.split_ratio != null && m.split_ratio !== '' ? String(m.split_ratio) : '';
        tr +=
            '<td><span class="ratio-cell">' +
            (sr ? escapeHtml(sr) : '\u2014') +
            '</span></td>';
    }
    tr += '</tr>';
    tbody.innerHTML = tr;
}

function renderComparativeTable(byAlgo) {
    var tbody = document.getElementById('comparative-tbody');
    if (!tbody) return;

    var hAccuracy = bestIndexForRow(byAlgo, 'accuracy');
    var hPrec = bestIndexForRow(byAlgo, 'precision');
    var hRec = bestIndexForRow(byAlgo, 'recall');
    var hF1 = bestIndexForRow(byAlgo, 'f1_score');
    var hMacro = bestIndexForRow(byAlgo, 'macro_avg');
    var hW = bestIndexForRow(byAlgo, 'weighted_avg');
    var hMcc = bestIndexForRow(byAlgo, 'mcc');
    var hRoc = bestIndexForRow(byAlgo, 'roc_auc');

    var html = '';

    html += '<tr class="cat-row"><td colspan="6">Similarity Metrics</td></tr>';
    html +=
        '<tr><td class="metric-name">Recall</td>' +
        rowAllDash() +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Spearman Correlation</td>' +
        rowAllDash() +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Mean Cosine Similarity</td>' +
        rowAllDash() +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Pearson Correlation</td>' +
        rowAllDash() +
        '</tr>';

    html += '<tr class="cat-row"><td colspan="6">Classification Metrics</td></tr>';
    html +=
        '<tr><td class="metric-name">Accuracy</td>' +
        cellPercent(byAlgo, 'accuracy', hAccuracy) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Precision</td>' +
        cellPercent(byAlgo, 'precision', hPrec) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Recall</td>' +
        cellPercent(byAlgo, 'recall', hRec) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">F1-Score</td>' +
        cellPercent(byAlgo, 'f1_score', hF1) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Macro Average</td>' +
        cellPercent(byAlgo, 'macro_avg', hMacro) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Weighted Average</td>' +
        cellPercent(byAlgo, 'weighted_avg', hW) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">MCC</td>' +
        cellFloat(byAlgo, 'mcc', 2, hMcc) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">ROC-AUC</td>' +
        cellFloat(byAlgo, 'roc_auc', 2, hRoc) +
        '</tr>';

    html += '<tr class="cat-row"><td colspan="6">Efficiency</td></tr>';
    html +=
        '<tr><td class="metric-name">Training Time</td>' +
        cellPlain(byAlgo, formatTrainingTime, -1) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Inference Time</td>' +
        cellPlain(byAlgo, formatInferenceTime, -1) +
        '</tr>';
    html +=
        '<tr><td class="metric-name">Parameters</td>' +
        cellPlain(byAlgo, formatParametersSummary, -1) +
        '</tr>';

    tbody.innerHTML = html;
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
        'https://unpkg.com/chart.js@4.4.7/dist/chart.umd.min.js'
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

function toPercent(num) {
    return Number(num || 0) * 100;
}

function pickMetric(model, key) {
    if (!model) return 0;
    return toPercent(model[key]);
}

function buildLegend(id, cols, names) {
    var el = document.getElementById(id);
    if (!el) return;
    var h = '';
    for (var i = 0; i < names.length; i++) {
        h += '<div class="leg-item"><span class="leg-dot" style="background:' + cols[i] + '"></span>' + names[i] + '</div>';
    }
    el.innerHTML = h;
}

function buildDataset(label, data, i, colors, borders) {
    return {
        label: label,
        data: data,
        backgroundColor: colors[i],
        hoverBackgroundColor: borders[i],
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.75,
        categoryPercentage: 0.65
    };
}

function createChart(canvasId, labels, datasets) {
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function (v) { return v + '%'; }
                    }
                }
            }
        }
    });
}

async function fetchBestModels() {
    var res = await fetch(API_BASE + '/evaluasi/best-models');
    var data = await res.json();
    if (!res.ok) throw new Error(data && (data.detail || data.message) ? (data.detail || data.message) : 'Failed to fetch evaluation data.');
    return Array.isArray(data.items) ? data.items : [];
}

async function initEvaluationCharts(itemsOptional) {
    if (typeof window.Chart === 'undefined') {
        showChartLoadError('Chart.js is not loaded.');
        return;
    }

    var items = itemsOptional || (await fetchBestModels());

    var metricNames = ['Accuracy', 'Precision', 'Recall', 'F1-Score'];
    var colors = [
        'rgba(44, 31, 14, 0.85)',
        'rgba(70, 52, 30, 0.85)',
        'rgba(100, 70, 40, 0.80)',
        'rgba(130, 90, 50, 0.75)'
    ];
    var borders = ['#2c1f0e', '#46341e', '#644628', '#825a32'];

    var byAlgo = buildByAlgoMap(items);

    var transformerOrder = ['xlm-r', 'mbert', 'indobert'];
    var transformerLabels = ['XLM-R', 'mBERT', 'INDOBERT'];
    var classicOrder = ['word2vec', 'glove'];
    var classicLabels = ['Word2Vec', 'GloVe'];

    createChart('chartTransformer', transformerLabels, [
        buildDataset('Accuracy', transformerOrder.map(function (k) { return pickMetric(byAlgo[k], 'accuracy'); }), 0, colors, borders),
        buildDataset('Precision', transformerOrder.map(function (k) { return pickMetric(byAlgo[k], 'precision'); }), 1, colors, borders),
        buildDataset('Recall', transformerOrder.map(function (k) { return pickMetric(byAlgo[k], 'recall'); }), 2, colors, borders),
        buildDataset('F1-Score', transformerOrder.map(function (k) { return pickMetric(byAlgo[k], 'f1_score'); }), 3, colors, borders)
    ]);

    createChart('chartClassic', classicLabels, [
        buildDataset('Accuracy', classicOrder.map(function (k) { return pickMetric(byAlgo[k], 'accuracy'); }), 0, colors, borders),
        buildDataset('Precision', classicOrder.map(function (k) { return pickMetric(byAlgo[k], 'precision'); }), 1, colors, borders),
        buildDataset('Recall', classicOrder.map(function (k) { return pickMetric(byAlgo[k], 'recall'); }), 2, colors, borders),
        buildDataset('F1-Score', classicOrder.map(function (k) { return pickMetric(byAlgo[k], 'f1_score'); }), 3, colors, borders)
    ]);

    buildLegend('legendTransformer', colors, metricNames);
    buildLegend('legendClassic', colors, metricNames);
}

document.addEventListener('DOMContentLoaded', async function () {
    var items;
    try {
        items = await fetchBestModels();
        var byAlgo = buildByAlgoMap(items);
        renderSplitRatioTable(byAlgo);
        renderComparativeTable(byAlgo);
    } catch (e) {
        showChartLoadError(e && e.message ? e.message : 'Failed to load evaluation tables.');
    }
    var loaded = await ensureChartJsLoaded();
    if (!loaded) {
        showChartLoadError('Failed to load Chart.js.');
        return;
    }
    try {
        await initEvaluationCharts(items);
    } catch (e) {
        showChartLoadError(e && e.message ? e.message : 'Failed to render evaluation chart.');
    }
});