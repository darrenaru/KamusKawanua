/* =============================
   DATA
============================= */
var datasetDetails = {
    'dataset_kamus.csv': {
        title: 'dataset_kamus.csv',
        subtitle: 'Kamus terjemahan Manado - Indonesia',
        file: 'dataset_kamus.csv',
        total: '3,724 pasangan',
        verb: '1,926',
        noun: '1,426',
        adj: '0',
        adv: '372',
        importer: 'Reagen',
        date: '2026-04-12'
    },
    'dataset_paralel.csv': {
        title: 'dataset_paralel.csv',
        subtitle: 'Korpus paralel Manado - Indonesia',
        file: 'dataset_paralel.csv',
        total: '28,700 pasangan',
        verb: '12,480',
        noun: '10,350',
        adj: '2,140',
        adv: '3,730',
        importer: 'Reagen',
        date: '2026-03-28'
    },
    'dataset_slang.csv': {
        title: 'dataset_slang.csv',
        subtitle: 'Slang & ungkapan khas Manado',
        file: 'dataset_slang.csv',
        total: '9,820 pasangan',
        verb: '4,120',
        noun: '3,890',
        adj: '890',
        adv: '920',
        importer: 'Admin',
        date: '2026-04-05'
    }
};

var modelResults = {
    xlmr: {
        m2i: { acc: 95, prec: 93, f1: 92, macro: 95, rec: 93, std: 95, weighted: 95, roc: 95, mcc: 95 },
        i2m: { acc: 93, prec: 91, f1: 90, macro: 92, rec: 91, std: 93, weighted: 92, roc: 93, mcc: 92 }
    },
    mbert: {
        m2i: { acc: 88, prec: 86, f1: 85, macro: 87, rec: 86, std: 89, weighted: 87, roc: 90, mcc: 88 },
        i2m: { acc: 86, prec: 84, f1: 83, macro: 85, rec: 84, std: 87, weighted: 85, roc: 88, mcc: 85 }
    },
    indobert: {
        m2i: { acc: 91, prec: 89, f1: 88, macro: 90, rec: 89, std: 92, weighted: 90, roc: 93, mcc: 91 },
        i2m: { acc: 89, prec: 87, f1: 86, macro: 88, rec: 87, std: 90, weighted: 88, roc: 91, mcc: 88 }
    }
};

// Data simulasi terjemahan
var translationData = {
    m2i: [
        { src: 'Kita pi makan di rumah', out: 'Kita pergi makan di rumah' },
        { src: 'Dia sudah pindah ke Manado', out: 'Dia sudah pindah ke Manado' },
        { src: 'Ngana mau pigi ke mana?', out: 'Kamu mau pergi ke mana?' },
        { src: 'Torang samua bae di sini', out: 'Kita semua baik di sini' },
        { src: 'Bai ini barang bagus banget', out: 'Ini barang bagus banget' },
        { src: 'Aku su bilang sampe tiga kali', out: 'Saya sudah bilang sampai tiga kali' },
        { src: 'So ngoni pa berapa orang?', out: 'Ada kalian berapa orang?' },
        { src: 'Jang banyak tinggal, mari kita berangkat', out: 'Jangan lama-lama, mari kita berangkat' }
    ],
    i2m: [
        { src: 'Kita pergi makan di rumah', out: 'Kita pi makan di rumah' },
        { src: 'Dia sudah pindah ke Manado', out: 'Dia sudah pindah ke Manado' },
        { src: 'Kamu mau pergi ke mana?', out: 'Ngana mau pigi ke mana?' },
        { src: 'Kita semua baik di sini', out: 'Torang samua bae di sini' },
        { src: 'Ini barang bagus banget', out: 'Bai ini barang bagus banget' },
        { src: 'Saya sudah bilang sampai tiga kali', out: 'Aku su bilang sampe tiga kali' },
        { src: 'Ada kalian berapa orang?', out: 'So ngoni pa berapa orang?' },
        { src: 'Jangan lama-lama, mari kita berangkat', out: 'Jang banyak tinggal, mari kita berangkat' }
    ]
};

// Variasi per model (simulasi kualitas berbeda)
var modelTranslationStyle = {
    xlmr: { prefix: '', suffix: '' },
    mbert: { prefix: '', suffix: '' },
    indobert: { prefix: '', suffix: '' }
};

var metricIds = ['acc', 'prec', 'f1', 'macro', 'rec', 'std', 'weighted', 'roc', 'mcc'];
var metricBoxIds = ['mAcc', 'mPrec', 'mF1', 'mMacro', 'mRec', 'mStd', 'mWeighted', 'mRoc', 'mMcc'];

var runCount = 0;
var isRunning = false;
var isTranslating = false;

/* =============================
   RENDER DATASET
============================= */
function renderDataset(key) {
    var d = datasetDetails[key];
    if (!d) return;
    document.getElementById('dsTitle').textContent = d.title;
    document.getElementById('dsSubtitle').textContent = d.subtitle;
    document.getElementById('dsFile').textContent = d.file;
    document.getElementById('dsTotal').textContent = d.total;
    document.getElementById('katVerb').textContent = d.verb;
    document.getElementById('katNoun').textContent = d.noun;
    document.getElementById('katAdj').textContent = d.adj;
    document.getElementById('katAdv').textContent = d.adv;
    document.getElementById('dsImporter').textContent = d.importer;
    document.getElementById('dsDate').textContent = d.date;
}

/* =============================
   STATUS
============================= */
function setStatus(status) {
    var badge = document.getElementById('statusBadge');
    var text = document.getElementById('statusText');
    badge.className = 'status-badge ' + status;
    text.textContent = status;
}

