const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let models = [];
let selectedDataset = null;
let selectedModel = null;

var metricIds = ['acc', 'prec', 'f1', 'macro', 'rec', 'std', 'weighted', 'roc', 'mcc'];
var metricBoxIds = ['mAcc', 'mPrec', 'mF1', 'mMacro', 'mRec', 'mStd', 'mWeighted', 'mRoc', 'mMcc'];

var runCount = 0;
var isRunning = false;
var isPredicting = false;

function formatNumber(v) {
    return Number(v || 0).toLocaleString("id-ID");
}

function renderDatasetDetail(ds) {
    if (!ds) return;
    document.getElementById("dsTitle").textContent = ds.name || ds.file_name || `dataset_${ds.id}`;
    document.getElementById("dsSubtitle").textContent = `Dataset ID: ${ds.id}`;
    document.getElementById("dsFile").textContent = ds.file_name || "-";
    document.getElementById("dsTotal").textContent = `${formatNumber(ds.total_data)} data`;
    document.getElementById("katVerb").textContent = formatNumber(ds.kata_kerja);
    document.getElementById("katNoun").textContent = formatNumber(ds.kata_benda);
    document.getElementById("katAdj").textContent = formatNumber(ds.kata_sifat);
    document.getElementById("katAdv").textContent = formatNumber(ds.kata_keterangan);
    document.getElementById("dsImporter").textContent = ds.uploaded_by || "-";
    const date = ds.created_at ? ds.created_at.split("T")[0] : "-";
    document.getElementById("dsDate").textContent = date;
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

async function loadDatasets() {
    const selDataset = document.getElementById("selDataset");
    selDataset.innerHTML = '<option value="">Memuat dataset...</option>';
    const { data, error } = await supabaseClient
        .from("datasets")
        .select(
            "id,name,file_name,total_data,kata_kerja,kata_benda,kata_sifat,kata_keterangan,uploaded_by,created_at,is_preprocessed",
        )
        .eq("is_preprocessed", true)
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        selDataset.innerHTML = '<option value="">Gagal memuat dataset</option>';
        return;
    }

    datasets = data || [];
    if (!datasets.length) {
        selDataset.innerHTML = '<option value="">Belum ada dataset yang sudah dipreprocessing</option>';
        selectedDataset = null;
        return;
    }

    selDataset.innerHTML = datasets
        .map(
            (ds) =>
                `<option value="${ds.id}">${ds.name || ds.file_name || `dataset_${ds.id}`}</option>`,
        )
        .join("");
    selectedDataset = datasets[0];
    renderDatasetDetail(selectedDataset);
}

async function loadModels() {
    const selModel = document.getElementById("selModel");
    selModel.innerHTML = '<option value="">Memuat model...</option>';
    const { data, error } = await supabaseClient
        .from("models")
        .select("id,nama_model,algoritma,dataset_id,accuracy,precision,recall,f1_score,created_at,max_length")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        selModel.innerHTML = '<option value="">Gagal memuat model</option>';
        return;
    }

    models = data || [];
    if (!models.length) {
        selModel.innerHTML = '<option value="">Belum ada model yang tersedia</option>';
        selectedModel = null;
        return;
    }

    selModel.innerHTML = models
        .map((m) => `<option value="${m.id}">${m.nama_model}</option>`)
        .join("");
    selectedModel = models[0];
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
   PREDIKSI SATU INPUT
