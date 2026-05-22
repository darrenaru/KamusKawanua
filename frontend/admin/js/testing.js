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

/* =============================
   PREPROCESSING (same flow as preprocessing.html)
   — seed preprocessed_data from raw_data, then backend tokenizer job
============================= */
var TESTING_SUPABASE_URL = 'https://cdrabgiuvfisxntfzskd.supabase.co';
var TESTING_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcmFiZ2l1dmZpc3hudGZ6c2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTE3MDYsImV4cCI6MjA5NDA4NzcwNn0.7mOQSIwKZqH-SJtAIQFvmM-iFwjlUrmoknc6mZiny6Y';
var testingSupabaseClient = null;

function getTestingSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        return null;
    }
    if (!testingSupabaseClient) {
        testingSupabaseClient = window.supabase.createClient(TESTING_SUPABASE_URL, TESTING_SUPABASE_KEY);
    }
    return testingSupabaseClient;
}

function cleanTextForTesting(text) {
    if (!text) return '';
    text = String(text).toLowerCase();
    text = text.replace(/[^a-zA-Z\s]/g, '');
    text = text.replace(/(.)\1{2,}/g, '$1$1');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

async function fetchAllRawDataForTesting(datasetId) {
    var client = getTestingSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not available. Reload the page and try again.');
    }
    var allData = [];
    var from = 0;
    var limit = 1000;
    while (true) {
        var res = await client
            .from('raw_data')
            .select('*')
            .eq('dataset_id', datasetId)
            .range(from, from + limit - 1);
        if (res.error) throw res.error;
        var data = res.data;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        from += limit;
    }
    return allData;
}

function parseSplitRatioForTesting(splitRatio) {
    var raw = String(splitRatio || '').trim();
    var m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return { train: 80, test: 20 };
    var train = Number(m[1]);
    var test = Number(m[2]);
    if (!Number.isFinite(train) || !Number.isFinite(test) || train + test !== 100 || test <= 0) {
        return { train: 80, test: 20 };
    }
    return { train: train, test: test };
}

function pickTestingSubsetByRatio(rows, splitRatio) {
    var ratio = parseSplitRatioForTesting(splitRatio);
    var testFrac = ratio.test / 100;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (rows.length === 1 || testFrac >= 1) return rows.slice();
    var targetCount = Math.max(1, Math.round(rows.length * testFrac));
    if (targetCount >= rows.length) return rows.slice();

    // Deterministik berdasarkan id_kata agar subset test konsisten antar-run.
    var sorted = rows.slice().sort(function(a, b) {
        var ka = String((a && a.id_kata) || '');
        var kb = String((b && b.id_kata) || '');
        return ka.localeCompare(kb);
    });
    return sorted.slice(0, targetCount);
}

async function pollTestingPreprocessJob(jobId, onProgress) {
    while (true) {
        var res = await fetch(API_BASE + '/preprocess/status/' + jobId);
        var status = await res.json();
        if (!res.ok) {
            throw new Error(status && status.message ? status.message : 'Failed to read preprocessing status');
        }
        var total = Number(status.total || 0);
        var processed = Number(status.processed || 0);
        var deviceLabel = status.device ? ' | Device: ' + String(status.device).toUpperCase() : '';
        var hasTotal = total > 0;
        var msg = hasTotal
            ? 'Tokenizing ' + processed + '/' + total + deviceLabel
            : 'Preparing tokenizer...' + deviceLabel;
        // Preprocess backend phase: 30%–72% mengikuti processed/total (proporsional lama tokenisasi).
        var frac = hasTotal ? Math.min(1, processed / total) : 0;
        var pct = hasTotal ? 30 + Math.round(42 * frac) : 31;
        if (status.status === 'cancelled') {
            throw new Error('Preprocessing was cancelled');
        }
        if (status.status === 'error') {
            throw new Error(status.error || 'Backend tokenizer failed');
        }
        if (status.status === 'done') {
            if (typeof onProgress === 'function') {
                var doneMsg = hasTotal
                    ? 'Tokenizer finished: ' + processed + '/' + total + ' rows processed' + deviceLabel
                    : 'Tokenizer finished: 0 rows — all rows already have tokens (no re-run needed; same as a second preprocessing pass)' + deviceLabel;
                onProgress(72, doneMsg);
            }
            return status;
        }
        if (typeof onProgress === 'function') {
            onProgress(Math.min(71, pct), msg);
        }
        await new Promise(function(resolve) { setTimeout(resolve, 800); });
    }
}

/**
 * Mirrors preprocessing.js: upsert cleaned rows from raw_data, then POST /preprocess/start + poll.
 * @param {number} datasetId
 * @param {'indobert'|'mbert'|'xlm-r-2'} tokenizerKey
 * @param {function(number, string)=} onProgress
 */
