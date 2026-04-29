/* =============================
   DATA
============================= */
var API_BASE = 'http://127.0.0.1:8000';
// Prefer same-origin only when it looks like the backend (e.g. port 8000).
try {
    if (window.location && window.location.origin && window.location.origin !== 'null') {
        var port = window.location.port;
        if (!port || port === '8000') {
            API_BASE = window.location.origin;
        }
    }
} catch (e) {
    // ignore
}

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
    'nda': 'tidak',
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
    default: { wrong: 0.10 }
};

var algorithmModelMap = {
    transformer: [
        { value: '', label: 'Belum ada model tersimpan' }
    ]
};

var metricIds = ['acc', 'prec', 'f1', 'macro', 'rec', 'std', 'weighted', 'roc', 'mcc'];
var metricHeaderIds = ['mAcc', 'mPrec', 'mF1', 'mMacro', 'mRec', 'mStd', 'mWeighted', 'mRoc', 'mMcc'];

var runCount = 0;
var isRunning = false;
var isTestingKata = false;
var currentMode = 'upload';
var uploadedFile = null;
var kataValid = false;
var selectedDatasetId = null;
var selectedDatasetName = null;
var selectedModelId = null;
var selectedModelMaxLength = 64;
var testingModels = [];

function showTestingError(message) {
    var box = document.getElementById('testingError');
    if (!box) return;
    if (!message) {
        box.style.display = 'none';
        box.textContent = '';
        return;
    }
    box.style.display = 'block';
    box.textContent = message;
}

function setTestingUiBusy(busy) {
    var btn = document.getElementById('btnStart');
    if (btn) {
        btn.disabled = !!busy;
        btn.classList.toggle('is-loading', !!busy);
    }

    var els = [
        'selAlgorithm',
        'selModel',
        'selDirection',
        'fileDataset',
        'inputKata',
        'btnTestKata'
    ];
    for (var i = 0; i < els.length; i++) {
        var el = document.getElementById(els[i]);
        if (el) el.disabled = !!busy;
    }

    // Kunci toggle sumber data saat sedang running.
    var options = document.querySelectorAll('.ds-option');
    for (var j = 0; j < options.length; j++) {
        options[j].classList.toggle('disabled', !!busy);
        options[j].style.pointerEvents = busy ? 'none' : '';
        options[j].style.opacity = busy ? '0.6' : '';
    }
}

function initAlgorithmModelSelect() {
    var algorithmSelect = document.getElementById('selAlgorithm');
    var modelSelect = document.getElementById('selModel');
    if (!algorithmSelect || !modelSelect) return;

    function toKey(str) {
        return String(str || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-');
    }

    function refreshSelectedModelMeta() {
        var selectedModelName = modelSelect.value;
        var found = null;
        for (var i = 0; i < testingModels.length; i++) {
            var item = testingModels[i];
            if (item.nama_model === selectedModelName) {
                found = item;
                break;
            }
        }

        if (found) {
            selectedModelId = found.id || null;
            selectedDatasetId = found.dataset_id || null;
            selectedDatasetName = found.dataset_name || null;
            selectedModelMaxLength = found.max_length || 64;
            document.getElementById('dsTitle').textContent = selectedDatasetName || ('Dataset ID ' + selectedDatasetId);
            document.getElementById('dsSubtitle').textContent = 'Dataset berdasarkan model terpilih';
            document.getElementById('dsFile').textContent = selectedDatasetName || ('Dataset ID ' + selectedDatasetId);
            document.getElementById('dsImporter').textContent = 'Model Registry';
        } else {
            selectedModelId = null;
            selectedDatasetId = null;
            selectedDatasetName = null;
            selectedModelMaxLength = 64;
        }
    }

    function populateModelOptions(algorithmKey) {
        var models = algorithmModelMap[algorithmKey] || [];
        modelSelect.innerHTML = '';

        models.forEach(function(model) {
            var option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });

        modelSelect.disabled = !models.length || models[0].value === '';
        refreshSelectedModelMeta();
    }

    fetch(API_BASE + '/testing/models')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data || !Array.isArray(data.items) || data.items.length === 0) {
                throw new Error('Model pada tabel models belum tersedia.');
            }

            testingModels = data.items;
            var grouped = {};
            for (var i = 0; i < testingModels.length; i++) {
                var model = testingModels[i];
                var algoName = model.algoritma || 'Tidak Diketahui';
                var key = toKey(algoName);
                if (!grouped[key]) {
                    grouped[key] = {
                        label: algoName,
                        models: []
                    };
                }
                grouped[key].models.push({
                    value: model.nama_model,
                    label: model.nama_model
                });
            }

            algorithmModelMap = {};
            algorithmSelect.innerHTML = '';

            var keys = Object.keys(grouped);
            keys.forEach(function(key, idx) {
                algorithmModelMap[key] = grouped[key].models;
                var option = document.createElement('option');
                option.value = key;
                option.textContent = grouped[key].label;
                if (idx === 0) option.selected = true;
                algorithmSelect.appendChild(option);
            });

            populateModelOptions(algorithmSelect.value);
        })
        .catch(function(err) {
            algorithmModelMap = {
                unavailable: [{ value: '', label: 'Tidak dapat memuat model dari backend' }]
            };
            algorithmSelect.innerHTML = '<option value="unavailable">Tidak tersedia</option>';
            populateModelOptions('unavailable');
            showTestingError(err.message || 'Gagal memuat data model testing.');
        });

    algorithmSelect.addEventListener('change', function() {
        populateModelOptions(algorithmSelect.value);
    });

    modelSelect.addEventListener('change', function() {
        refreshSelectedModelMeta();
    });
}

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
        showTestingError('Hanya file .csv yang diizinkan.');
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
   INPUT KATA (MAKS 2)
