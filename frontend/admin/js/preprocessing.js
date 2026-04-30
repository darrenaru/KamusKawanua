const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let selectedDataset = null;
let isProcessing = false;
<<<<<<< HEAD
let allWords = [];
let currentPage = 1;
const perPage = 20;
=======
let preprocessJobId = null;
let cancelRequested = false;
let lexiconType = "stopword";
let lexiconItems = [];
let lexiconPage = 1;
const LEXICON_PAGE_SIZE = 18; // 3 kolom x 6 baris
let lexiconLoadedOnce = false;

function openDatasetModal() {
    const modal = document.getElementById("datasetCard");
    if (modal) modal.style.display = "flex";
}

function closeDatasetModal() {
    const modal = document.getElementById("datasetCard");
    if (!modal || isProcessing) return;
    modal.style.display = "none";
}

function getSelectedPreprocessTokenizer() {
    const selected = String(localStorage.getItem("selectedAlgorithm") || "").trim().toLowerCase();
    if (selected === "indobert" || selected === "mbert") {
        return selected;
    }
    return null;
}
>>>>>>> 5389e9f (Initial commit)

// ==============================
// CLEAN PIPELINE
// ==============================
function cleanText(text) {
    if (!text) return "";

    text = text.toLowerCase();
<<<<<<< HEAD
    text = text.replace(/[^a-zA-Z\s]/g, "");
    text = text.replace(/(.)\1{2,}/g, "$1$1");
=======

    // remove symbol & angka
    text = text.replace(/[^a-zA-Z\s]/g, "");

    // remove double char (cooool → cool)
    text = text.replace(/(.)\1{2,}/g, "$1$1");

    // remove extra space
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD

    // 🔥 FIX: AUTO SELECT DATASET
    if (datasets.length > 0) {
        selectDataset(datasets[0]);
    }
=======
>>>>>>> 5389e9f (Initial commit)
}