async function runTestingPreprocessPipeline(datasetId, tokenizerKey, splitRatio, onProgress) {
    var client = getTestingSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not available. Reload the page and try again.');
    }
    var tk = normalizeTestingAlgo(tokenizerKey);
    if (tk !== 'indobert' && tk !== 'mbert' && tk !== 'xlm-r-2') {
        tk = 'mbert';
    }
    var algoLabel = getAlgorithmDisplayName(tk);

    if (typeof onProgress === 'function') {
        onProgress(2, 'Preprocessing (' + algoLabel + '): reading raw_data...');
    }

    var allData = await fetchAllRawDataForTesting(datasetId);
    if (!allData || allData.length === 0) {
        throw new Error('Raw data is empty for this dataset. Import data first.');
    }
    var testRows = pickTestingSubsetByRatio(allData, splitRatio);
    if (!testRows || testRows.length === 0) {
        throw new Error('No rows selected for testing subset. Check model split ratio and dataset content.');
    }
    var idKataFilter = testRows
        .map(function(row) { return String((row && row.id_kata) || '').trim(); })
        .filter(function(v) { return !!v; });

    var chunkSize = 100;
    for (var i = 0; i < testRows.length; i += chunkSize) {
        var chunk = testRows.slice(i, i + chunkSize);
        var processed = chunk.map(function(row) {
            return {
                dataset_id: row.dataset_id,
                id_kata: row.id_kata,
                jenis: row.jenis,
                manado: row.manado,
                indonesia: row.indonesia,
                kalimat_manado: row.kalimat_manado,
                kalimat_indonesia: row.kalimat_indonesia,
                manado_clean: cleanTextForTesting(row.manado),
                indonesia_clean: cleanTextForTesting(row.indonesia),
                kalimat_manado_clean: cleanTextForTesting(row.kalimat_manado),
                kalimat_indonesia_clean: cleanTextForTesting(row.kalimat_indonesia),
                // Paksa subset test ini ditokenisasi ulang, tanpa mereset seluruh dataset.
                input_ids: null,
                attention_mask: null,
                bert_tokens: null,
                manado_tokens: null,
                indonesia_tokens: null,
                kalimat_manado_tokens: null,
                kalimat_indonesia_tokens: null,
                final_text: null,
                jenis_label: null
            };
        });
        var up = await client.from('preprocessed_data').upsert(processed, {
            onConflict: 'dataset_id,id_kata',
            ignoreDuplicates: false
        });
        if (up.error) throw up.error;
        var inserted = Math.min(testRows.length, i + chunk.length);
        // Seeding: 3%–30% mengikuti jumlah baris (proporsional lama upsert Supabase).
        var insertPercent = 3 + Math.round((inserted / testRows.length) * 27);
        if (typeof onProgress === 'function') {
            onProgress(insertPercent, 'Seeding preprocessed_data (test subset) ' + inserted + '/' + testRows.length);
        }
    }

    if (typeof onProgress === 'function') {
        onProgress(30, 'Starting backend tokenizer (' + algoLabel + ')...');
    }

    var startRes = await fetch(
        API_BASE + '/preprocess/start/' + datasetId +
            '?tokenizer=' + encodeURIComponent(tk) +
            '&force_retokenize=0' +
            '&id_kata_filter=' + encodeURIComponent(idKataFilter.join(',')),
        { method: 'POST' }
    );
    var startData = await startRes.json();
    if (!startRes.ok || !startData || !startData.job_id) {
        throw new Error((startData && startData.message) ? startData.message : 'Failed to start backend tokenizer');
    }
    await pollTestingPreprocessJob(startData.job_id, onProgress);

    var dsUp = await client.from('datasets').update({ is_preprocessed: true }).eq('id', datasetId);
    if (dsUp.error) {
        console.warn('testing: could not update datasets.is_preprocessed', dsUp.error);
    }
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

var algorithmModelMap = {};

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
var selectedModelName = '';
var selectedModelMaxLength = 64;
var selectedLatestTesting = null;
var selectedModelSplitRatio = '80:20';
var selectedModelTrainingAccuracy = null;
var testingModels = [];
var progressTimer = null;
var progressStartedAt = null;
var testingFetchProgressTimer = null;
var progressStepOrder = ['prepare', 'connect', 'process', 'metrics', 'finish'];

function normalizeAccuracyToFraction(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    // models.accuracy lama disimpan dalam persen (mis. 87), sedangkan hasil backend testing 0..1.
    if (n > 1) return n / 100;
    if (n < 0) return null;
    return n;
}

