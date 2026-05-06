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
var CHART_METRIC_DEFS = [
    { key: 'accuracy', label: 'Accuracy', testField: 'accuracy', asPercent: true },
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

    var bodyRows = rows
        .map(function (m) {
            var metricCells = TABLE_METRIC_DEFS.map(function (d) {
                var raw = d.trainField ? m[d.trainField] : null;
                return '<td>' + formatByType(raw, d.type) + '</td>';
            }).join('');
            return (
                '<tr>' +
                '<td>' + escapeHtml(m.nama_model || '-') + '</td>' +
                metricCells +
                '</tr>'
            );
        })
        .join('');

    var avgCells = TABLE_METRIC_DEFS.map(function (d) {
        if (!d.trainField) return '<td>—</td>';
        var vals = rows
            .map(function (m) {
                if (d.type === 'percent') return normalizePercent(m[d.trainField]);
                var n = Number(m[d.trainField]);
                return Number.isFinite(n) ? n : null;
            })
            .filter(function (v) {
                return v != null;
            });
        var avg = mean(vals);
        return '<td>' + (avg == null ? '—' : formatByType(avg, d.type)) + '</td>';
    }).join('');

    var avgRow =
        '<tr class="row-average">' +
        '<td>Average</td>' +
        avgCells +
        '</tr>';

    tbody.innerHTML = bodyRows + avgRow;
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

    var bodyRows = rows
        .map(function (m) {
            var t = m.testing_result || {};
            var metricCells = TABLE_METRIC_DEFS.map(function (d) {
                var raw = d.testField ? t[d.testField] : null;
                return '<td>' + formatByType(raw, d.type) + '</td>';
            }).join('');
            return (
                '<tr>' +
                '<td>' + escapeHtml(m.nama_model || '-') + '</td>' +
                metricCells +
                '</tr>'
            );
        })
        .join('');

    var avgCells = TABLE_METRIC_DEFS.map(function (d) {
        if (!d.testField) return '<td>—</td>';
        var vals = rows
            .map(function (m) {
                var t = m.testing_result || {};
                if (d.type === 'percent') return normalizePercent(t[d.testField]);
                var n = Number(t[d.testField]);
                return Number.isFinite(n) ? n : null;
            })
            .filter(function (v) {
                return v != null;
            });
        var avg = mean(vals);
        return '<td>' + (avg == null ? '—' : formatByType(avg, d.type)) + '</td>';
    }).join('');

    var avgRow =
        '<tr class="row-average">' +
        '<td>Average</td>' +
        avgCells +
        '</tr>';

    tbody.innerHTML = bodyRows + avgRow;
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

function fittingStatus(trainAvg, testAvg) {
    if (trainAvg == null || testAvg == null) return '—';
    var diff = Math.abs(trainAvg - testAvg);
    var pct = (Math.round(diff * 10) / 10).toFixed(1) + '%';
    if (trainAvg > testAvg) return '<span class="fit over">Overfitting ' + pct + '</span>';
    if (testAvg > trainAvg) return '<span class="fit under">Underfitting ' + pct + '</span>';
    return '<span class="fit good">Seimbang 0.0%</span>';
}

function renderSummaryTable(algoKey) {
    var rows = state.byAlgo[algoKey] || [];
    var thead = document.getElementById('fitting-summary-thead');
    var tbody = document.getElementById('fitting-summary-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '<tr><th>Model</th><th>Training</th><th>Testing</th><th>Perbedaan</th></tr>';
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No data available for fitting summary.</td></tr>';
        return;
    }

    var rowsSummary = TABLE_METRIC_DEFS.map(function (d) {
        var avg = { train: null, test: null };
        if (d.trainField) {
            avg.train = mean(
                rows
                    .map(function (r) {
                        if (d.type === 'percent') return normalizePercent(r[d.trainField]);
                        var n = Number(r[d.trainField]);
                        return Number.isFinite(n) ? n : null;
                    })
                    .filter(function (v) {
                        return v != null;
                    }),
            );
        }
        if (d.testField) {
            avg.test = mean(
                rows
                    .map(function (r) {
                        var t = r.testing_result || {};
                        if (d.type === 'percent') return normalizePercent(t[d.testField]);
                        var n = Number(t[d.testField]);
                        return Number.isFinite(n) ? n : null;
                    })
                    .filter(function (v) {
                        return v != null;
                    }),
            );
        }
        return {
            label: d.label,
            train: avg.train,
            test: avg.test,
            type: d.type,
            diff: d.trainField && d.testField ? fittingStatus(avg.train, avg.test) : '—',
        };
    });

    var percentRows = rowsSummary.filter(function (r) {
        return r.type === 'percent';
    });
    var macroTrain = mean(
        percentRows
            .map(function (r) {
                return r.train;
            })
            .filter(function (v) {
                return v != null;
            }),
    );
    var macroTest = mean(
        percentRows
            .map(function (r) {
                return r.test;
            })
            .filter(function (v) {
                return v != null;
            }),
    );
    rowsSummary.push({
        label: 'Overall Average (Comparable Metrics)',
        train: macroTrain,
        test: macroTest,
        diff: fittingStatus(macroTrain, macroTest),
    });

    tbody.innerHTML = rowsSummary
        .map(function (r, idx) {
            var klass = idx === rowsSummary.length - 1 ? ' class="row-average"' : '';
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
        '<tr><th>Model</th><th colspan="' +
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
                        var asPercent = r.type === 'percent';
                        var avg = avgTestingByAlgo(k, r.field, asPercent);
                        return '<td>' + (avg == null ? '—' : formatByType(avg, r.type)) + '</td>';
                    })
                    .join('') +
                '</tr>'
            );
        })
        .join('');
}

