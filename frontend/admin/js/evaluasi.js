var API_BASE = 'http://127.0.0.1:8000';
var ALGO_ORDER = ['xlm-r', 'mbert', 'indobert', 'word2vec', 'glove'];
var ALGO_LABELS = {
    'xlm-r': 'XLM-R',
    mbert: 'mBERT',
    indobert: 'INDOBERT',
    word2vec: 'Word2Vec',
    glove: 'GloVe',
};
var TRANSFORMER_KEYS = ['xlm-r', 'mbert', 'indobert'];
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
    { key: 'mcc', label: 'MCC', testField: 'mcc', asPercent: true },
    { key: 'roc_auc', label: 'ROC-AUC', testField: 'roc_auc', asPercent: true },
];
var TABLE_METRIC_DEFS = [
    { key: 'accuracy', label: 'Accuracy', trainField: 'accuracy', testField: 'accuracy', type: 'percent' },
    { key: 'precision', label: 'Precision', trainField: 'precision', testField: 'precision_macro', type: 'percent' },
    { key: 'recall', label: 'Recall', trainField: 'recall', testField: 'recall_macro', type: 'percent' },
    { key: 'f1', label: 'F1', trainField: 'f1_score', testField: 'f1_macro', type: 'percent' },
    { key: 'macro_avg', label: 'Macro Avg', trainField: 'macro_avg', testField: null, type: 'percent' },
    { key: 'weighted_avg', label: 'Weighted Avg', trainField: null, testField: 'weighted_avg', type: 'percent' },
    { key: 'std_dev', label: 'Std Dev', trainField: null, testField: 'std_deviation', type: 'float2' },
    { key: 'loss', label: 'Loss', trainField: 'train_loss', testField: null, type: 'float4' },
    { key: 'mcc', label: 'MCC', trainField: 'train_mcc', testField: 'mcc', type: 'percent' },
    { key: 'roc_auc', label: 'ROC-AUC', trainField: null, testField: 'roc_auc', type: 'percent' },
];

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
    if (v === 'xlmr' || v === 'xlm-r') return 'xlm-r';
    if (v === 'word2vec' || v === 'word-2-vec') return 'word2vec';
    return v;
}

function escapeHtml(s) {
    var t = document.createElement('div');
    t.textContent = s == null ? '' : String(s);
    return t.innerHTML;
}

function normalizePercent(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n >= 0 && n <= 1 ? n * 100 : n;
}

function formatPercent(raw) {
    var n = normalizePercent(raw);
    if (n == null) return '—';
    return (Math.round(n * 10) / 10).toFixed(1) + '%';
}

function formatFloatOrDash(raw, decimals) {
    if (raw === undefined || raw === null || raw === '') return '—';
    var n = Number(raw);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(decimals);
}

function formatByType(raw, type) {
    if (type === 'percent') return formatPercent(raw);
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
        return canonicalAlgoKey(localStorage.getItem('selectedAlgorithm') || '');
    } catch (e) {
        return '';
    }
}

function groupByAlgorithm(items) {
    var out = {};
    for (var i = 0; i < items.length; i++) {
        var row = items[i];
        var key = row.canonical_algorithm || canonicalAlgoKey(row.algoritma);
        if (!key) continue;
        if (!out[key]) out[key] = [];
        out[key].push(row);
    }
    return out;
}

function orderedAlgorithmKeys(byAlgo) {
    var present = Object.keys(byAlgo);
    var ordered = ALGO_ORDER.filter(function (k) {
        return present.indexOf(k) >= 0;
    });
    for (var i = 0; i < present.length; i++) {
        if (ordered.indexOf(present[i]) < 0) ordered.push(present[i]);
    }
    return ordered;
}