function clearTestingFetchProgressTimer() {
    if (testingFetchProgressTimer) {
        clearInterval(testingFetchProgressTimer);
        testingFetchProgressTimer = null;
    }
}

function getSelectedModelLabel() {
    var bestEl = document.getElementById('bestModelName');
    if (bestEl) {
        var t = String(bestEl.textContent || '').trim();
        if (t && t !== '—' && !/^loading/i.test(t) && !/^no saved/i.test(t)) {
            return t;
        }
    }
    var sel = document.getElementById('selModel');
    if (sel && sel.tagName === 'SELECT' && sel.options && sel.options.length > 0) {
        var idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
        return sel.options[idx].text;
    }
    return selectedModelName || '—';
}

function resetTestingRunUi() {
    clearTestingFetchProgressTimer();
    isRunning = false;
    setTestingUiBusy(false);
    var bar = document.getElementById('progressBar');
    if (bar) bar.classList.remove('running');
    stopProgressElapsedTimer();
    setStatus('idle');
}

function fetchWithTimeout(url, options, timeoutMs) {
    var ms = Number(timeoutMs) || 600000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller
        ? setTimeout(function() {
              controller.abort();
          }, ms)
        : null;
    var opts = options || {};
    if (controller) {
        opts.signal = controller.signal;
    }
    return fetch(url, opts).finally(function() {
        if (timer) clearTimeout(timer);
    });
}

function normalizeAlgorithmKey(str) {
    var key = String(str || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');
    if (key === 'xlm-r-2' || key === 'xlmr' || key === 'xlm-r') return 'xlm-r-2';
    return key;
}

function normalizeTestingAlgo(value) {
    var key = normalizeAlgorithmKey(value);
    if (key === 'indobert' || key === 'indo-bert' || key === 'indobenchmark') return 'indobert';
    if (key === 'mbert' || key === 'm-bert' || key === 'bert-base-multilingual-cased') return 'mbert';
    if (key === 'xlm-r-2') return 'xlm-r-2';
    return key;
}

function getAlgorithmDisplayName(key) {
    var normalized = normalizeTestingAlgo(key);
    if (normalized === 'mbert') return 'mBERT';
    if (normalized === 'indobert') return 'IndoBERT';
    if (normalized === 'xlm-r-2') return 'XLM-R';
    if (normalized === 'word2vec') return 'Word2Vec';
    if (normalized === 'glove') return 'GloVe';
    return String(key || '').toUpperCase();
}

async function predictWordWithSelectedModel(word) {
    var algorithm = document.getElementById('selAlgorithm').value;
    var modelName = selectedModelName;

    if (!modelName) {
        throw new Error('Model is not available yet. Save the model first from the Processing page.');
    }

    var res = await fetch(API_BASE + '/testing/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            algorithm: algorithm,
            model_name: modelName,
            text: word,
            max_length: selectedModelMaxLength || 64
        })
    });
    var data = await res.json();
    if (!res.ok) {
        throw new Error(data && (data.detail || data.message) ? (data.detail || data.message) : 'Prediction request failed.');
    }
    return data;
}

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

function showTestingInfo(message) {
    var box = document.getElementById('testingInfo');
    if (!box) return;
    if (!message) {
        box.style.display = 'none';
        box.textContent = '';
        return;
    }
    box.style.display = 'block';
    box.textContent = message;
}

function updateStartButtonState() {
    var btn = document.getElementById('btnStart');
    var algorithm = document.getElementById('selAlgorithm');
    var model = document.getElementById('selModel');
    if (!btn) return;

    var hasAlgorithm = !!(algorithm && algorithm.value);
    var hasModel = !!(model && model.value);
    var hasDataset = !!selectedDatasetId;
    btn.disabled = isRunning || !hasAlgorithm || !hasModel || !hasDataset;
}

function applyStoredTestingMetrics(summary) {
    if (!summary) return;
    renderTestingMetricCells(mapStoredTestingSummary(summary));

    var createdAt = summary.created_at ? new Date(summary.created_at).toLocaleString('en-US') : '-';
    var progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = 'Loaded latest testing result from Supabase.';
    }
    setStatus('tested');
    var datasetMsg = summary.dataset_name
        ? ' Previous testing used dataset: ' + summary.dataset_name + '.'
        : '';
    showTestingInfo(
        'This model has been tested before (latest result: ' + createdAt + ').' +
        datasetMsg +
        ' If you run Start Testing again, the previous testing result will be replaced by the new one.'
    );
}

