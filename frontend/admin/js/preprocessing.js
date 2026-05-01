const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let selectedDataset = null;
let isProcessing = false;
let preprocessJobId = null;
let cancelRequested = false;
let activePreprocessAlgorithm = "mbert";

function normalizeAlgorithmForPreprocess(raw) {
    const value = String(raw || "").toLowerCase().trim();
    if (value === "indobert" || value === "indo-bert") return "indobert";
    return "mbert";
}

function resolvePreprocessAlgorithm() {
    const saved = localStorage.getItem("selectedAlgorithm");
    activePreprocessAlgorithm = normalizeAlgorithmForPreprocess(saved);
    return activePreprocessAlgorithm;
}

function openDatasetModal() {
    const modal = document.getElementById("datasetCard");
    if (modal) modal.style.display = "flex";
}

function closeDatasetModal() {
    const modal = document.getElementById("datasetCard");
    if (!modal || isProcessing) return;
    modal.style.display = "none";
}

// ==============================
// CLEAN PIPELINE
// ==============================
function cleanText(text) {
    if (!text) return "";

    text = text.toLowerCase();

    // remove symbol & angka
    text = text.replace(/[^a-zA-Z\s]/g, "");

    // remove double char (cooool → cool)
    text = text.replace(/(.)\1{2,}/g, "$1$1");

    // remove extra space
    text = text.replace(/\s+/g, " ").trim();

    return text;
}

// ==============================
// LOAD DATASET
// ==============================
async function loadDatasets() {
    const { data, error } = await supabaseClient
        .from("datasets")
        .select("*")
        .order("id", { ascending: false });

    if (error) return console.error(error);

    datasets = data;
    renderTable();
}