// ==============================
// RENDER TABLE
// ==============================
function renderTable() {
    const body = document.getElementById("tableBody");
<<<<<<< HEAD
    if (!body) return;

    body.innerHTML = "";

    if (!datasets || datasets.length === 0) {
        body.innerHTML = `<tr><td colspan="7">Tidak ada dataset</td></tr>`;
        return;
    }

=======
    body.innerHTML = "";

    if (!datasets || datasets.length === 0) {
        body.innerHTML = `<tr><td colspan="7">No dataset available</td></tr>`;
        return;
    }

    const selectedId = selectedDataset?.id;

>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
                    ${ds.is_preprocessed ? 'Selesai' : 'Belum'}
=======
                    ${ds.is_preprocessed ? 'Completed' : 'Not Yet'}
>>>>>>> 5389e9f (Initial commit)
                </span>
            </td>
        `;

        tr.addEventListener("click", () => {
            document.querySelectorAll("#tableBody tr").forEach(r => r.classList.remove("selected"));
            tr.classList.add("selected");
            selectDataset(ds);
        });

<<<<<<< HEAD
=======
        if (selectedId && ds.id === selectedId) {
            tr.classList.add("selected");
        }

>>>>>>> 5389e9f (Initial commit)
        body.appendChild(tr);
    });
}

<<<<<<< HEAD
=======
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getLexiconTable() {
    return lexiconType === "slang" ? "slang_words" : "stopwords";
}

function renderLexiconGrid() {
    const grid = document.getElementById("lexiconGrid");
    const totalInfo = document.getElementById("lexiconTotalInfo");
    const pageInfo = document.getElementById("lexiconPageInfo");
    const prevBtn = document.getElementById("lexiconPrevBtn");
    const nextBtn = document.getElementById("lexiconNextBtn");
    if (!grid || !totalInfo || !pageInfo || !prevBtn || !nextBtn) return;

    const totalItems = lexiconItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / LEXICON_PAGE_SIZE));
    if (lexiconPage > totalPages) lexiconPage = totalPages;

    const start = (lexiconPage - 1) * LEXICON_PAGE_SIZE;
    const pageItems = lexiconItems.slice(start, start + LEXICON_PAGE_SIZE);

    totalInfo.textContent = `Total words: ${totalItems}`;
    pageInfo.textContent = `Page ${lexiconPage} / ${totalPages}`;
    prevBtn.disabled = lexiconPage <= 1;
    nextBtn.disabled = lexiconPage >= totalPages;

    if (pageItems.length === 0) {
        grid.innerHTML = `<div class="lexicon-empty">Not Yet ada data ${escapeHtml(lexiconType)}.</div>`;
        return;
    }

    grid.innerHTML = pageItems
        .map((item) => {
            let text = "";
            if (lexiconType === "slang") {
                const slangText = escapeHtml(item.slang);
                const formalText = escapeHtml(item.formal || "-");
                text = `${slangText} -> ${formalText}`;
            } else {
                text = `${escapeHtml(item.word)}`;
            }
            return `
                <div class="lexicon-item">
                    <span class="lexicon-item-word" title="${text}">${text}</span>
                    <button class="lexicon-item-delete" data-id="${item.id}" type="button">Delete</button>
                </div>
            `;
        })
        .join("");
}

async function loadLexiconData() {
    const table = getLexiconTable();
    const fields = lexiconType === "slang" ? "id,slang,formal" : "id,word,language";
    const { data, error } = await supabaseClient
        .from(table)
        .select(fields)
        .order("id", { ascending: true });

    if (error) {
        console.error("Load lexicon error:", error);
        alert(error.message || "Failed to load lexicon data.");
        lexiconItems = [];
    } else {
        lexiconItems = data || [];
    }
    renderLexiconGrid();
}

async function addStopword() {
    const wordInput = document.getElementById("stopwordInput");
    const word = String(wordInput?.value || "").trim().toLowerCase();

    if (!word) {
        alert("Stopword cannot be empty.");
        return;
    }

    const { error } = await supabaseClient.from("stopwords").insert([{ word }]);
    if (error) {
        alert(error.message || "Failed to add stopword.");
        return;
    }

    wordInput.value = "";
    lexiconPage = 1;
    await loadLexiconData();
}

async function addSlang() {
    const slangInput = document.getElementById("slangInput");
    const formalInput = document.getElementById("formalInput");
    const slang = String(slangInput?.value || "").trim().toLowerCase();
    const formal = String(formalInput?.value || "").trim().toLowerCase();

    if (!slang) {
        alert("Slang word is required.");
        return;
    }

    if (!formal) {
        alert("Formal word is required.");
        return;
    }

    const { error } = await supabaseClient.from("slang_words").insert([{ slang, formal }]);
    if (error) {
        alert(error.message || "Failed to add slang.");
        return;
    }

    slangInput.value = "";
    formalInput.value = "";
    lexiconPage = 1;
    await loadLexiconData();
}

async function deleteLexiconItem(id) {
    const table = getLexiconTable();
    const { error } = await supabaseClient.from(table).delete().eq("id", id);
    if (error) {
        alert(error.message || "Failed to delete data.");
        return;
    }
    await loadLexiconData();
}

function syncLexiconControls() {
    const addStop = document.getElementById("lexiconAddStopword");
    const addSlang = document.getElementById("lexiconAddSlang");
    if (!addStop || !addSlang) return;
    addStop.style.display = lexiconType === "stopword" ? "grid" : "none";
    addSlang.style.display = lexiconType === "slang" ? "grid" : "none";
}

function setupLexiconManager() {
    const panel = document.getElementById("lexiconManagerSection");
    const toggleBtn = document.getElementById("toggleLexiconManagerBtn");
    const typeSelect = document.getElementById("lexiconType");
    const addStopwordBtn = document.getElementById("addStopwordBtn");
    const addSlangBtn = document.getElementById("addSlangBtn");
    const prevBtn = document.getElementById("lexiconPrevBtn");
    const nextBtn = document.getElementById("lexiconNextBtn");
    const grid = document.getElementById("lexiconGrid");

    if (!panel || !toggleBtn || !typeSelect || !addStopwordBtn || !addSlangBtn || !prevBtn || !nextBtn || !grid) return;

    toggleBtn.addEventListener("click", async () => {
        const isHidden = panel.style.display === "none";
        panel.style.display = isHidden ? "block" : "none";
        toggleBtn.textContent = isHidden
            ? "Close Stopword & Slang Management"
            : "Stopword & Slang Management";

        if (isHidden && !lexiconLoadedOnce) {
            await loadLexiconData();
            lexiconLoadedOnce = true;
        }
    });

    typeSelect.addEventListener("change", async (e) => {
        lexiconType = e.target.value === "slang" ? "slang" : "stopword";
        lexiconPage = 1;
        syncLexiconControls();
        await loadLexiconData();
    });

    addStopwordBtn.addEventListener("click", addStopword);
    addSlangBtn.addEventListener("click", addSlang);

    prevBtn.addEventListener("click", () => {
        if (lexiconPage > 1) {
            lexiconPage -= 1;
            renderLexiconGrid();
        }
    });

    nextBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(lexiconItems.length / LEXICON_PAGE_SIZE));
        if (lexiconPage < totalPages) {
            lexiconPage += 1;
            renderLexiconGrid();
        }
    });

    grid.addEventListener("click", async (e) => {
        const btn = e.target.closest(".lexicon-item-delete");
        if (!btn) return;
        const id = Number(btn.getAttribute("data-id"));
        if (!id) return;
        if (!confirm("Delete item ini?")) return;
        await deleteLexiconItem(id);
    });

    syncLexiconControls();
}

>>>>>>> 5389e9f (Initial commit)
// ==============================
// SELECT DATASET
// ==============================
function selectDataset(ds) {
    selectedDataset = ds;

<<<<<<< HEAD
    const btn = document.getElementById("processBtn");

    btn.disabled = ds.is_preprocessed;

    document.getElementById("datasetCard").style.display = "block";
=======
    document.getElementById("processBtn").disabled = ds.is_preprocessed;
    document.getElementById("cancelProcessBtn").style.display = "none";
    document.getElementById("cancelProcessBtn").disabled = true;
    const continueBtn = document.getElementById("continueBtn");
    continueBtn.style.display = ds.is_preprocessed ? "block" : "none";

    openDatasetModal();
>>>>>>> 5389e9f (Initial commit)

    document.getElementById("fileName").innerText = ds.file_name || "-";
    document.getElementById("datasetName").innerText = ds.name;
    document.getElementById("total").innerText = ds.total_data;
    document.getElementById("kerja").innerText = ds.kata_kerja;
    document.getElementById("benda").innerText = ds.kata_benda;
    document.getElementById("sifat").innerText = ds.kata_sifat;
    document.getElementById("keterangan").innerText = ds.kata_keterangan;
    document.getElementById("uploader").innerText = ds.uploaded_by || "-";
    document.getElementById("date").innerText = ds.created_at?.split("T")[0] || "-";
<<<<<<< HEAD
=======
    updateProgressUI(0, "Ready to process");
}

function goToProcessing() {
    if (selectedDataset?.id) {
        localStorage.setItem("processing_selected_dataset_id", String(selectedDataset.id));
        localStorage.setItem("processing_selected_dataset_name", selectedDataset.name || "");
    }
    window.location.href = "processing.html";
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
// MODAL CONTROL + EVENTS (SAFE)
// ==============================
document.addEventListener("DOMContentLoaded", () => {

    loadDatasets();

    const processBtn = document.getElementById("processBtn");
    if (processBtn) processBtn.addEventListener("click", startPreprocessing);

    const nextBtn = document.getElementById("nextPage");
if (nextBtn) nextBtn.addEventListener("click", () => {
    const effectivePerPage = perPage - (perPage % 3);
    const maxPage = Math.ceil(allWords.length / effectivePerPage);
    if (currentPage < maxPage) {
        currentPage++;
        renderWords();
    }
});

const prevBtn = document.getElementById("prevPage");
if (prevBtn) prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderWords();
    }
});

    const addBtn = document.getElementById("addWordBtn");
    if (addBtn) addBtn.addEventListener("click", addWord);

    const filterType = document.getElementById("filterType");
    if (filterType) {
        filterType.addEventListener("change", async () => {
            const value = filterType.value;
            if (!value) return;

            currentType = value;

            document.getElementById("modalTitle").innerText =
                value === "stopword"
                    ? "Manajemen Stopword"
                    : "Manajemen Slang";

            document.getElementById("wordInput").value = "";
            document.getElementById("wordModal").style.display = "flex";

            await loadWords();
        });
    }

    const closeModal = document.getElementById("closeModal");
    if (closeModal) {
        closeModal.onclick = () => document.getElementById("wordModal").style.display = "none";
    }

    window.onclick = (e) => {
        if (e.target.id === "wordModal") {
            document.getElementById("wordModal").style.display = "none";
        }
    };
});

// ==============================
// WORD LOGIC
// ==============================
let currentType = "";

async function loadWords() {
    const table = document.getElementById("wordTableBody");
    if (!table) return;

    // 🔥 RESET TOTAL
    allWords = [];
    table.innerHTML = "<tr><td colspan='2'>Loading...</td></tr>";

    const tableName = currentType === "stopword" ? "stopwords" : "slang_words";

    const { data, error } = await supabaseClient
        .from(tableName)
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        table.innerHTML = "<tr><td colspan='2'>Gagal load data</td></tr>";
        return;
    }

    // 🔥 FORCE CLEAN DATA
    allWords = Array.isArray(data) ? data : [];

    console.log("DATA DARI SUPABASE:", allWords); // DEBUG WAJIB

    currentPage = 1;

    renderWords();
}

function renderWords() {
    if (!Array.isArray(allWords)) {
    console.error("allWords bukan array:", allWords);
    allWords = [];
}
    const table = document.getElementById("wordTableBody");
    if (!table) return;

    if (!allWords.length) {
        table.innerHTML = "<tr><td colspan='2'>Belum ada data</td></tr>";
        document.getElementById("pageInfo").innerText = "0 / 0";
        return;
    }

    const start = (currentPage - 1) * perPage;
    // ambil data normal
    let pageData = allWords.slice(start, start + perPage);

    // =========================
    // PAKSA KELIPATAN 3
    // =========================
    const remainder = pageData.length % 3;

    if (remainder !== 0) {
        pageData = pageData.slice(0, pageData.length - remainder);
    }

    table.innerHTML = `
        <tr>
            <td colspan="2">
                <div class="word-grid" id="wordGrid"></div>
            </td>
        </tr>
    `;

    const grid = document.getElementById("wordGrid");

    pageData.forEach(item => {
        let content = "";

        if (currentType === "stopword") {
            content = item.word;
        } else {
            content = `${item.slang} → ${item.formal}`;
        }

        const card = document.createElement("div");
        card.className = "word-card";

        card.innerHTML = `
            <div class="word-text">${content}</div>
            <button onclick="deleteWord(${item.id})">Hapus</button>
        `;

        grid.appendChild(card);
    });

    // =========================
    // TOTAL PAGE CALCULATION
    // =========================
    // total efektif (kelipatan 3)
    const effectivePerPage = perPage - (perPage % 3);
    const totalPage = Math.ceil(allWords.length / effectivePerPage);

    document.getElementById("pageInfo").innerText =
        `${currentPage} / ${totalPage}`;
}

async function addWord() {
    const input = document.getElementById("wordInput");
    const value = input.value.trim();

    if (!value) return alert("Input kosong");

    let payload;

    if (currentType === "stopword") {
        payload = { word: value, language: "manado" };
    } else {
        // format: slang|formal
        const parts = value.split("|");

        if (parts.length !== 2) {
            return alert("Format slang: slang|formal");
        }

        payload = {
            slang: parts[0].trim(),
            formal: parts[1].trim()
        };
    }

    const tableName = currentType === "stopword" ? "stopwords" : "slang_words";

    const { error } = await supabaseClient
        .from(tableName)
        .insert([payload]);

    if (error) return alert("Gagal tambah");

    input.value = "";
    loadWords();
}

async function deleteWord(id) {
    const tableName = currentType === "stopword" ? "stopwords" : "slang_words";

    await supabaseClient
        .from(tableName)
        .delete()
        .eq("id", id);

    await loadWords();
}

// ==============================
// START PREPROCESSING (UNCHANGED)
// ==============================
=======
// START PREPROCESSING
// ==============================
document.getElementById("processBtn").addEventListener("click", startPreprocessing);
document.getElementById("cancelProcessBtn").addEventListener("click", cancelPreprocessing);
document.getElementById("continueBtn").addEventListener("click", goToProcessing);
const closeDatasetModalBtn = document.getElementById("closeDatasetModal");
if (closeDatasetModalBtn) {
    closeDatasetModalBtn.addEventListener("click", closeDatasetModal);
}
const datasetCardModal = document.getElementById("datasetCard");
if (datasetCardModal) {
    datasetCardModal.addEventListener("click", function (e) {
        if (e.target.id === "datasetCard") closeDatasetModal();
    });
}
document.addEventListener("keydown", function (e) {
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

>>>>>>> 5389e9f (Initial commit)
async function startPreprocessing() {
    if (!selectedDataset) return;
    if (isProcessing) return;

    isProcessing = true;

    const btn = document.getElementById("processBtn");
<<<<<<< HEAD
    const table = document.getElementById("datasetTable");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const progressContainer = document.getElementById("progressContainer");

    let progress = 0;
    let interval;

    try {
        btn.disabled = true;
        btn.innerText = "Memproses...";
        table.style.pointerEvents = "none";
        table.style.opacity = "0.6";

        // 🔥 FIX: RESET PROGRESS
        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "Memulai...";

        // 🔥 SMOOTH PROGRESS
        interval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 6;
                progressBar.style.width = progress + "%";

                if (progress < 30) {
                    progressText.innerText = "Mengambil data...";
                } else if (progress < 60) {
                    progressText.innerText = "Preprocessing...";
                } else {
                    progressText.innerText = "Tokenisasi...";
                }
            }
        }, 300);

        const res = await fetch(`http://127.0.0.1:8000/preprocess/${selectedDataset.id}`, {
            method: "POST"
        });

        if (!res.ok) throw new Error("Server error");

        const result = await res.json();
        console.log(result);

        clearInterval(interval);

        // 🔥 FINISH
        progressBar.style.width = "100%";
        progressText.innerText = "Selesai";

        // 🔥 FIX: UPDATE STATE LOKAL
        selectedDataset.is_preprocessed = true;