function syncTestingStateForSelection() {
    if (isRunning) return;
    showTestingError('');
    if (selectedLatestTesting) {
        applyStoredTestingMetrics(selectedLatestTesting);
    } else {
        resetMetrics();
        setStatus('idle');
        var datasetHint = selectedDatasetName
            ? ' Linked dataset for this model: ' + selectedDatasetName + '.'
            : '';
        showTestingInfo('This model does not have any saved testing result yet.' + datasetHint + ' Select algorithm, model, and dataset, then click Start Testing.');
    }
    updateStartButtonState();
}

async function refreshSelectedModelLatestTestingFromBackend() {
    if (!selectedModelId) return;
    try {
        var res = await fetchWithTimeout(API_BASE + '/testing/models', {}, 30000);
        var data = await res.json();
        if (!res.ok || !data || !Array.isArray(data.items)) return;

        testingModels = data.items;
        var found = null;
        for (var i = 0; i < testingModels.length; i++) {
            var item = testingModels[i];
            if (Number(item.id) === Number(selectedModelId)) {
                found = item;
                break;
            }
        }
        if (!found) return;

        selectedLatestTesting = found.latest_testing || null;
        selectedDatasetId =
            (selectedLatestTesting && selectedLatestTesting.dataset_id) ||
            found.dataset_id ||
            null;
        selectedDatasetName =
            (selectedLatestTesting && selectedLatestTesting.dataset_name) ||
            found.dataset_name ||
            null;
        selectedModelMaxLength = found.max_length || 64;
        selectedModelSplitRatio = found.split_ratio || '80:20';
        selectedModelTrainingAccuracy = normalizeAccuracyToFraction(found.training_accuracy);
        selectedModelName = found.nama_model || '';
    } catch (e) {
        // Keep current state if refresh fails.
    }
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
    updateStartButtonState();
}