// ==============================
// RENDER TABLE
// ==============================
function renderTable() {
    const body = document.getElementById("tableBody");
    body.innerHTML = "";

    if (!datasets || datasets.length === 0) {
        body.innerHTML = `<tr><td colspan="7">No dataset available</td></tr>`;
        return;
    }

    const selectedId = selectedDataset?.id;

    datasets.forEach(ds => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="col-name">${ds.name || "-"}</td>
            <td>${ds.total_data ?? 0}</td>
            <td>${ds.kata_kerja ?? 0}</td>
            <td>${ds.kata_benda ?? 0}</td>
            <td>${ds.kata_sifat ?? 0}</td>
            <td>${ds.kata_keterangan ?? 0}</td>
            <td>
                <span class="status ${ds.is_preprocessed ? 'done' : 'pending'}">
                    ${ds.is_preprocessed ? 'Completed' : 'Not Yet'}
                </span>
            </td>
        `;

        tr.addEventListener("click", () => {
            document.querySelectorAll("#tableBody tr").forEach(r => r.classList.remove("selected"));
            tr.classList.add("selected");
            selectDataset(ds);
        });

        if (selectedId && ds.id === selectedId) {
            tr.classList.add("selected");
        }

        body.appendChild(tr);
    });
}

// ==============================
// SELECT DATASET
// ==============================
function selectDataset(ds) {
    selectedDataset = ds;
    resolvePreprocessAlgorithm();

    document.getElementById("processBtn").disabled = ds.is_preprocessed;
    document.getElementById("cancelProcessBtn").style.display = "none";
    document.getElementById("cancelProcessBtn").disabled = true;
    const continueBtn = document.getElementById("continueBtn");
    continueBtn.style.display = ds.is_preprocessed ? "block" : "none";

    openDatasetModal();

    document.getElementById("fileName").innerText = ds.file_name || "-";
    document.getElementById("datasetName").innerText = ds.name;
    document.getElementById("total").innerText = ds.total_data;
    document.getElementById("kerja").innerText = ds.kata_kerja;
    document.getElementById("benda").innerText = ds.kata_benda;
    document.getElementById("sifat").innerText = ds.kata_sifat;
    document.getElementById("keterangan").innerText = ds.kata_keterangan;
    document.getElementById("uploader").innerText = ds.uploaded_by || "-";
    document.getElementById("date").innerText = ds.created_at?.split("T")[0] || "-";
    const algoLabel = activePreprocessAlgorithm === "indobert" ? "IndoBERT" : "mBERT";
    updateProgressUI(0, `Ready to process (${algoLabel})`);
}

function goToProcessing() {
    if (selectedDataset?.id) {
        localStorage.setItem("processing_selected_dataset_id", String(selectedDataset.id));
        localStorage.setItem("processing_selected_dataset_name", selectedDataset.name || "");
    }
    window.location.href = "processing.html";
}

// ==============================
// FETCH RAW DATA
// ==============================
async function fetchAllRawData(datasetId) {
    let allData = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabaseClient
            .from("raw_data")
            .select("*")
            .eq("dataset_id", datasetId)
            .range(from, from + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        from += limit;
    }

    return allData;
}

// ==============================
// START PREPROCESSING
// ==============================
document.getElementById("processBtn").addEventListener("click", startPreprocessing);
document.getElementById("cancelProcessBtn").addEventListener("click", cancelPreprocessing);
document.getElementById("continueBtn").addEventListener("click", goToProcessing);
document.getElementById("closeDatasetModal").addEventListener("click", closeDatasetModal);

document.getElementById("datasetCard").addEventListener("click", function(e) {
    if (e.target.id === "datasetCard") closeDatasetModal();
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeDatasetModal();
});

function updateProgressUI(percent, text) {
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.innerText = text;
}

async function pollPreprocessStatus(jobId) {
    while (true) {
        const res = await fetch(`http://127.0.0.1:8000/preprocess/status/${jobId}`);
        const status = await res.json();
        if (!res.ok) {
            throw new Error(status?.message || "Failed to read preprocessing status");
        }

        const percent = 35 + Math.round((status.percent || 0) * 0.65);
        const deviceLabel = status.device ? ` | Device: ${status.device.toUpperCase()}` : "";
        const hasTotal = Number(status.total || 0) > 0;
        updateProgressUI(
            percent,
            hasTotal
                ? `Tokenizing ${status.processed || 0}/${status.total || 0}${deviceLabel}`
                : `Preparing tokenizer...${deviceLabel}`,
        );

        if (status.status === "done") return status;
        if (status.status === "cancelled") {
            throw new Error("Preprocessing was cancelled");
        }
        if (status.status === "error") {
            throw new Error(status.error || "Backend tokenizer failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
    }
}

async function cancelPreprocessing() {
    if (!isProcessing) return;
    cancelRequested = true;
    const cancelBtn = document.getElementById("cancelProcessBtn");
    cancelBtn.disabled = true;
    cancelBtn.innerText = "Cancelling...";

    if (preprocessJobId) {
        try {
            await fetch(`http://127.0.0.1:8000/preprocess/cancel/${preprocessJobId}`, {
                method: "POST",
            });
        } catch (e) {
            console.error("Cancel request error:", e);
        }
    }
}

async function startPreprocessing() {
    if (!selectedDataset) return;
    if (isProcessing) return;

    isProcessing = true;

    const btn = document.getElementById("processBtn");
    const cancelBtn = document.getElementById("cancelProcessBtn");
    const table = document.getElementById("datasetTable");
    const progressContainer = document.getElementById("progressContainer");

    try {
        cancelRequested = false;
        preprocessJobId = null;
        btn.disabled = true;
        btn.innerText = "Processing...";
        cancelBtn.style.display = "inline-block";
        cancelBtn.disabled = false;
        cancelBtn.innerText = "Cancel Preprocessing";
        table.style.pointerEvents = "none";
        table.style.opacity = "0.6";

        progressContainer.style.display = "block";
        updateProgressUI(5, "Cleaning data...");

        const allData = await fetchAllRawData(selectedDataset.id);

        if (!allData || allData.length === 0) {
            throw new Error("Raw data is empty");
        }

        const chunkSize = 100;

        for (let i = 0; i < allData.length; i += chunkSize) {
            if (cancelRequested) {
                throw new Error("Preprocessing was cancelled");
            }
            const chunk = allData.slice(i, i + chunkSize);

            const processed = chunk.map(row => ({
                dataset_id: row.dataset_id,
                id_kata: row.id_kata,
                jenis: row.jenis,

                manado: row.manado,
                indonesia: row.indonesia,
                kalimat_manado: row.kalimat_manado,
                kalimat_indonesia: row.kalimat_indonesia,

                manado_clean: cleanText(row.manado),
                indonesia_clean: cleanText(row.indonesia),

                kalimat_manado_clean: cleanText(row.kalimat_manado),
                kalimat_indonesia_clean: cleanText(row.kalimat_indonesia)
            }));

            const { error } = await supabaseClient
                .from("preprocessed_data")
                .upsert(processed, {
                    onConflict: "dataset_id,id_kata",
                    ignoreDuplicates: false,
                });

            if (error) throw error;
            const inserted = Math.min(allData.length, i + chunk.length);
            const insertPercent = Math.round((inserted / allData.length) * 35);
            updateProgressUI(
                insertPercent,
                `Seeding preprocessed_data ${inserted}/${allData.length}`,
            );
        }

        if (cancelRequested) {
            throw new Error("Preprocessing was cancelled");
        }

        const selectedAlgo = resolvePreprocessAlgorithm();
        const algoLabel = selectedAlgo === "indobert" ? "IndoBERT" : "mBERT";

        // Jalankan tokenizer backend secara async + polling progres real.
        const startRes = await fetch(
            `http://127.0.0.1:8000/preprocess/start/${selectedDataset.id}?tokenizer=${selectedAlgo}`,
            { method: "POST" },
        );
        const startData = await startRes.json();
        if (!startRes.ok || !startData?.job_id) {
            throw new Error(startData?.message || "Failed to start backend tokenizer");
        }

        preprocessJobId = startData.job_id;
        updateProgressUI(35, `Backend tokenizer started (${algoLabel})...`);
        const result = await pollPreprocessStatus(preprocessJobId);

        const finalDevice = (result.device || "cpu").toUpperCase();
        updateProgressUI(
            100,
            `Completed ${result.processed || 0}/${result.total || 0} | Device: ${finalDevice}`,
        );

        await supabaseClient
            .from("datasets")
            .update({ is_preprocessed: true })
            .eq("id", selectedDataset.id);

        document.getElementById("continueBtn").style.display = "block";

        alert(`Preprocessing + tokenization completed (${algoLabel})`);

        await loadDatasets();

        // Pastikan card/detail tetap sinkron dengan data terbaru (status is_preprocessed).
        if (selectedDataset?.id) {
            const refreshed = datasets.find(d => d.id === selectedDataset.id);
            if (refreshed) selectDataset(refreshed);
        }

    } catch (err) {
        console.error(err);
        if (cancelRequested) {
            updateProgressUI(0, "Preprocessing was cancelled");
        } else {
            updateProgressUI(0, `Error: ${err.message}`);
        }
        alert(err.message);
    } finally {
        isProcessing = false;
        preprocessJobId = null;
        btn.disabled = false;
        btn.innerText = "Start Preprocessing";
        cancelBtn.style.display = "none";
        cancelBtn.disabled = true;
        cancelBtn.innerText = "Cancel Preprocessing";
        table.style.pointerEvents = "auto";
        table.style.opacity = "1";
    }
}

// ==============================
// STOPWORD & SLANG MANAGEMENT
// ==============================
let activeLexiconView = "stopword-manado";
let activeStopwordLanguage = "manado";

function wireLexiconControls() {
    const openBtn = document.getElementById("openLexiconModalBtn");
    const closeBtn = document.getElementById("closeLexiconModalBtn");
    const modal = document.getElementById("lexiconModal");
    const showStopwordManadoBtn = document.getElementById("showStopwordManadoBtn");
    const showStopwordIndonesiaBtn = document.getElementById("showStopwordIndonesiaBtn");
    const showSlangBtn = document.getElementById("showSlangBtn");
    const refreshBtn = document.getElementById("lexiconRefreshBtn");
    const addStopwordBtn = document.getElementById("addStopwordBtn");
    const addSlangBtn = document.getElementById("addSlangBtn");

    if (openBtn && modal) {
        openBtn.addEventListener("click", () => {
            modal.style.display = "flex";
            switchLexiconView(activeLexiconView);
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.style.display = "none";
        });
    }

    if (showStopwordManadoBtn) {
        showStopwordManadoBtn.addEventListener("click", () => switchLexiconView("stopword-manado"));
    }
    if (showStopwordIndonesiaBtn) {
        showStopwordIndonesiaBtn.addEventListener("click", () => switchLexiconView("stopword-indonesia"));
    }
    if (showSlangBtn) {
        showSlangBtn.addEventListener("click", () => switchLexiconView("slang"));
    }

    if (refreshBtn) refreshBtn.addEventListener("click", loadLexiconData);
    if (addStopwordBtn) addStopwordBtn.addEventListener("click", addStopword);
    if (addSlangBtn) addSlangBtn.addEventListener("click", addSlangWord);
}

function switchLexiconView(view) {
    activeLexiconView = view;
    if (view === "stopword-indonesia") activeStopwordLanguage = "indonesia";
    if (view === "stopword-manado") activeStopwordLanguage = "manado";

    const stopwordView = document.getElementById("stopwordView");
    const slangView = document.getElementById("slangView");
    const stopwordTitle = document.getElementById("stopwordTitle");
    const manadoBtn = document.getElementById("showStopwordManadoBtn");
    const indoBtn = document.getElementById("showStopwordIndonesiaBtn");
    const slangBtn = document.getElementById("showSlangBtn");

    if (stopwordView) stopwordView.style.display = view === "slang" ? "none" : "block";
    if (slangView) slangView.style.display = view === "slang" ? "block" : "none";
    if (stopwordTitle) {
        stopwordTitle.innerText =
            activeStopwordLanguage === "indonesia"
                ? "Stopwords (Indonesia)"
                : "Stopwords (Manado)";
    }

    [manadoBtn, indoBtn, slangBtn].forEach((btn) => btn && btn.classList.remove("active"));
    if (view === "stopword-manado" && manadoBtn) manadoBtn.classList.add("active");
    if (view === "stopword-indonesia" && indoBtn) indoBtn.classList.add("active");
    if (view === "slang" && slangBtn) slangBtn.classList.add("active");

    loadLexiconData();
}

function setLexiconStatus(message, isError = false) {
    const el = document.getElementById("lexiconStatus");
    if (!el) return;
    el.innerText = message || "";
    el.style.color = isError ? "#b00020" : "#666";
}

async function loadLexiconData() {
    try {
        if (activeLexiconView === "slang") {
            setLexiconStatus("Loading slang words...");
            const slangRes = await fetch("http://127.0.0.1:8000/preprocess/slang");
            const slangData = await slangRes.json();
            if (!slangRes.ok) throw new Error(slangData?.detail || "Failed loading slang words");
            renderSlangWords(slangData.items || []);
            setLexiconStatus("Slang words loaded.");
            return;
        }

        setLexiconStatus(`Loading stopwords (${activeStopwordLanguage})...`);
        const stopRes = await fetch(
            `http://127.0.0.1:8000/preprocess/stopwords?language=${encodeURIComponent(activeStopwordLanguage)}`,
        );
        const stopData = await stopRes.json();
        if (!stopRes.ok) throw new Error(stopData?.detail || "Failed loading stopwords");
        renderStopwords(stopData.items || []);
        setLexiconStatus(`Stopwords (${activeStopwordLanguage}) loaded.`);
    } catch (err) {
        console.error(err);
        setLexiconStatus(err.message || "Failed loading lexicon", true);
    }
}

function renderStopwords(items) {
    const tbody = document.getElementById("stopwordTableBody");
    if (!tbody) return;
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="2">No stopword data</td></tr>`;
        return;
    }
    tbody.innerHTML = items
        .map((it) => `
            <tr>
                <td>${it.word || "-"}</td>
                <td><button class="lex-btn-danger" data-word="${it.word || ""}">Delete</button></td>
            </tr>
        `)
        .join("");
    tbody.querySelectorAll("button[data-word]").forEach((btn) => {
        btn.addEventListener("click", () => deleteStopword(btn.dataset.word));
    });
}

function renderSlangWords(items) {
    const tbody = document.getElementById("slangTableBody");
    if (!tbody) return;
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="3">No slang data</td></tr>`;
        return;
    }
    tbody.innerHTML = items
        .map((it) => `
            <tr>
                <td>${it.slang || "-"}</td>
                <td>${it.formal || "-"}</td>
                <td><button class="lex-btn-danger" data-slang="${it.slang || ""}">Delete</button></td>
            </tr>
        `)
        .join("");
    tbody.querySelectorAll("button[data-slang]").forEach((btn) => {
        btn.addEventListener("click", () => deleteSlangWord(btn.dataset.slang));
    });
}

async function addStopword() {
    const input = document.getElementById("newStopwordInput");
    const word = (input?.value || "").trim().toLowerCase();
    if (!word) return;
    try {
        const res = await fetch("http://127.0.0.1:8000/preprocess/stopwords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word, language: activeStopwordLanguage }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed adding stopword");
        input.value = "";
        await loadLexiconData();
    } catch (err) {
        setLexiconStatus(err.message || "Failed adding stopword", true);
    }
}

async function deleteStopword(word) {
    if (!word) return;
    try {
        const res = await fetch(
            `http://127.0.0.1:8000/preprocess/stopwords/${encodeURIComponent(word)}?language=${encodeURIComponent(activeStopwordLanguage)}`,
            {
            method: "DELETE",
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed deleting stopword");
        await loadLexiconData();
    } catch (err) {
        setLexiconStatus(err.message || "Failed deleting stopword", true);
    }
}

async function addSlangWord() {
    const slangInput = document.getElementById("newSlangInput");
    const formalInput = document.getElementById("newFormalInput");
    const slang = (slangInput?.value || "").trim().toLowerCase();
    const formal = (formalInput?.value || "").trim().toLowerCase();
    if (!slang || !formal) return;
    try {
        const res = await fetch("http://127.0.0.1:8000/preprocess/slang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slang, formal }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed adding slang word");
        slangInput.value = "";
        formalInput.value = "";
        await loadLexiconData();
    } catch (err) {
        setLexiconStatus(err.message || "Failed adding slang word", true);
    }
}

async function deleteSlangWord(slang) {
    if (!slang) return;
    try {
        const res = await fetch(`http://127.0.0.1:8000/preprocess/slang/${encodeURIComponent(slang)}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed deleting slang word");
        await loadLexiconData();
    } catch (err) {
        setLexiconStatus(err.message || "Failed deleting slang word", true);
    }
}

// INIT
loadDatasets();
wireLexiconControls();