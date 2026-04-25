document.addEventListener('DOMContentLoaded', function () {
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
});