function initAlgorithmModelSelect() {
    var algorithmSelect = document.getElementById('selAlgorithm');
    var modelSelect = document.getElementById('selModel');
    if (!algorithmSelect || !modelSelect) return;

    function refreshSelectedModelMeta() {
        var selectedModelKey = modelSelect.value;
        var found = null;
        var selectedId = Number(selectedModelKey);
        for (var i = 0; i < testingModels.length; i++) {
            var item = testingModels[i];
            if (Number(item.id) === selectedId) {
                found = item;
                break;
            }
        }

        if (found) {
            selectedModelId = found.id || null;
            selectedLatestTesting = found.latest_testing || null;
            selectedDatasetId =
                (selectedLatestTesting && selectedLatestTesting.dataset_id) ||
                found.dataset_id ||
                null;
            selectedDatasetName =
                (selectedLatestTesting && selectedLatestTesting.dataset_name) ||
                found.dataset_name ||
                null;
            selectedModelMaxLength = found.max_length || 64;
            selectedModelSplitRatio = found.split_ratio || '80:20';
            selectedModelTrainingAccuracy = normalizeAccuracyToFraction(found.training_accuracy);
            selectedModelName = found.nama_model || '';
            // Do not auto-fill dataset card UI for old models.
            // Keep dataset reference internally and show it through info messages only.
        } else {
            selectedModelId = null;
            selectedDatasetId = null;
            selectedDatasetName = null;
            selectedModelMaxLength = 64;
            selectedModelSplitRatio = '80:20';
            selectedModelTrainingAccuracy = null;
            selectedLatestTesting = null;
            selectedModelName = '';
        }
        syncTestingStateForSelection();
    }

    function populateModelOptions(algorithmKey) {
        var algoKeyNorm = normalizeTestingAlgo(algorithmKey);
        var algoModels = [];
        for (var i = 0; i < testingModels.length; i++) {
            var m = testingModels[i];
            var key = normalizeTestingAlgo(m.algoritma || 'Unknown');
            if (key === algoKeyNorm) {
                algoModels.push(m);
            }
        }
        var bestModelNameEl = document.getElementById('bestModelName');
        var bestModelScoreEl = document.getElementById('bestModelScore');
        var selModel = document.getElementById('selModel');
        
        if (algoModels.length === 0) {
            selModel.value = '';
            if (bestModelNameEl) bestModelNameEl.textContent = 'No saved model for ' + getAlgorithmDisplayName(algorithmKey) + ' yet';
            if (bestModelScoreEl) bestModelScoreEl.textContent = '';
            showTestingError('No saved model for ' + getAlgorithmDisplayName(algorithmKey) + '. Train and save the model first from Processing.');
            showTestingInfo('');
        } else {
            // Prioritas: model yang sudah punya hasil testing, lalu skor training tertinggi.
            algoModels.sort(function(a, b) {
                var testedA = a.latest_testing ? 1 : 0;
                var testedB = b.latest_testing ? 1 : 0;
                if (testedB !== testedA) return testedB - testedA;
                var scoreA = Number(a.training_accuracy) || 0;
                var scoreB = Number(b.training_accuracy) || 0;
                return scoreB - scoreA;
            });
            var best = algoModels[0];
            selModel.value = best.id;
            var bestScore = Number(best.training_accuracy) || 0;
            if (bestModelNameEl) bestModelNameEl.textContent = best.nama_model || 'Model_' + best.id;
            if (bestModelScoreEl) bestModelScoreEl.textContent = 'Best Training Score (Accuracy+F1): ' + (bestScore > 1 ? bestScore.toFixed(2) : (bestScore * 100).toFixed(2)) + '%';
            showTestingError('');
        }
        refreshSelectedModelMeta();
        updateStartButtonState();
    }

    fetch(API_BASE + '/testing/models')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data || !Array.isArray(data.items) || data.items.length === 0) {
                throw new Error('No model is available in the models table.');
            }

            testingModels = data.items;
            var grouped = {};
            for (var i = 0; i < testingModels.length; i++) {
                var model = testingModels[i];
                var algoName = model.algoritma || 'Unknown';
                var key = normalizeTestingAlgo(algoName);
                if (!grouped[key]) {
                    grouped[key] = {
                        label: getAlgorithmDisplayName(key),
                        models: []
                    };
                }
                grouped[key].models.push({
                    value: String(model.id || ''),
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

            var preferred = normalizeTestingAlgo(localStorage.getItem('selectedAlgorithm'));
            if (preferred && !algorithmModelMap[preferred]) {
                algorithmModelMap[preferred] = [];
                var missingOption = document.createElement('option');
                missingOption.value = preferred;
                missingOption.textContent = getAlgorithmDisplayName(preferred);
                algorithmSelect.appendChild(missingOption);
            }
            if (preferred) {
                algorithmSelect.value = preferred;
            }
            populateModelOptions(algorithmSelect.value);
            updateStartButtonState();
        })
        .catch(function(err) {
            algorithmModelMap = {
                unavailable: [{ value: '', label: 'Unable to load model list from backend' }]
            };
            algorithmSelect.innerHTML = '<option value="unavailable">Unavailable</option>';
            populateModelOptions('unavailable');
            showTestingError(err.message || 'Failed to load testing model data.');
            showTestingInfo('');
            updateStartButtonState();
        });

    algorithmSelect.addEventListener('change', function() {
        populateModelOptions(algorithmSelect.value);
        updateStartButtonState();
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
        showTestingError('Only .csv files are allowed.');
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
    document.getElementById('dsSubtitle').textContent = 'Uploaded dataset';
    document.getElementById('dsFile').textContent = file.name + ' (' + sizeStr + ')';
    document.getElementById('dsTotal').textContent = fmt(basePairs) + ' pairs';
    document.getElementById('katVerb').textContent = fmt(verb);
    document.getElementById('katNoun').textContent = fmt(noun);
    document.getElementById('katAdj').textContent = fmt(adj);
    document.getElementById('katAdv').textContent = fmt(adv);
    document.getElementById('dsImporter').textContent = 'User';

    var today = new Date();
    var dateStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    document.getElementById('dsDate').textContent = dateStr;

    setStatus('idle');
}

/* =============================
   WORD INPUT (single word only)
============================= */
function initKataInput() {
    var input = document.getElementById('inputKata');
    var hint = document.getElementById('kataHint');
    var btnTest = document.getElementById('btnTestKata');

    input.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
    });
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text');
        var first = String(text || '').trim().split(/\s+/)[0] || '';
        input.value = first;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('input', function() {
        var val = input.value.trim();
        var words = val === '' ? [] : val.split(/\s+/);
        var count = words.length;

        hint.textContent = count > 0 ? '1 word' : 'Enter one word (no spaces)';

        if (count > 1) {
            hint.classList.add('over');
            input.classList.add('over');
            kataValid = false;
            btnTest.disabled = true;
        } else {
            hint.classList.remove('over');
            input.classList.remove('over');
            kataValid = count === 1;
            btnTest.disabled = count !== 1;
        }

        document.getElementById('kataResult').classList.remove('show');

        if (count === 1) {
            document.getElementById('dsTitle').textContent = '"' + val + '"';
            document.getElementById('dsSubtitle').textContent = 'Manual word input';
            document.getElementById('dsFile').textContent = 'Direct input';
            document.getElementById('dsTotal').textContent = '1 word';
            document.getElementById('katVerb').textContent = '0';
            document.getElementById('katNoun').textContent = '0';
            document.getElementById('katAdj').textContent = '0';
            document.getElementById('katAdv').textContent = '0';
            document.getElementById('dsImporter').textContent = 'User';

            var today = new Date();
            var dateStr = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');
            document.getElementById('dsDate').textContent = dateStr;

            setStatus('idle');
        } else if (count === 0) {
            document.getElementById('dsTitle').textContent = 'No dataset selected yet';
            document.getElementById('dsSubtitle').textContent = 'Upload a file or enter one word to start';
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
    btnTest.textContent = 'Testing...';

    var words = val.split(/\s+/);
    var direction = document.getElementById('selDirection').value;
    var algorithm = document.getElementById('selAlgorithm').value;
    var model = selectedModelName;
    var modelLabel = getSelectedModelLabel();
    var dirElKata = document.getElementById('selDirection');
    var dirLabel =
        dirElKata && dirElKata.options && dirElKata.options.length
            ? dirElKata.options[dirElKata.selectedIndex].text
            : direction;
    var kamus = direction === 'm2i' ? kamusM2I : kamusI2M; // fallback jika backend gagal

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
                var translated = '[not found]';
                var predictedLabel = 'prediction unavailable';
                var confidenceLabel = '-';

                // Buat item dulu agar UI responsif, lalu update setelah backend selesai.
                var item = document.createElement('div');
                item.className = 'kata-result-item';
                item.innerHTML =
                    '<span class="kata-result-num">' + (index + 1) + '</span>' +
                    '<div class="kata-result-content">' +
                    '<div class="kata-result-word">' + word + '</div>' +
                    '<div class="kata-result-arrow">↓</div>' +
                    '<div class="kata-result-translated">' +
                    '<div>Translation: ...</div>' +
                    '<div>Word class: ...</div>' +
                    '<div>Confidence: ...</div>' +
                    '</div>' +
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
                        if (!translated) translated = '[not found]';
                    } else {
                        translated = '[not found]';
                    }
                } catch (e) {
                    // Fallback: kalau backend gagal, gunakan kamus lokal.
                    if (kamus[lowerWord]) {
                        translated = kamus[lowerWord];
                    } else {
                        translated = '[not found]';
                    }
                }

                try {
                    var predictionData = await predictWordWithSelectedModel(lowerWord);
                    predictedLabel = predictionData.label || 'prediction unavailable';
                    confidenceLabel = (Number(predictionData.score || 0) * 100).toFixed(0) + '%';
                } catch (e2) {
                    predictedLabel = 'prediction unavailable';
                    confidenceLabel = '-';
                }

                var wordEnd = performance.now();
                var wordTime = ((wordEnd - wordStart) / 1000).toFixed(2);

                item.querySelector('.kata-result-translated').innerHTML =
                    '<div>Translation: ' + translated + '</div>' +
                    '<div>Word class: ' + predictedLabel + '</div>' +
                    '<div>Confidence: ' + confidenceLabel + '</div>';
                item.querySelector('.kata-result-time').textContent = wordTime + 's';

                finishedCount++;

                if (finishedCount === words.length) {
                    var totalEnd = performance.now();
                    var totalTime = ((totalEnd - totalStartTime) / 1000).toFixed(2);

                    document.getElementById('kataResultDivider').style.display = 'block';
                    document.getElementById('kataResultSummary').style.display = 'flex';
                    document.getElementById('krModel').textContent = modelLabel;
                    document.getElementById('krDir').textContent = dirLabel;
                    document.getElementById('krTime').textContent = totalTime + ' seconds';

                    btnTest.disabled = false;
                    btnTest.textContent = 'Test Word';
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
    clearTestingFetchProgressTimer();
    metricIds.forEach(function(id) {
        document.getElementById(id).textContent = id === 'mcc' ? '0.00' : '0%';
        document.getElementById(id).classList.remove('revealed');
    });
    metricHeaderIds.forEach(function(id) {
        document.getElementById(id).classList.remove('revealed');
    });
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressBar').classList.remove('running');
    document.getElementById('progressText').textContent = 'Waiting...';
    document.getElementById('progressElapsed').textContent = 'Elapsed time: 00:00';
    document.getElementById('progressSummary').classList.remove('show');
    resetProgressSteps();
}

function resetProgressSteps() {
    for (var i = 0; i < progressStepOrder.length; i++) {
        var id = progressStepOrder[i];
        var node = document.getElementById('step-' + id);
        if (!node) continue;
        node.classList.remove('active');
        node.classList.remove('done');
    }
}

function setProgressStep(stepId, percent, message) {
    var bar = document.getElementById('progressBar');
    var text = document.getElementById('progressText');
    if (bar) {
        bar.style.width = percent + '%';
    }
    if (text && message) {
        text.textContent = percent + '% — ' + message;
    }

    for (var i = 0; i < progressStepOrder.length; i++) {
        var id = progressStepOrder[i];
        var node = document.getElementById('step-' + id);
        if (!node) continue;

        if (id === stepId) {
            node.classList.add('active');
            node.classList.remove('done');
        } else if (progressStepOrder.indexOf(id) < progressStepOrder.indexOf(stepId)) {
            node.classList.remove('active');
            node.classList.add('done');
        } else {
            node.classList.remove('active');
            node.classList.remove('done');
        }
    }
}

function startProgressElapsedTimer() {
    stopProgressElapsedTimer();
    progressStartedAt = Date.now();
    progressTimer = setInterval(function() {
        var elapsedEl = document.getElementById('progressElapsed');
        if (!elapsedEl || !progressStartedAt) return;
        var diffSec = Math.floor((Date.now() - progressStartedAt) / 1000);
        var mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
        var ss = String(diffSec % 60).padStart(2, '0');
        elapsedEl.textContent = 'Elapsed time: ' + mm + ':' + ss;
    }, 1000);
}

function stopProgressElapsedTimer() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
}

/* =============================
   ANIMASI COUNTER
============================= */
function animateValue(el, target, duration, options) {
    options = options || {};
    var decimals = Number.isFinite(options.decimals) ? options.decimals : 0;
    var suffix = options.suffix || '';
    var start = 0;
    var startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = start + (target - start) * eased;
        el.textContent = value.toFixed(decimals) + suffix;
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
            showTestingError('Please enter a word first.');
            return;
        }
        if (!kataValid) {
            showTestingError('Please enter one word only (no spaces).');
            return;
        }
    }

    if (!selectedModelId || !selectedModelName) {
        showTestingError('No model selected. Choose an algorithm with a saved final-training model first.');
        return;
    }

    if (!selectedDatasetId || isNaN(selectedDatasetId)) {
        showTestingError('Dataset was not found for the selected model. Make sure dataset_id in the models table is filled.');
        return;
    }

    var model = selectedModelName;
    var direction = document.getElementById('selDirection').value;
    var modelLabel = getSelectedModelLabel();
    var dirEl = document.getElementById('selDirection');
    var dirLabel =
        dirEl && dirEl.options && dirEl.options.length
            ? dirEl.options[dirEl.selectedIndex].text
            : direction;

    isRunning = true;
    runCount++;
    setTestingUiBusy(true);
    showTestingError('');

    metricIds.forEach(function(id, i) {
        var metricEl = document.getElementById(id);
        var headerEl = document.getElementById(metricHeaderIds[i]);
        if (metricEl) {
            metricEl.textContent = id === 'mcc' ? '0.00' : '0%';
            metricEl.classList.remove('revealed');
        }
        if (headerEl) headerEl.classList.remove('revealed');
    });

    var bar = document.getElementById('progressBar');
    if (bar) {
        bar.style.width = '0%';
        bar.classList.add('running');
    }
    setStatus('pending');
    document.getElementById('runBadge').textContent = '#' + runCount;
    document.getElementById('progressSummary').classList.add('show');

    if (currentMode === 'upload') {
        document.getElementById('sumDataset').textContent = selectedDatasetName || ('Dataset ID ' + selectedDatasetId);
        document.getElementById('sumKata').textContent = '—';
    } else {
        document.getElementById('sumDataset').textContent = 'Word Input';
        document.getElementById('sumKata').textContent = kataVal;
    }
    document.getElementById('sumModel').textContent = modelLabel;
    document.getElementById('sumDir').textContent = dirLabel;

    startProgressElapsedTimer();
    setProgressStep('prepare', 8, 'Validating testing configuration...');

    try {
        await refreshSelectedModelLatestTestingFromBackend();
    } catch (refreshErr) {
        console.warn('testing: refresh models skipped', refreshErr);
    }

    if (selectedLatestTesting) {
        var proceed = window.confirm(
            'This model already has a saved testing result. If you run testing again, the previous result will be replaced by the new one. Continue?'
        );
        if (!proceed) {
            resetTestingRunUi();
            return;
        }
    }

    setProgressStep('prepare', 12, 'Sending request to backend...');

    var backendResult = null;
    try {
        var selectedAlgo = normalizeTestingAlgo(document.getElementById('selAlgorithm').value);
        if (!selectedAlgo) selectedAlgo = 'indobert';

        if (selectedAlgo === 'indobert') {
            setProgressStep('prepare', 12, 'Preparing exact holdout testing set from selected model...');
        } else {
            setProgressStep(
                'prepare',
                12,
                'Preparing test subset for ' +
                    getAlgorithmDisplayName(selectedAlgo) +
                    ' (holdout if available, otherwise split ratio ' +
                    (selectedModelSplitRatio || '80:20') +
                    ')...'
            );
        }

        // mBERT / XLM-R: backend memilih holdout atau split_ratio; IndoBERT tetap holdout wajib.
        clearTestingFetchProgressTimer();
        var evalBarPct = 40;
        setProgressStep('connect', evalBarPct, 'Running model evaluation (batch inference)...');
        testingFetchProgressTimer = setInterval(function() {
            if (!isRunning) {
                clearTestingFetchProgressTimer();
                return;
            }
            evalBarPct = Math.min(88, evalBarPct + Math.max(0.5, (88 - evalBarPct) * 0.08));
            setProgressStep('connect', Math.round(evalBarPct), 'Running model evaluation (batch inference)...');
        }, 480);

        var testingUrl = API_BASE + '/testing/' + encodeURIComponent(selectedAlgo);
        var res = await fetchWithTimeout(
            testingUrl,
            {
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
            },
            600000
        );
        var data = await res.json();
        clearTestingFetchProgressTimer();
        if (!res.ok) {
            throw new Error(data && (data.detail || data.message) ? (data.detail || data.message) : 'Backend testing failed.');
        }
        backendResult = data;
        setProgressStep('process', 91, 'Backend finished processing model testing.');
    } catch (err) {
        var errMsg =
            err && err.name === 'AbortError'
                ? 'Testing request timed out. Make sure the backend (uvicorn) is running at ' + API_BASE
                : err && err.message
                  ? err.message
                  : 'Failed to run backend testing.';
        document.getElementById('progressText').textContent = 'Failed to run testing';
        showTestingError(errMsg);
        resetTestingRunUi();
        return;
    } finally {
        clearTestingFetchProgressTimer();
    }
    setProgressStep('metrics', 96, 'Preparing metrics for display...');
    bar.classList.remove('running');
    setStatus('tested');
    finishTesting(backendResult, direction);
}