function makeChart(canvasId, labels, values, color, asPercent) {
    var el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    if (!labels.length) labels = ['No Data'];
    if (!values.length) values = [0];
    var valueLabelPlugin = {
        id: 'valueLabelPlugin_' + canvasId,
        afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            var meta = chart.getDatasetMeta(0);
            var ds = chart.data.datasets[0];
            if (!meta || !meta.data || !ds) return;
            ctx.save();
            ctx.font = '600 10px Inter, sans-serif';
            ctx.fillStyle = '#2c1f0e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            for (var i = 0; i < meta.data.length; i++) {
                var raw = Array.isArray(ds.data) ? Number(ds.data[i]) : NaN;
                if (!Number.isFinite(raw) || raw <= 0) continue;
                var p = meta.data[i].tooltipPosition();
                var txt = asPercent
                    ? (Math.round(raw * 10) / 10).toFixed(1) + '%'
                    : raw.toFixed(4);
                ctx.fillText(txt, p.x, p.y - 4);
            }
            ctx.restore();
        },
    };
    var c = new Chart(el, {
        type: 'bar',
        plugins: [valueLabelPlugin],
        data: {
            labels: labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: color,
                    borderRadius: 5,
                    barPercentage: 0.55,
                    categoryPercentage: 0.6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: asPercent ? 100 : undefined,
                    ticks: {
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

    makeChart(
        'chartTransformer',
        tf.map(function (k) {
            return ALGO_LABELS[k] || k;
        }),
        tf.map(function (k) {
            return avgTestingByAlgo(k, def.testField, asPercent) || 0;
        }),
        'rgba(44,31,14,0.85)',
        asPercent,
    );
    makeChart(
        'chartClassic',
        cl.map(function (k) {
            return ALGO_LABELS[k] || k;
        }),
        cl.map(function (k) {
            return avgTestingByAlgo(k, def.testField, asPercent) || 0;
        }),
        'rgba(120,85,60,0.82)',
        asPercent,
    );
    makeChart(
        'chartCombined',
        all.map(function (k) {
            return ALGO_LABELS[k] || k;
        }),
        all.map(function (k) {
            return avgTestingByAlgo(k, def.testField, asPercent) || 0;
        }),
        all.map(function (k) {
            return TRANSFORMER_KEYS.indexOf(k) >= 0 ? 'rgba(44,31,14,0.85)' : 'rgba(120,85,60,0.82)';
        }),
        asPercent,
    );
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
    var best = null;
    for (var i = 0; i < items.length; i++) {
        var row = items[i];
        var acc = normalizePercent(row.accuracy);
        var f1 = normalizePercent(row.f1_score);
        if (acc == null) continue;
        if (!best) {
            best = { row: row, acc: acc, f1: f1 == null ? -Infinity : f1 };
            continue;
        }
        var currF1 = f1 == null ? -Infinity : f1;
        if (acc > best.acc || (acc === best.acc && currF1 > best.f1)) {
            best = { row: row, acc: acc, f1: currF1 };
        }
    }
    return best ? best.row : null;
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
        '<section class="conclusion-block" aria-labelledby="conclusion-transformer-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-transformer-h">Transformer Conclusion</h3>' +
        transformerConclusion +
        '</section>' +
        '<section class="conclusion-block" aria-labelledby="conclusion-classic-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-classic-h">Classic Conclusion</h3>' +
        classicConclusion +
        '</section>' +
        '<section class="conclusion-block" aria-labelledby="conclusion-combined-h">' +
        '<h3 class="conclusion-block-title" id="conclusion-combined-h">Combined Conclusion</h3>' +
        '<p class="conclusion-prose"><strong>Transformer vs Classic Comparison:</strong> ' +
        compareText +
        '</p>' +
        bestModelBlock +
        '</section>' +
        '</div>';
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

        renderTrainingTable(state.selectedTableAlgo);
        renderTestingTable(state.selectedTableAlgo);
        renderSummaryTable(state.selectedTableAlgo);
        renderAlgoComparisonTable();
        renderCharts(state.selectedChartMetric);
        renderEvaluationConclusion(items);
        bindEvents();
    } catch (err) {
        showError(err && err.message ? err.message : 'Failed to load evaluation.');
    }
});