============================= */
function initKataInput() {
    var input = document.getElementById('inputKata');
    var hint = document.getElementById('kataHint');
    var btnTest = document.getElementById('btnTestKata');

    input.addEventListener('input', function() {
        var val = input.value.trim();
        var words = val === '' ? [] : val.split(/\s+/);
        var count = words.length;

        hint.textContent = count + ' / 2 kata';

        if (count > 2) {
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

        if (count > 0 && count <= 2) {
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
    var kamus = direction === 'm2i' ? kamusM2I : kamusI2M; // fallback jika backend gagal
    var variation = modelVariation[model] || modelVariation.default;

    var sourceLang = direction === 'm2i' ? 'manado' : 'indonesia';
    var targetKey = direction === 'm2i' ? 'indonesia' : 'manado';

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
            var delay = 300 + Math.random() * 500;

            setTimeout(async function() {
                var wordStart = performance.now();

                var lowerWord = String(word).toLowerCase();
                var translated = '[tidak ditemukan]';

                // Buat item dulu agar UI responsif, lalu update setelah backend selesai.
                var item = document.createElement('div');
                item.className = 'kata-result-item';
                item.innerHTML =
                    '<span class="kata-result-num">' + (index + 1) + '</span>' +
                    '<div class="kata-result-content">' +
                    '<div class="kata-result-word">' + word + '</div>' +
                    '<div class="kata-result-arrow">↓</div>' +
                    '<div class="kata-result-translated">...</div>' +
                    '</div>' +
                    '<span class="kata-result-time">...</span>';

                listEl.appendChild(item);
                requestAnimationFrame(function() {
                    item.classList.add('visible');
                });

                try {
                    var res = await fetch(
                        API_BASE + '/search?query=' + encodeURIComponent(lowerWord) +
                        '&lang=' + encodeURIComponent(sourceLang)
                    );
                    var data = await res.json();

                    if (res.ok && data && Array.isArray(data.results) && data.results.length > 0) {
                        translated = data.results[0][targetKey];
                        if (!translated) translated = '[tidak ditemukan]';
                    } else {
                        translated = '[tidak ditemukan]';
                    }

                    // Simulasi "wrong" untuk konsistensi tampilan lama.
                    if (translated !== '[tidak ditemukan]' && Math.random() < variation.wrong) {
                        translated = '[' + translated + ']';
                    }
                } catch (e) {
                    // Fallback: kalau backend gagal, gunakan kamus lokal.
                    if (kamus[lowerWord]) {
                        if (Math.random() < variation.wrong) {
                            translated = '[' + kamus[lowerWord] + ']';
                        } else {
                            translated = kamus[lowerWord];
                        }
                    } else {
                        translated = '[tidak ditemukan]';
                    }
                }

                var wordEnd = performance.now();
                var wordTime = ((wordEnd - wordStart) / 1000).toFixed(2);

                item.querySelector('.kata-result-translated').innerHTML = translated;
                item.querySelector('.kata-result-time').textContent = wordTime + 's';

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
async function startTesting() {
    if (isRunning) return;
    showTestingError('');

    var kataVal = document.getElementById('inputKata').value.trim();

    if (currentMode === 'input') {
        if (!kataVal) {
            showTestingError('Silakan input kata terlebih dahulu.');
            return;
        }
        if (!kataValid) {
            showTestingError('Input kata tidak boleh lebih dari 2 kata.');
            return;
        }
    }

    if (!selectedDatasetId || isNaN(selectedDatasetId)) {
        showTestingError('Dataset tidak ditemukan dari model terpilih. Pastikan kolom dataset_id pada tabel models terisi.');
        return;
    }

    isRunning = true;
    runCount++;

    setTestingUiBusy(true);

    resetMetrics();
    setStatus('pending');
    document.getElementById('runBadge').textContent = '#' + runCount;

    var model = document.getElementById('selModel').value;
    if (!model) {
        showTestingError('Model belum tersedia. Simpan model terlebih dahulu dari halaman Processing.');
        setTestingUiBusy(false);
        isRunning = false;
        return;
    }
    var direction = document.getElementById('selDirection').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;

    if (currentMode === 'upload') {
        document.getElementById('sumDataset').textContent = selectedDatasetName || ('Dataset ID ' + selectedDatasetId);
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
        { at: 25, msg: 'Menghubungkan ke backend testing...' },
        { at: 35, msg: 'Menyiapkan model hasil training...' },
        { at: 45, msg: 'Memproses input...' },
        { at: 55, msg: 'Tokenisasi data uji...' },
        { at: 65, msg: 'Tokenisasi selesai' },
        { at: 75, msg: 'Menjalankan inferensi...' },
        { at: 85, msg: 'Inferensi berlangsung...' },
        { at: 92, msg: 'Menghitung metrik evaluasi...' },
        { at: 100, msg: 'Testing selesai' }
    ];

    var backendResult = null;
    try {
        var res = await fetch(API_BASE + '/testing/indobert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataset_id: selectedDatasetId,
                model_name: model,
                model_id: selectedModelId,
                max_length: selectedModelMaxLength || 64,
                limit: null,
                save_result: true
            })
        });
        var data = await res.json();
        if (!res.ok) {
            throw new Error(data && (data.detail || data.message) ? (data.detail || data.message) : 'Testing backend gagal.');
        }
        backendResult = data;
    } catch (err) {
        bar.classList.remove('running');
        setStatus('idle');
        text.textContent = 'Gagal menjalankan testing';
        showTestingError(err && err.message ? err.message : 'Gagal menjalankan testing backend.');
        setTestingUiBusy(false);
        isRunning = false;
        return;
    }

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
            finishTesting(backendResult, direction);
        }
    }, 120);
}

function finishTesting(result, direction) {
    var acc = Number(result.accuracy || 0) * 100;
    var precision = Number(result.precision_macro || 0) * 100;
    var recall = Number(result.recall_macro || 0) * 100;
    var f1 = Number(result.f1_macro || 0) * 100;
    var mcc = Number(result.mcc || 0) * 100; // MCC 0..1 diubah ke persen agar konsisten UI
    var roc = Number(result.roc_auc || 0) * 100;
    var std = Number(result.std_deviation || 0) * 100;
    var weighted = Number(result.weighted_avg || 0) * 100;
    var macro = f1;

    var r = {
        acc: Math.round(acc),
        prec: Math.round(precision),
        f1: Math.round(f1),
        macro: Math.round(macro),
        rec: Math.round(recall),
        std: Math.round(std),
        weighted: Math.round(weighted),
        roc: Math.round(roc),
        mcc: Math.round(mcc)
    };

    metricIds.forEach(function(id, i) {
        setTimeout(function() {
            document.getElementById(metricHeaderIds[i]).classList.add('revealed');
            document.getElementById(id).classList.add('revealed');
            animateValue(document.getElementById(id), r[id], 800);
        }, i * 100);
    });

    var btn = document.getElementById('btnStart');
    setTestingUiBusy(false);
    isRunning = false;
}

/* =============================
   INIT
============================= */
initUpload();
initKataInput();
initAlgorithmModelSelect();