function finishTesting(result, direction) {
    var r = mapFreshTestingResult(result);
    if (!r) return;

    metricIds.forEach(function(id, i) {
        setTimeout(function() {
            document.getElementById(metricHeaderIds[i]).classList.add('revealed');
            document.getElementById(id).classList.add('revealed');
            var v = r[id];
            if (v == null || !Number.isFinite(v)) return;
            if (id === 'mcc') {
                animateValue(document.getElementById(id), v, 800, { decimals: 2, suffix: '' });
            } else {
                animateValue(document.getElementById(id), Math.round(v), 800, { decimals: 0, suffix: '%' });
            }
        }, i * 100);
    });

    setProgressStep('finish', 100, 'Testing completed.');
    stopProgressElapsedTimer();
    selectedLatestTesting = {
        accuracy: normalizePercent(result.accuracy),
        precision_macro: normalizePercent(result.precision_macro),
        recall_macro: normalizePercent(result.recall_macro),
        f1_macro: normalizePercent(result.f1_macro),
        std_deviation: normalizePercent(result.std_deviation),
        weighted_avg: normalizePercent(result.weighted_avg),
        roc_auc: normalizePercent(result.roc_auc),
        mcc: normalizeMcc(result.mcc),
        created_at: new Date().toISOString()
    };
    var testedRows = Number(result.total_data || 0);
    var testedRowsText = Number.isFinite(testedRows) && testedRows > 0
        ? ' Total tested data: ' + testedRows + ' rows.'
        : '';
    var overfittingText = '';
    if (Number.isFinite(selectedModelTrainingAccuracy)) {
        var trainAccPct = normalizeAccuracyToFraction(selectedModelTrainingAccuracy) * 100;
        var testAccPct = normalizePercent(result.accuracy) || 0;
        var trainMinusTest = trainAccPct - testAccPct;
        if (trainMinusTest > 3) {
            overfittingText =
                ' [OVERFITTING] Gap accuracy training vs testing is ' +
                trainMinusTest.toFixed(2) + '% (> 3%).';
        }
    }
    var subsetNote = '';
    if (result.test_subset === 'split_ratio') {
        subsetNote = ' Test subset: split ratio ' + (selectedModelSplitRatio || '80:20') + ' (no holdout file).';
    } else if (result.test_subset === 'holdout') {
        subsetNote = ' Test subset: training holdout rows.';
    }
    showTestingInfo(
        'Testing result saved successfully.' +
            testedRowsText +
            subsetNote +
            overfittingText +
            ' If you run testing again, the previous result will be replaced by the new one.'
    );
    setTestingUiBusy(false);
    isRunning = false;
}

/* =============================
   INIT
============================= */
initUpload();
initKataInput();
initAlgorithmModelSelect();
updateStartButtonState();