============================= */
async function predictLabel() {
    if (isPredicting || isRunning) return;

    var input = document.getElementById("inputKalimat").value.trim();
    if (!input) {
        alert("Masukkan kata atau kalimat terlebih dahulu.");
        return;
    }
    if (!selectedModel) {
        alert("Pilih model terlebih dahulu.");
        return;
    }

    isPredicting = true;
    var btn = document.getElementById("btnPredict");
    btn.disabled = true;
    btn.textContent = "Memproses...";

    var resultBox = document.getElementById("translateResult");
    document.getElementById("resultInput").textContent = input;
    document.getElementById("resultLabel").textContent = "...";
    document.getElementById("resultModel").textContent = selectedModel.nama_model || "-";
    document.getElementById("resultConfidence").textContent = "...";
    document.getElementById("resultProbs").innerHTML = "...";
    resultBox.classList.add("show");

    try {
        const payload = {
            text: input,
            model_name: selectedModel.nama_model,
            max_length: selectedModel.max_length || 64,
        };
        const res = await fetch("http://127.0.0.1:8000/processing/predict/indobert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.detail || "Prediksi gagal");
        }

        const label = data?.label || "-";
        const scorePct = Math.round((Number(data?.score || 0)) * 100);
        document.getElementById("resultLabel").textContent = label;
        document.getElementById("resultConfidence").textContent = `${scorePct}%`;

        const probs = data?.probs || {};
        const probsEntries = Object.entries(probs).sort((a, b) => Number(b[1]) - Number(a[1]));
        const probsHtml = probsEntries.length
            ? probsEntries
                  .map(([k, v]) => `<div class="prob-item">- ${k}: ${Math.round(Number(v) * 100)}%</div>`)
                  .join("")
            : "<div class='prob-item'>- Tidak ada probabilitas</div>";
        document.getElementById("resultProbs").innerHTML = probsHtml;
    } catch (e) {
        console.error(e);
        alert("Prediksi gagal. Pastikan backend berjalan dan model tersedia.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Prediksi";
        isPredicting = false;
    }
}

/* =============================
   START TESTING
============================= */
async function startTesting() {
    if (isRunning) return;
    if (!selectedDataset) {
        alert("Belum ada dataset yang sudah dipreprocessing");
        return;
    }
    if (!selectedModel) {
        alert("Belum ada model yang tersedia");
        return;
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
    var dataset = document.getElementById('selDataset').value;
    var modelLabel = document.getElementById('selModel').options[document.getElementById('selModel').selectedIndex].text;
    var dirLabel = document.getElementById('selDirection').options[document.getElementById('selDirection').selectedIndex].text;

    document.getElementById('sumDataset').textContent = selectedDataset.name || selectedDataset.file_name || dataset;
    document.getElementById('sumModel').textContent = modelLabel;
    document.getElementById('sumDir').textContent = dirLabel;
    document.getElementById('progressSummary').classList.add('show');

    var bar = document.getElementById('progressBar');
    var text = document.getElementById('progressText');
    bar.style.width = "15%";
    text.textContent = "15% — Mengirim request testing...";

    try {
        const payload = {
            dataset_id: selectedDataset.id,
            model_id: selectedModel.id,
            model_name: selectedModel.nama_model,
            max_length: selectedModel.max_length || 64,
            save_result: true,
        };
        const res = await fetch("http://127.0.0.1:8000/testing/indobert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.detail || "Testing gagal");
        }

        bar.style.width = "100%";
        if (data.testing_result_id) {
            text.textContent = `100% — Testing selesai. Hasil testing tersimpan. ID: #${data.testing_result_id}`;
        } else {
            text.textContent = "100% — Testing selesai";
        }
        setStatus("tested");

        const acc = Math.round((Number(data.accuracy || 0)) * 100);
        const prec = Math.round((Number(data.precision_macro || 0)) * 100);
        const rec = Math.round((Number(data.recall_macro || 0)) * 100);
        const f1 = Math.round((Number(data.f1_macro || 0)) * 100);
        const macro = Math.round((prec + rec + f1) / 3);

        const display = {
            acc: acc,
            prec: prec,
            f1: f1,
            macro: macro,
            rec: rec,
            std: 0,
            weighted: 0,
            roc: 0,
            mcc: 0,
        };

        metricIds.forEach(function(id, i) {
            setTimeout(function() {
                document.getElementById(metricBoxIds[i]).classList.add('revealed');
                animateValue(document.getElementById(id), display[id], 500);
            }, i * 70);
        });
    } catch (e) {
        bar.style.width = "0%";
        text.textContent = "Error saat testing";
        setStatus("idle");
        alert(e.message || String(e));
    } finally {
        var btn2 = document.getElementById('btnStart');
        btn2.disabled = false;
        isRunning = false;
    }
}

/* =============================
   INIT
============================= */
document.getElementById("selDataset").addEventListener("change", function (e) {
    const id = Number(e.target.value);
    selectedDataset = datasets.find((d) => Number(d.id) === id) || null;
    if (selectedDataset) renderDatasetDetail(selectedDataset);
});

document.getElementById("selModel").addEventListener("change", function (e) {
    const id = Number(e.target.value);
    selectedModel = models.find((m) => Number(m.id) === id) || null;
});

Promise.all([loadDatasets(), loadModels()]).catch((e) => {
    console.error(e);
    alert("Gagal memuat data testing");
});