/* =============================
   RESET METRICS
============================= */
function resetMetrics() {
    metricIds.forEach(function(id) {
        document.getElementById(id).textContent = '0%';
    });
    metricBoxIds.forEach(function(id) {
        document.getElementById(id).classList.remove('revealed');
    });
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressBar').classList.remove('running');
    document.getElementById('progressText').textContent = 'Menunggu...';
    document.getElementById('progressSummary').classList.remove('show');
}

/* =============================
   ANIMASI COUNTER
============================= */
function animateValue(el, target, duration) {
    var start = 0;
    var startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (target - start) * eased) + '%';
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

/* =============================
   TERJEMAHKAN KALIMAT
============================= */
function translateSentence() {
    if (isTranslating || isRunning) return;

    var input = document.getElementById('inputKalimat').value.trim();
    if (!input) return;

    isTranslating = true;
    var btn = document.getElementById('btnTranslate');
    btn.disabled = true;
    btn.textContent = 'Menerjemahkan...';

    var direction = document.getElementById('selDirection').value;
    var model = document.getElementById('selModel').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;

    var resultBox = document.getElementById('translateResult');
    document.getElementById('resultSource').textContent = input;
    document.getElementById('resultOutput').textContent = '...';
    document.getElementById('resultModel').textContent = modelLabel;
    document.getElementById('resultDir').textContent = dirLabel;
    document.getElementById('resultTime').textContent = '...';
    resultBox.classList.add('show');

    var startTime = performance.now();

    // Simulasi delay inferensi
    setTimeout(function() {
        var endTime = performance.now();
        var duration = ((endTime - startTime) / 1000).toFixed(2);

        // Cari di data simulasi, atau buat terjemahan generik
        var pool = translationData[direction];
        var found = null;

        for (var i = 0; i < pool.length; i++) {
            if (pool[i].src.toLowerCase() === input.toLowerCase()) {
                found = pool[i].out;
                break;
            }
        }

        var result;
        if (found) {
            result = found;
        } else {
            // Buat simulasi sederhana dari kata-kata
            var words = input.split(' ');
            var translated = [];
            for (var j = 0; j < words.length; j++) {
                var w = words[j].toLowerCase();
                translated.push(w);
            }
            if (direction === 'm2i') {
                result = input.replace(/pi/gi, 'pergi').replace(/torang/gi, 'kita').replace(/ngana/gi, 'kamu').replace(/bai/gi, '').replace(/su/gi, 'sudah').replace(/sampe/gi, 'sampai').replace(/so/gi, 'ada').replace(/pa/gi, 'berapa').replace(/jang/gi, 'jangan').replace(/  +/g, ' ').trim();
            } else {
                result = input.replace(/pergi/gi, 'pi').replace(/kita/gi, 'torang').replace(/kamu/gi, 'ngana').replace(/sudah/gi, 'su').replace(/sampai/gi, 'sampe').replace(/ada/gi, 'so').replace(/berapa/gi, 'pa').replace(/jangan/gi, 'jang');
            }
            if (!result) result = '[Terjemahan simulasi: ' + input + ']';
        }

        document.getElementById('resultOutput').textContent = result;
        document.getElementById('resultTime').textContent = duration + ' detik';

        btn.disabled = false;
        btn.textContent = 'Terjemahkan';
        isTranslating = false;
    }, 800 + Math.random() * 600);
}

/* =============================
   START TESTING
============================= */
function startTesting() {
    if (isRunning) return;
    isRunning = true;
    runCount++;

    var btn = document.getElementById('btnStart');
    btn.disabled = true;

    resetMetrics();
    setStatus('pending');
    document.getElementById('runBadge').textContent = '#' + runCount;

    var model = document.getElementById('selModel').value;
    var direction = document.getElementById('selDirection').value;
    var dataset = document.getElementById('selDataset').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;

    document.getElementById('sumDataset').textContent = dataset;
    document.getElementById('sumModel').textContent = modelLabel;
    document.getElementById('sumDir').textContent = dirLabel;
    document.getElementById('progressSummary').classList.add('show');

    var bar = document.getElementById('progressBar');
    var text = document.getElementById('progressText');
    bar.classList.add('running');

    var progress = 0;

    var messages = [
        { at: 5, msg: 'Memuat dataset...' },
        { at: 15, msg: 'Dataset dimuat' },
        { at: 25, msg: 'Mempersiapkan model...' },
        { at: 35, msg: 'Model siap' },
        { at: 45, msg: 'Tokenisasi data uji...' },
        { at: 55, msg: 'Tokenisasi selesai' },
        { at: 65, msg: 'Menjalankan inferensi...' },
        { at: 80, msg: 'Inferensi berlangsung...' },
        { at: 90, msg: 'Menghitung metrik evaluasi...' },
        { at: 100, msg: 'Testing selesai' }
    ];

    var interval = setInterval(function() {
        progress += 5;
        bar.style.width = progress + '%';
        text.textContent = progress + '%';

        for (var i = 0; i < messages.length; i++) {
            if (progress === messages[i].at) {
                text.textContent = progress + '% — ' + messages[i].msg;
                break;
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            bar.classList.remove('running');
            setStatus('tested');
            finishTesting(model, direction);
        }
    }, 120);
}

function finishTesting(model, direction) {
    var r = modelResults[model][direction];

    metricIds.forEach(function(id, i) {
        setTimeout(function() {
            document.getElementById(metricBoxIds[i]).classList.add('revealed');
            animateValue(document.getElementById(id), r[id], 800);
        }, i * 100);
    });

    var btn = document.getElementById('btnStart');
    btn.disabled = false;
    isRunning = false;
}

/* =============================
   INIT
============================= */
renderDataset('dataset_kamus.csv');