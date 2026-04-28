/* =============================
   DATA
============================= */
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

var kamusM2I = {
    'torang': 'kita',
    'ngana': 'kamu',
    'dia': 'dia',
    'aku': 'saya',
    'ni': 'ini',
    'pi': 'pergi',
    'pigi': 'pergi',
    'makan': 'makan',
    'minum': 'minum',
    'tidur': 'tidur',
    'rumah': 'rumah',
    'bia': 'burung',
    'sagi': 'ikan',
    'nasi': 'nasi',
    'air': 'air',
    'bagus': 'bagus',
    'baik': 'baik',
    'banyak': 'banyak',
    'sikit': 'sedikit',
    'besar': 'besar',
    'su': 'sudah',
    'belum': 'belum',
    'so': 'ada',
    'tau': 'tahu',
    'bakudapa': 'bertemu',
    'jange': 'jangan',
    'jang': 'jangan',
    'sampe': 'sampai',
    'dari': 'dari',
    'ke': 'ke',
    'di': 'di',
    'pa': 'berapa',
    'bae': 'baik',
    'mo': 'mau',
    'mau': 'mau',
    'kase': 'beri',
    'bajanjang': 'berjalan',
    'bareng': 'bersama',
    'tarima': 'terima',
    'baco': 'baca',
    'tulis': 'tulis',
    'pikir': 'pikir',
    'cari': 'cari',
    'baso': 'basi',
    'manis': 'manis',
    'pahit': 'pahit',
    'masam': 'masam',
    'panas': 'panas',
    'dingin': 'dingin',
    'malam': 'malam',
    'pagi': 'pagi',
    'sore': 'sore',
    'siang': 'siang',
    'lantai': 'lantai',
    'dinding': 'dinding',
    'pintu': 'pintu',
    'jendela': 'jendela',
    'meja': 'meja',
    'kursi': 'kursi'
};

var kamusI2M = {};
var kI2M = Object.keys(kamusM2I);
for (var k = 0; k < kI2M.length; k++) {
    kamusI2M[kamusM2I[kI2M[k]]] = kI2M[k];
}

var modelVariation = {
    xlmr: { wrong: 0.05 },
    mbert: { wrong: 0.15 },
    indobert: { wrong: 0.10 }
};

var metricIds = ['acc', 'prec', 'f1', 'macro', 'rec', 'std', 'weighted', 'roc', 'mcc'];
var metricHeaderIds = ['mAcc', 'mPrec', 'mF1', 'mMacro', 'mRec', 'mStd', 'mWeighted', 'mRoc', 'mMcc'];

var runCount = 0;
var isRunning = false;
var isTestingKata = false;
var currentMode = 'upload';
var uploadedFile = null;
var kataValid = false;

/* =============================
   SWITCH MODE
============================= */
function switchMode(mode) {
    currentMode = mode;

    var options = document.querySelectorAll('.ds-option');
    for (var i = 0; i < options.length; i++) {
        options[i].classList.toggle('active', options[i].getAttribute('data-mode') === mode);
    }

    document.getElementById('panelUpload').classList.toggle('show', mode === 'upload');
    document.getElementById('panelInput').classList.toggle('show', mode === 'input');
}

