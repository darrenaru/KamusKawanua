document.addEventListener('DOMContentLoaded', function () {
<<<<<<< HEAD
    var ctx = document.getElementById('performanceChart').getContext('2d');

    var labels = [
        'Accuracy',
        'Precision',
        'Recall',
        'F1-Score',
        'Top-3 Accuracy',
        'Mean Cosine\nSimilarity'
    ];

    var word2vecData = [87, 85, 72, 86, 92, 91];
    var gloveData   = [81, 79, 65, 80, 88, 83];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Word2Vec',
                    data: word2vecData,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    hoverBackgroundColor: 'rgba(59, 130, 246, 0.95)',
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6
                },
                {
                    label: 'GloVe',
                    data: gloveData,
                    backgroundColor: 'rgba(245, 158, 11, 0.75)',
                    hoverBackgroundColor: 'rgba(245, 158, 11, 0.95)',
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1c1f2e',
                    titleColor: '#e8eaed',
                    bodyColor: '#9ca3af',
                    borderColor: '#252836',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { family: 'Inter', weight: '600', size: 13 },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        label: function (context) {
                            var val = context.parsed.y;
                            var label = context.dataset.label;
                            var metric = context.label.replace('\n', ' ');

                            if (metric.includes('Cosine')) {
                                return label + ': ' + (val / 100).toFixed(2);
                            }
                            return label + ': ' + val + '%';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#6b7280',
                        font: { family: 'Inter', size: 11, weight: '400' },
                        maxRotation: 0,
                        callback: function (value) {
                            var label = this.getLabelForValue(value);
                            return label.split('\n');
                        }
                    },
                    border: { color: '#252836' }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: { family: 'Inter', size: 11 },
                        stepSize: 20,
                        callback: function (value) {
                            return value + '%';
                        }
                    },
                    border: { display: false }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
=======

    var metricNames = ['Accuracy','Precision','Recall','F1-Score','Macro Avg','Weighted Avg','MCC','ROC-AUC'];

    var colors = [
        'rgba(44, 31, 14, 0.85)',
        'rgba(70, 52, 30, 0.85)',
        'rgba(100, 70, 40, 0.80)',
        'rgba(130, 90, 50, 0.75)',
        'rgba(160, 115, 65, 0.70)',
        'rgba(180, 135, 75, 0.65)',
        'rgba(90, 122, 58, 0.80)',
        'rgba(50, 110, 90, 0.80)'
    ];

    var borders = [
        '#2c1f0e','#46341e','#644628','#825a32',
        '#a07341','#b4874b','#5a7a3a','#326e5a'
    ];

    function buildLegend(id, cols, names) {
        var el = document.getElementById(id);
        var h = '';
        for (var i = 0; i < names.length; i++) {
            h += '<div class="leg-item"><span class="leg-dot" style="background:' + cols[i] + '"></span>' + names[i] + '</div>';
        }
        el.innerHTML = h;
    }

    function topLabelPlugin() {
        return {
            id: 'topLabels',
            afterDatasetsDraw: function (chart) {
                var ctx = chart.ctx;
                chart.data.datasets.forEach(function (ds, di) {
                    var meta = chart.getDatasetMeta(di);
                    if (meta.hidden) return;
                    meta.data.forEach(function (bar, idx) {
                        var v = ds.data[idx];
                        var t = v < 1 ? v.toFixed(2) : v + '%';
                        ctx.save();
                        ctx.fillStyle = '#1a1714';
                        ctx.font = '500 10px Inter, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(t, bar.x, bar.y - 4);
                        ctx.restore();
                    });
                });
            }
        };
    }

    var baseOpts = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#fffdf7',
                titleColor: '#1a1714',
                bodyColor: '#6b5e50',
                borderColor: 'rgba(44, 31, 14, 0.15)',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 10,
                titleFont: { family: 'Inter', weight: '600', size: 12 },
                bodyFont: { family: 'Inter', size: 11 },
                callbacks: {
                    label: function (c) {
                        var v = c.parsed.y;
                        return c.dataset.label + ': ' + (v < 1 ? v.toFixed(2) : v + '%');
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9a8e7f', font: { family: 'Inter', size: 11, weight: '500' } },
                border: { color: 'rgba(44, 31, 14, 0.1)' }
            },
            y: {
                beginAtZero: false,
                min: 60,
                max: 100,
                grid: { color: 'rgba(44, 31, 14, 0.06)', drawBorder: false },
                ticks: {
                    color: '#9a8e7f',
                    font: { family: 'Inter', size: 11 },
                    stepSize: 10,
                    callback: function (v) { return v + '%'; }
                },
                border: { display: false }
            }
        },
        animation: { duration: 900, easing: 'easeOutQuart' }
    };

    function ds(label, data, i) {
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

    /* ===== TRANSFORMER CHART ===== */
    new Chart(document.getElementById('chartTransformer'), {
        type: 'bar',
        data: {
            labels: ['XLM-R', 'IndoBERT', 'mBERT'],
            datasets: [
                ds('Accuracy',     [94, 91, 89], 0),
                ds('Precision',    [93, 90, 88], 1),
                ds('Recall',       [89, 86, 84], 2),
                ds('F1-Score',     [93, 91, 88], 3),
                ds('Macro Avg',    [92, 90, 87], 4),
                ds('Weighted Avg', [93, 91, 88], 5),
                ds('MCC',          [88, 85, 82], 6),
                ds('ROC-AUC',      [97, 95, 94], 7)
            ]
        },
        plugins: [topLabelPlugin()],
        options: JSON.parse(JSON.stringify(baseOpts))
    });

    buildLegend('legendTransformer', colors, metricNames);

    /* ===== CLASSIC CHART ===== */
    new Chart(document.getElementById('chartClassic'), {
        type: 'bar',
        data: {
            labels: ['Word2Vec', 'GloVe'],
            datasets: [
                ds('Accuracy',     [87, 81], 0),
                ds('Precision',    [85, 79], 1),
                ds('Recall',       [72, 65], 2),
                ds('F1-Score',     [86, 80], 3),
                ds('Macro Avg',    [83, 77], 4),
                ds('Weighted Avg', [86, 80], 5),
                ds('MCC',          [74, 65], 6),
                ds('ROC-AUC',      [91, 85], 7)
            ]
        },
        plugins: [topLabelPlugin()],
        options: JSON.parse(JSON.stringify(baseOpts))
    });

    buildLegend('legendClassic', colors, metricNames);
>>>>>>> 5389e9f (Initial commit)
});