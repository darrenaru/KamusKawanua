var API_BASE = 'http://127.0.0.1:8000';

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

function normalizeAlgo(value) {
    var v = String(value || '').toLowerCase().trim().replace(/_/g, '-');
    if (v === 'indo-bert') return 'indobert';
    if (v === 'm-bert') return 'mbert';
    return v;
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

async function initEvaluationCharts() {
    if (typeof window.Chart === 'undefined') {
        showChartLoadError('Chart.js is not loaded.');
        return;
    }

    var metricNames = ['Accuracy', 'Precision', 'Recall', 'F1-Score'];
    var colors = [
        'rgba(44, 31, 14, 0.85)',
        'rgba(70, 52, 30, 0.85)',
        'rgba(100, 70, 40, 0.80)',
        'rgba(130, 90, 50, 0.75)'
    ];
    var borders = ['#2c1f0e', '#46341e', '#644628', '#825a32'];

    var items = await fetchBestModels();
    var byAlgo = {};
    for (var i = 0; i < items.length; i++) {
        var row = items[i];
        byAlgo[normalizeAlgo(row.algoritma)] = row;
    }

    var transformerOrder = ['xlmr', 'indobert', 'mbert'];
    var transformerLabels = ['XLM-R', 'IndoBERT', 'mBERT'];
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
    var loaded = await ensureChartJsLoaded();
    if (!loaded) {
        showChartLoadError('Failed to load Chart.js.');
        return;
    }
    try {
        await initEvaluationCharts();
    } catch (e) {
        showChartLoadError(e && e.message ? e.message : 'Failed to render evaluation chart.');
    }
});