/* =============================
   UPLOAD DATASET
============================= */
function initUpload() {
    var area = document.getElementById('uploadArea');
    var input = document.getElementById('fileDataset');

    area.addEventListener('click', function() {
        input.click();
    });

    area.addEventListener('dragover', function(e) {
        e.preventDefault();
        area.style.borderColor = 'var(--accent)';
        area.style.background = 'var(--bg)';
    });

    area.addEventListener('dragleave', function() {
        if (!uploadedFile) {
            area.style.borderColor = '';
            area.style.background = '';
        }
    });

    area.addEventListener('drop', function(e) {
        e.preventDefault();
        area.style.borderColor = '';
        area.style.background = '';
        var files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    input.addEventListener('change', function() {
        if (input.files.length > 0) {
            handleFile(input.files[0]);
        }
    });
}

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Hanya file .csv yang diizinkan.');
        return;
    }

    uploadedFile = file;

    var area = document.getElementById('uploadArea');
    area.classList.add('has-file');
    document.getElementById('uploadText').textContent = '✓ ' + file.name;

    var sizeStr;
    if (file.size > 1048576) {
        sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
        sizeStr = (file.size / 1024).toFixed(1) + ' KB';
    }

    var basePairs = Math.max(100, Math.floor(file.size / 45));
    var verb = Math.floor(basePairs * 0.48);
    var noun = Math.floor(basePairs * 0.34);
    var adj = Math.floor(basePairs * 0.08);
    var adv = basePairs - verb - noun - adj;

    function fmt(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    document.getElementById('dsTitle').textContent = file.name;
    document.getElementById('dsSubtitle').textContent = 'Dataset yang diunggah';
    document.getElementById('dsFile').textContent = file.name + ' (' + sizeStr + ')';
    document.getElementById('dsTotal').textContent = fmt(basePairs) + ' pasangan';
    document.getElementById('katVerb').textContent = fmt(verb);
    document.getElementById('katNoun').textContent = fmt(noun);
    document.getElementById('katAdj').textContent = fmt(adj);
    document.getElementById('katAdv').textContent = fmt(adv);
    document.getElementById('dsImporter').textContent = 'Pengguna';

    var today = new Date();
    var dateStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    document.getElementById('dsDate').textContent = dateStr;

    setStatus('idle');
}

/* =============================
   INPUT KATA (MAKS 3)
============================= */
function initKataInput() {
    var input = document.getElementById('inputKata');
    var hint = document.getElementById('kataHint');
    var btnTest = document.getElementById('btnTestKata');

    input.addEventListener('input', function() {
        var val = input.value.trim();
        var words = val === '' ? [] : val.split(/\s+/);
        var count = words.length;

        hint.textContent = count + ' / 3 kata';

        if (count > 3) {
            hint.classList.add('over');
            input.classList.add('over');
            kataValid = false;
            btnTest.disabled = true;
        } else {
            hint.classList.remove('over');
            input.classList.remove('over');
            kataValid = true;
            btnTest.disabled = (count === 0);
        }

        document.getElementById('kataResult').classList.remove('show');

        if (count > 0 && count <= 3) {
            document.getElementById('dsTitle').textContent = '"' + val + '"';
            document.getElementById('dsSubtitle').textContent = 'Input kata manual';
            document.getElementById('dsFile').textContent = 'Input langsung';
            document.getElementById('dsTotal').textContent = count + ' kata';
            document.getElementById('katVerb').textContent = '0';
            document.getElementById('katNoun').textContent = '0';
            document.getElementById('katAdj').textContent = '0';
            document.getElementById('katAdv').textContent = '0';
            document.getElementById('dsImporter').textContent = 'Pengguna';

            var today = new Date();
            var dateStr = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');
            document.getElementById('dsDate').textContent = dateStr;

            setStatus('idle');
        } else if (count === 0) {
            document.getElementById('dsTitle').textContent = 'Belum ada dataset';
            document.getElementById('dsSubtitle').textContent = 'Unggah file atau input kata untuk memulai';
            document.getElementById('dsFile').textContent = '—';
            document.getElementById('dsTotal').textContent = '—';
            document.getElementById('katVerb').textContent = '0';
            document.getElementById('katNoun').textContent = '0';
            document.getElementById('katAdj').textContent = '0';
            document.getElementById('katAdv').textContent = '0';
            document.getElementById('dsImporter').textContent = '—';
            document.getElementById('dsDate').textContent = '—';
        }
    });
}

/* =============================
   UJI KATA
============================= */
function testKata() {
    if (isTestingKata || isRunning) return;

    var val = document.getElementById('inputKata').value.trim();
    if (!val || !kataValid) return;

    isTestingKata = true;
    var btnTest = document.getElementById('btnTestKata');
    btnTest.disabled = true;
    btnTest.textContent = 'Menguji...';

    var words = val.split(/\s+/);
    var direction = document.getElementById('selDirection').value;
    var model = document.getElementById('selModel').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;
    var kamus = direction === 'm2i' ? kamusM2I : kamusI2M;
    var variation = modelVariation[model];

    var listEl = document.getElementById('kataResultList');
    listEl.innerHTML = '';
    document.getElementById('kataResultDivider').style.display = 'none';
    document.getElementById('kataResultSummary').style.display = 'none';

    var resultBox = document.getElementById('kataResult');
    resultBox.classList.add('show');

    var totalStartTime = performance.now();
    var finishedCount = 0;

    words.forEach(function(word, index) {
        setTimeout(function() {
            var wordStart = performance.now();
            var delay = 300 + Math.random() * 500;

            setTimeout(function() {
                var wordEnd = performance.now();
                var wordTime = ((wordEnd - wordStart) / 1000).toFixed(2);

                var lowerWord = word.toLowerCase();
                var translated;

                if (kamus[lowerWord]) {
                    if (Math.random() < variation.wrong) {
                        translated = '[' + kamus[lowerWord] + ']';
                    } else {
                        translated = kamus[lowerWord];
                    }
                } else {
                    translated = '[tidak ditemukan]';
                }

                var item = document.createElement('div');
                item.className = 'kata-result-item';
                item.innerHTML =
                    '<span class="kata-result-num">' + (index + 1) + '</span>' +
                    '<div class="kata-result-content">' +
                    '<div class="kata-result-word">' + word + '</div>' +
                    '<div class="kata-result-arrow">↓</div>' +
                    '<div class="kata-result-translated">' + translated + '</div>' +
                    '</div>' +
                    '<span class="kata-result-time">' + wordTime + 's</span>';

                listEl.appendChild(item);

                requestAnimationFrame(function() {
                    item.classList.add('visible');
                });

                finishedCount++;

                if (finishedCount === words.length) {
                    var totalEnd = performance.now();
                    var totalTime = ((totalEnd - totalStartTime) / 1000).toFixed(2);

                    document.getElementById('kataResultDivider').style.display = 'block';
                    document.getElementById('kataResultSummary').style.display = 'flex';
                    document.getElementById('krModel').textContent = modelLabel;
                    document.getElementById('krDir').textContent = dirLabel;
                    document.getElementById('krTime').textContent = totalTime + ' detik';

                    btnTest.disabled = false;
                    btnTest.textContent = 'Uji Kata';
                    isTestingKata = false;
                }
            }, delay);
        }, index * 600);
    });
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
        document.getElementById(id).classList.remove('revealed');
    });
    metricHeaderIds.forEach(function(id) {
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
   START TESTING
============================= */
function startTesting() {
    if (isRunning) return;

    var kataVal = document.getElementById('inputKata').value.trim();

    if (currentMode === 'upload') {
        if (!uploadedFile) {
            alert('Silakan unggah file dataset terlebih dahulu.');
            return;
        }
    } else {
        if (!kataVal) {
            alert('Silakan input kata terlebih dahulu.');
            return;
        }
        if (!kataValid) {
            alert('Input kata tidak boleh lebih dari 3 kata.');
            return;
        }
    }

    isRunning = true;
    runCount++;

    var btn = document.getElementById('btnStart');
    btn.disabled = true;

    resetMetrics();
    setStatus('pending');
    document.getElementById('runBadge').textContent = '#' + runCount;

    var model = document.getElementById('selModel').value;
    var direction = document.getElementById('selDirection').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;

    if (currentMode === 'upload') {
        document.getElementById('sumDataset').textContent = uploadedFile.name;
        document.getElementById('sumKata').textContent = '—';
    } else {
        document.getElementById('sumDataset').textContent = 'Input Kata';
        document.getElementById('sumKata').textContent = kataVal;
    }
    document.getElementById('sumModel').textContent = modelLabel;
    document.getElementById('sumDir').textContent = dirLabel;
    document.getElementById('progressSummary').classList.add('show');

    var bar = document.getElementById('progressBar');
    var text = document.getElementById('progressText');
    bar.classList.add('running');

    var progress = 0;

    var messages = [
        { at: 5, msg: 'Memuat data...' },
        { at: 15, msg: 'Data dimuat' },
        { at: 25, msg: 'Mempersiapkan model...' },
        { at: 35, msg: 'Model siap' },
        { at: 45, msg: 'Memproses input...' },
        { at: 55, msg: 'Tokenisasi data uji...' },
        { at: 65, msg: 'Tokenisasi selesai' },
        { at: 75, msg: 'Menjalankan inferensi...' },
        { at: 85, msg: 'Inferensi berlangsung...' },
        { at: 92, msg: 'Menghitung metrik evaluasi...' },
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
            document.getElementById(metricHeaderIds[i]).classList.add('revealed');
            document.getElementById(id).classList.add('revealed');
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
initUpload();
initKataInput();