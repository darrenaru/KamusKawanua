const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let selectedDataset = null;
let isProcessing = false;
let allWords = [];
let currentPage = 1;
const perPage = 20;

// ==============================
// CLEAN PIPELINE
// ==============================
function cleanText(text) {
    if (!text) return "";

    text = text.toLowerCase();
    text = text.replace(/[^a-zA-Z\s]/g, "");
    text = text.replace(/(.)\1{2,}/g, "$1$1");
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

    // 🔥 FIX: AUTO SELECT DATASET
    if (datasets.length > 0) {
        selectDataset(datasets[0]);
    }
}

// ==============================
// RENDER TABLE
// ==============================
function renderTable() {
    const body = document.getElementById("tableBody");
    if (!body) return;

    body.innerHTML = "";

    if (!datasets || datasets.length === 0) {
        body.innerHTML = `<tr><td colspan="7">Tidak ada dataset</td></tr>`;
        return;
    }

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
                    ${ds.is_preprocessed ? 'Selesai' : 'Belum'}
                </span>
            </td>
        `;

        tr.addEventListener("click", () => {
            document.querySelectorAll("#tableBody tr").forEach(r => r.classList.remove("selected"));
            tr.classList.add("selected");
            selectDataset(ds);
        });

        body.appendChild(tr);
    });
}

// ==============================
// SELECT DATASET
// ==============================
function selectDataset(ds) {
    selectedDataset = ds;

    const btn = document.getElementById("processBtn");

    btn.disabled = ds.is_preprocessed;

    document.getElementById("datasetCard").style.display = "block";

    document.getElementById("fileName").innerText = ds.file_name || "-";
    document.getElementById("datasetName").innerText = ds.name;
    document.getElementById("total").innerText = ds.total_data;
    document.getElementById("kerja").innerText = ds.kata_kerja;
    document.getElementById("benda").innerText = ds.kata_benda;
    document.getElementById("sifat").innerText = ds.kata_sifat;
    document.getElementById("keterangan").innerText = ds.kata_keterangan;
    document.getElementById("uploader").innerText = ds.uploaded_by || "-";
    document.getElementById("date").innerText = ds.created_at?.split("T")[0] || "-";
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
async function startPreprocessing() {
    if (!selectedDataset) return;
    if (isProcessing) return;

    isProcessing = true;

    const btn = document.getElementById("processBtn");
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

        await supabaseClient
            .from("datasets")
            .update({ is_preprocessed: true })
            .eq("id", selectedDataset.id);

        await loadDatasets();

    } catch (err) {
        console.error(err);
        alert("Preprocessing gagal");
    } finally {
        clearInterval(interval);

        isProcessing = false;

        btn.innerText = "Mulai Preprocessing";
        btn.disabled = selectedDataset?.is_preprocessed || false;

        table.style.pointerEvents = "auto";
        table.style.opacity = "1";
    }
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
    loadDatasets();

    const processBtn = document.getElementById("processBtn");
    if (processBtn) processBtn.addEventListener("click", startPreprocessing);
});