async function fetchEvaluationItems() {
    var res = await fetch(API_BASE + '/evaluasi/models-metrics');
    var data = await res.json();
    if (!res.ok) {
        throw new Error(
            data && (data.detail || data.message)
                ? data.detail || data.message
                : 'Failed to fetch evaluation data.',
        );
    }
    return Array.isArray(data.items) ? data.items : [];
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
    renderBestInfo(algoKey, bestTraining, getBestTestingModel(rows));

    var bodyRows = rows
        .map(function (m) {
            var trClass = bestTraining && m === bestTraining ? ' class="row-best-training"' : '';
            var metricCells = TABLE_METRIC_DEFS.map(function (d) {
                var raw = d.trainField ? m[d.trainField] : null;
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

function buildLayeredParameterHtml(p) {
    if (!p) return '<p style="color:#999;">Parameter not available</p>';
    var algo = String(p.algo || p.canonical_algorithm || p.algoritma || '').toLowerCase();
    var gridStart = '<div class="layer-grid">';
    var gridEnd = '</div>';
    var sectionWrapStart = '<div class="layer-block"><h5 class="layer-title">';
    var sectionMid = '</h5>';
    var sectionWrapEnd = '</div>';

    function value(v) { return v == null || v === '' ? '-' : String(v); }
    function item(label, v) { return '<span><strong>' + label + ':</strong> ' + escapeHtml(value(v)) + '</span>'; }

    var inputLayer = sectionWrapStart + '1. Input Layer' + sectionMid + gridStart +
        item('Batch Size', p.batchSize || p.batch_size) +
        item('Max Length', p.maxLength || p.max_length) +
        item('Input Representation', TRANSFORMER_KEYS.indexOf(algo) >= 0 ? 'WordPiece Tokens + [CLS]/[SEP]' : 'Word Embedding') +
        gridEnd + sectionWrapEnd;

    var hiddenLayerItems = [
        item('Learning Rate', p.lr || p.learning_rate),
        item('Epoch', p.epoch),
        item('Optimizer', p.optimizer),
        item('Weight Decay', p.weightDecay || p.weight_decay),
        item('Scheduler', p.scheduler),
        item('Dropout', p.dropout),
    ];

    if (TRANSFORMER_KEYS.indexOf(algo) >= 0) {
        hiddenLayerItems.push(item('Warmup', p.warmup || p.warmup_ratio));
        hiddenLayerItems.push(item('Gradient Accumulation', p.gradAccum || p.gradient_accumulation));
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

function openEvaluationModelDetail(model) {
    var modal = document.getElementById('eval-model-detail-modal');
    if (!modal || !model) return;
    var testing = model.testing_result || {};
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
    if (dateEl) dateEl.textContent = model.created_at ? new Date(model.created_at).toLocaleString('id-ID') : '-';
    if (paramsEl) paramsEl.innerHTML = buildLayeredParameterHtml(model);
    renderEvaluationEpochMetrics(model, resultsBody, avgFoot, confusionSection, confusionMeta, confusionTable, confusionEmpty);
    modal.style.display = 'flex';
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
    var history = loadTrainingHistoryItems();
    if (!history.length) return null;
    var modelName = String(model.nama_model || '').trim().toLowerCase();
    var algo = String(model.canonical_algorithm || model.algoritma || '').trim().toLowerCase();
    var filtered = history.filter(function (h) {
        var hn = String(h.model_name || h.nama_model || '').trim().toLowerCase();
        var ha = String((h.parameter && h.parameter.algo) || '').trim().toLowerCase();
        return hn === modelName && (!algo || !ha || ha === algo);
    });
    if (!filtered.length) return null;
    filtered.sort(function (a, b) {
        return new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime();
    });
    return filtered[0];
}

function toEnglishConfusionLabel(raw) {
    var v = String(raw == null ? '' : raw).trim();
    var key = v.toLowerCase();
    var map = {
        ajakan: 'Invitation',
        larangan: 'Prohibition',
        perintah: 'Command',
        pertanyaan: 'Question',
        sapaan: 'Greeting',
        informasi: 'Information',
        deklaratif: 'Declarative',
        imperatif: 'Imperative',
        interogatif: 'Interrogative',
        pernyataan: 'Statement',
    };
    return map[key] || v;
}

function renderEvaluationEpochMetrics(model, tbody, avgFoot, confusionSection, confusionMeta, confusionTable, confusionEmpty) {
    if (!tbody || !avgFoot) return;
    var hist = findHistoryByModel(model);
    var results = hist && Array.isArray(hist.hasil) ? hist.hasil : [];
    if (!results.length) {
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
        return (
            '<tr class="' + (isBest ? 'best-row' : '') + '">' +
            '<td>' + escapeHtml(String(r.epoch == null ? '-' : r.epoch)) + '</td>' +
            '<td>' + formatFloatOrDash(r.accuracy, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.precision, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.recall, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.f1, 2) + '%</td>' +
            '<td>' + formatFloatOrDash(r.loss, 4) + '</td>' +
            '</tr>'
        );
    }).join('');

    var count = results.length;
    var sum = results.reduce(function (acc, r) {
        acc.accuracy += Number(r.accuracy) || 0;
        acc.precision += Number(r.precision) || 0;
        acc.recall += Number(r.recall) || 0;
        acc.f1 += Number(r.f1) || 0;
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
        var labelsEn = labels.map(function (l) { return toEnglishConfusionLabel(l); });
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

function renderTestingTable(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    var thead = document.getElementById('testing-metrics-thead');
    var tbody = document.getElementById('testing-metrics-tbody');
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
            '" class="empty-row">No testing data available.</td></tr>';
        return;
    }

    var bestTraining = getBestTrainingModel(rows);
    var bestTesting = getBestTestingModel(rows);
    var bodyRows = rows
        .map(function (m) {
            var t = m.testing_result || {};
            var classes = [];
            if (bestTraining && m === bestTraining) classes.push('row-best-training-ref');
            if (bestTesting && m === bestTesting) classes.push('row-best-testing');
            var trClass = classes.length ? ' class="' + classes.join(' ') + '"' : '';
            var metricCells = TABLE_METRIC_DEFS.map(function (d) {
                var raw = d.testField ? t[d.testField] : null;
                return '<td>' + formatByType(raw, d.type) + '</td>';
            }).join('');
            return (
                '<tr' + trClass + '>' +
                '<td>' + escapeHtml(m.nama_model || '-') + '</td>' +
                metricCells +
                '</tr>'
            );
        })
        .join('');
    tbody.innerHTML = bodyRows;
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
    var txt = type === 'percent' ? (Math.round(diff * 10) / 10).toFixed(1) + '%' : diff.toFixed(4);
    if (trainValue > testValue) return '<span class="fit over">Overfitting ' + txt + '</span>';
    if (testValue > trainValue) return '<span class="fit under">Underfitting ' + txt + '</span>';
    return '<span class="fit good">Seimbang</span>';
}

function renderSummaryTable(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    var thead = document.getElementById('fitting-summary-thead');
    var tbody = document.getElementById('fitting-summary-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '<tr><th>Metrics</th><th>Training</th><th>Testing</th><th>Perbedaan</th></tr>';
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No data available for fitting summary.</td></tr>';
        return;
    }

    var bestTraining = getBestTrainingModel(rows);
    var rowsSummary = TABLE_METRIC_DEFS.map(function (d) {
        var t = bestTraining ? bestTraining.testing_result || {} : {};
        var trainValue = d.trainField ? normalizeMetricValue(bestTraining ? bestTraining[d.trainField] : null, d.type) : null;
        var testValue = d.testField ? normalizeMetricValue(t[d.testField], d.type) : null;
        return {
            label: d.label,
            train: trainValue,
            test: testValue,
            type: d.type,
            diff: d.trainField && d.testField ? fittingStatus(trainValue, testValue, d.type) : '—',
        };
    });

    tbody.innerHTML = rowsSummary
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

function avgTestingByAlgo(algoKey, testField, asPercent) {
    var rows = state.byAlgo[algoKey] || [];
    var vals = rows
        .map(function (r) {
            var t = r.testing_result || {};
            if (!asPercent) {
                var n = Number(t[testField]);
                return Number.isFinite(n) ? n : null;
            }
            return normalizePercent(t[testField]);
        })
        .filter(function (v) {
            return v != null;
        });
    return mean(vals);
}

function normalizeMetricValue(raw, type) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (type === 'percent') return normalizePercent(raw);
    var n = Number(raw);
    return Number.isFinite(n) ? n : null;
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

function renderBestInfo(algoKey, bestTraining, bestTesting) {
    var trainEl = document.getElementById('training-best-info');
    var testEl = document.getElementById('testing-best-info');
    var algoLabel = escapeHtml(ALGO_LABELS[algoKey] || algoKey || '-');
    if (trainEl) {
        trainEl.innerHTML = bestTraining
            ? 'Best training metrics (' +
              algoLabel +
              '): <strong>' +
              escapeHtml(bestTraining.nama_model || '-') +
              '</strong> (Accuracy ' +
              formatPercent(bestTraining.accuracy) +
              ', F1 ' +
              formatPercent(bestTraining.f1_score) +
              ').'
            : 'Best training metrics (' + algoLabel + '): data tidak tersedia.';
    }
    if (testEl) {
        var testBestText = bestTesting
            ? '<strong>' +
              escapeHtml(bestTesting.nama_model || '-') +
              '</strong> (Accuracy ' +
              formatPercent((bestTesting.testing_result || {}).accuracy) +
              ', F1 ' +
              formatPercent((bestTesting.testing_result || {}).f1_macro) +
              ')'
            : 'data tidak tersedia';
        var trainRefText = bestTraining
            ? '<strong>' +
              escapeHtml(bestTraining.nama_model || '-') +
              '</strong> (Accuracy ' +
              formatPercent((bestTraining.testing_result || {}).accuracy) +
              ', F1 ' +
              formatPercent((bestTraining.testing_result || {}).f1_macro) +
              ')'
            : 'data tidak tersedia';
        testEl.innerHTML =
            'Testing metrics acuan best training (' +
            algoLabel +
            '): ' +
            trainRefText +
            '. Best testing metrics: ' +
            testBestText +
            '.';
    }
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
        '</tr>';

    var rows = TABLE_METRIC_DEFS.map(function (d) {
        return {
            label: d.label,
            field: d.testField,
            type: d.type,
        };
    });

    tbody.innerHTML = rows
        .map(function (r) {
            return (
                '<tr><td>' +
                r.label +
                '</td>' +
                cols
                    .map(function (k) {
                        if (!r.field) return '<td>—</td>';
                        if (!r.field) return '<td>—</td>';
                        var bestTraining = getBestTrainingModel(state.byAlgo[k] || []);
                        var t = bestTraining ? bestTraining.testing_result || {} : {};
                        var value = normalizeMetricValue(t[r.field], r.type);
                        return '<td>' + (value == null ? '—' : formatByType(value, r.type)) + '</td>';
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
                    data: tf.map(function (k) { return avgTestingByAlgo(k, 'accuracy', true) || 0; }),
                    backgroundColor: CHART_COLORS.transformerDark,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: tf.map(function (k) { return avgTestingByAlgo(k, 'f1_macro', true) || 0; }),
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
                    data: cl.map(function (k) { return avgTestingByAlgo(k, 'accuracy', true) || 0; }),
                    backgroundColor: CHART_COLORS.classicLight,
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: cl.map(function (k) { return avgTestingByAlgo(k, 'f1_macro', true) || 0; }),
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
                    data: all.map(function (k) { return avgTestingByAlgo(k, 'accuracy', true) || 0; }),
                    backgroundColor: all.map(function (k) {
                        return TRANSFORMER_KEYS.indexOf(k) >= 0 ? CHART_COLORS.transformerDark : CHART_COLORS.classicLight;
                    }),
                    borderRadius: 5,
                    barPercentage: 0.62,
                    categoryPercentage: 0.7,
                },
                {
                    label: 'F1',
                    data: all.map(function (k) { return avgTestingByAlgo(k, 'f1_macro', true) || 0; }),
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
        data: tf.map(function (k) { return avgTestingByAlgo(k, def.testField, asPercent) || 0; }),
        backgroundColor: CHART_COLORS.transformerDark,
        borderRadius: 5,
        barPercentage: 0.62,
        categoryPercentage: 0.7,
    }], asPercent);

    makeChart('chartClassic', clLabels, [{
        label: def.label,
        data: cl.map(function (k) { return avgTestingByAlgo(k, def.testField, asPercent) || 0; }),
        backgroundColor: CHART_COLORS.classicLight,
        borderRadius: 5,
        barPercentage: 0.62,
        categoryPercentage: 0.7,
    }], asPercent);

    makeChart('chartCombined', allLabels, [{
        label: def.label,
        data: all.map(function (k) { return avgTestingByAlgo(k, def.testField, asPercent) || 0; }),
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
        var avg = avgTestingByAlgo(k, testField);
        if (avg == null) continue;
        if (!best || avg > best.avg) best = { key: k, avg: avg };
    }
    return best;
}

function overallTestingScoreByAlgo(algoKey) {
    var metrics = [
        avgTestingByAlgo(algoKey, 'accuracy'),
        avgTestingByAlgo(algoKey, 'precision_macro'),
        avgTestingByAlgo(algoKey, 'recall_macro'),
        avgTestingByAlgo(algoKey, 'f1_macro'),
        avgTestingByAlgo(algoKey, 'weighted_avg'),
        avgTestingByAlgo(algoKey, 'mcc'),
        avgTestingByAlgo(algoKey, 'roc_auc'),
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
        bestModelBlock =
            '<p class="conclusion-prose"><strong>Best Overall Model (training-final):</strong> ' +
            escapeHtml(bestModel.nama_model || '-') +
            ' (' +
            escapeHtml(ALGO_LABELS[bestModel.canonical_algorithm] || bestModel.algoritma || '-') +
            ') with Accuracy <strong>' +
            escapeHtml(formatPercent(bestModel.accuracy)) +
            '</strong> and F1 <strong>' +
            escapeHtml(formatPercent(bestModel.f1_score)) +
            '</strong>.</p>';
    }

    el.innerHTML =
        '<div class="conclusion-stack">' +
        '<ol class="conclusion-points conclusion-points-numbered">' +
        '<li>' + transformerConclusion + '</li>' +
        '<li>' + classicConclusion + '</li>' +
        '<li><p class="conclusion-prose"><strong>Transformer vs Classic Comparison:</strong> ' + compareText + '</p></li>' +
        (bestModel ? '<li>' + bestModelBlock + '</li>' : '') +
        '</ol>' +
        '</div>';
    } catch (err) {
        el.innerHTML =
            '<div class="conclusion-stack conclusion-stack--empty">' +
            '<p class="conclusion-muted">Kesimpulan belum dapat ditampilkan: ' +
            escapeHtml(err && err.message ? err.message : 'unknown error') +
            '</p>' +
            '</div>';
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
            renderTestingTable(state.selectedTableAlgo);
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
            if (model) openEvaluationModelDetail(model);
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
        var chartReady = await ensureChartJsLoaded();
        if (!chartReady) {
            showChartHint('Chart.js failed to load. Please check internet/CDN access.');
        }
        var items = await fetchEvaluationItems();
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
            renderTestingTable(state.selectedTableAlgo);
            renderSummaryTable(state.selectedTableAlgo);
            renderAlgoComparisonTable();
        } catch (tableErr) {
            showError('Failed to render table section: ' + (tableErr && tableErr.message ? tableErr.message : 'unknown error'));
        }

        try {
            renderCharts(state.selectedChartMetric);
        } catch (chartErr) {
            showChartHint('Chart gagal dirender: ' + (chartErr && chartErr.message ? chartErr.message : 'unknown error'));
        }

        renderEvaluationConclusion(items);
        bindEvents();
    } catch (err) {
        showError(err && err.message ? err.message : 'Failed to load evaluation.');
    }
});