=======
    const cancelBtn = document.getElementById("cancelProcessBtn");
    const table = document.getElementById("datasetTable");
    const progressContainer = document.getElementById("progressContainer");

    try {
        const selectedTokenizer = getSelectedPreprocessTokenizer();
        if (!selectedTokenizer) {
            throw new Error("Algoritma di Home harus dipilih dan hanya mendukung IndoBERT/mBERT untuk preprocessing.");
        }

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

        // Jalankan tokenizer backend secara async + polling progres real.
        const startRes = await fetch(
            `http://127.0.0.1:8000/preprocess/start/${selectedDataset.id}?tokenizer=${encodeURIComponent(selectedTokenizer)}`,
            { method: "POST" },
        );
        const startData = await startRes.json();
        if (!startRes.ok || !startData?.job_id) {
            throw new Error(startData?.message || "Failed to start backend tokenizer");
        }

        preprocessJobId = startData.job_id;
        updateProgressUI(35, "Backend tokenizer started...");
        const result = await pollPreprocessStatus(preprocessJobId);

        const finalDevice = (result.device || "cpu").toUpperCase();
        updateProgressUI(
            100,
            `Completed ${result.processed || 0}/${result.total || 0} | Device: ${finalDevice}`,
        );
>>>>>>> 5389e9f (Initial commit)

        await supabaseClient
            .from("datasets")
            .update({ is_preprocessed: true })
            .eq("id", selectedDataset.id);

<<<<<<< HEAD
        await loadDatasets();

    } catch (err) {
        console.error(err);
        alert("Preprocessing gagal");
    } finally {
        clearInterval(interval);

        isProcessing = false;

        btn.innerText = "Mulai Preprocessing";
        btn.disabled = selectedDataset?.is_preprocessed || false;

=======
        document.getElementById("continueBtn").style.display = "block";

        alert("Preprocessing + tokenization completed");

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
>>>>>>> 5389e9f (Initial commit)
        table.style.pointerEvents = "auto";
        table.style.opacity = "1";
    }
}

<<<<<<< HEAD
// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
    loadDatasets();

    const processBtn = document.getElementById("processBtn");
    if (processBtn) processBtn.addEventListener("click", startPreprocessing);
});
=======
// INIT
loadDatasets();
setupLexiconManager();
>>>>>>> 5389e9f (Initial commit)
