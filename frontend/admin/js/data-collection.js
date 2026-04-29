// ==============================
// SUPABASE INIT (WAJIB GANTI)
// ==============================
const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==============================
// DATA
// ==============================
let datasets = [];
let isUploading = false;

// ==============================
// INIT
// ==============================
    console.log("LOGIN DEBUG:");
    console.log("isLoggedIn =", localStorage.getItem("isLoggedIn"));
    console.log("username =", localStorage.getItem("username"));

document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");

if (!isLoggedIn) {
    alert("Kamu belum login!");
    window.location.href = "../../login/login.html";
    return;
}

    initFileInput();
    initValidation();
    initSearch();
    fetchDatasets();
});

// ==============================
// FETCH DATASETS (TIDAK ERROR SAAT KOSONG)
// ==============================
async function fetchDatasets() {
    try {
        const { data, error } = await supabaseClient
            .from("datasets")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            console.error("FETCH ERROR:", error);
            return; // ❌ jangan alert
        }

        if (!data || data.length === 0) {
            renderDatasets([]);
            return;
        }

        datasets = data.map(d => ({
            id: d.id,
            name: d.name,
            total: d.total_data,
            kerja: d.kata_kerja,
            benda: d.kata_benda,
            sifat: d.kata_sifat,
            keterangan: d.kata_keterangan,
            uploader: d.uploaded_by,
            date: d.created_at?.split("T")[0] || "-"
        }));

        renderDatasets();

    } catch (err) {
        console.error("FETCH CRASH:", err);
    }
}

// ==============================
// FIX FILE INPUT (FINAL)
// ==============================
function initFileInput() {
    const input = document.getElementById("fileInput");
    const fileName = document.getElementById("fileName");
    const uploadBox = document.querySelector(".upload-box");

    if (!input || !fileName || !uploadBox) {
        console.error("Upload element tidak lengkap");
        return;
    }

    const uploadLabel = document.querySelector(".upload-label");
        uploadLabel.addEventListener("click", () => {
            input.click();
        });

    input.addEventListener("change", function () {
        if (this.files && this.files.length > 0) {
            fileName.textContent = this.files[0].name;
        } else {
            fileName.textContent = "Belum ada file";
        }
    });
}

function initValidation() {
    const input = document.getElementById("fileInput");
    const datasetName = document.getElementById("datasetName");
    const uploadBtn = document.getElementById("uploadBtn");

    function validate() {
        const file = input.files[0];
        const name = datasetName.value.trim();

        uploadBtn.disabled = !(file && name);
    }

    input.addEventListener("change", validate);
    datasetName.addEventListener("input", validate);
}

// ==============================
// RENDER
// ==============================
function renderDatasets(list = datasets) {
    const container = document.getElementById("datasetList");
    if (!container) return;

    container.innerHTML = "";

    list.forEach(ds => {
        const card = document.createElement("div");
        card.className = "dataset-card";

        card.innerHTML = `
            <div class="card-header">
                <h3>${ds.name}</h3>
                <button class="delete-btn" onclick="deleteDataset(${ds.id})">Hapus</button>
            </div>

            <div class="dataset-info">
                <div>Jumlah data</div><div>: ${ds.total}</div>
                <div>Kata Kerja</div><div>: ${ds.kerja}</div>
                <div>Kata Benda</div><div>: ${ds.benda}</div>
                <div>Kata Sifat</div><div>: ${ds.sifat}</div>
                <div>Kata Keterangan</div><div>: ${ds.keterangan}</div>
                <div>Nama Pengimpor</div><div>: ${ds.uploader}</div>
                <div>Tanggal Upload</div><div>: ${ds.date}</div>
            </div>
        `;

        container.appendChild(card);
    });
}

// ==============================
// CSV PARSER
// ==============================
function parseCSVStrict(text) {
    const lines = text.split("\n").filter(l => l.trim() !== "");

    // 🔥 HANDLE HEADER
    const header = parseCSVLine(lines[0]);

    const expected8 = [
        "id_kata",
        "jenis",
        "manado",
        "indonesia",
        "inggris",
        "kalimat_manado",
        "kalimat_indonesia",
        "kalimat_inggris"
    ];
    const expected6 = [
        "id_kata",
        "jenis",
        "manado",
        "indonesia",
        "kalimat_manado",
        "kalimat_indonesia"
    ];

    const normalizedHeader = header.map(h => (h || "").trim().toLowerCase());
    const isHeader8 = expected8.every((col, i) => normalizedHeader[i] === col);
    const isHeader6 = expected6.every((col, i) => normalizedHeader[i] === col);

    if (!isHeader8 && !isHeader6) {
        console.log("HEADER:", header);
        throw new Error("Format CSV tidak sesuai! Gunakan header 6 atau 8 kolom yang didukung.");
    }

    // 🔥 PARSE DATA
    return lines.slice(1).map(line => {
        const c = parseCSVLine(line);

        // Format 6 kolom: otomatis isi data Inggris dengan string kosong.
        if (isHeader6) {
            return {
                id_kata: c[0],
                jenis: c[1],
                manado: c[2],
                indonesia: c[3],
                inggris: "",
                kalimat_manado: c[4],
                kalimat_indonesia: c[5],
                kalimat_inggris: ""
            };
        }

        return {
            id_kata: c[0],
            jenis: c[1],
            manado: c[2],
            indonesia: c[3],
            inggris: c[4],
            kalimat_manado: c[5],
            kalimat_indonesia: c[6],
            kalimat_inggris: c[7]
        };
    });
}

async function isDatasetNameExists(name) {
    const { data, error } = await supabaseClient
        .from("datasets")
        .select("id")
        .ilike("name", name) // case-insensitive

    if (error) {
        console.error("CHECK NAME ERROR:", error);
        return false;
    }

    return data.length > 0;
}

// ==============================
// UPLOAD FINAL
// ==============================
async function uploadDataset() {

    // 🔒 HARD GUARD (ANTI DOUBLE CLICK)
    if (isUploading) return;
    isUploading = true;

    const input = document.getElementById("fileInput");
    const datasetNameInput = document.getElementById("datasetName");
    const uploadBtn = document.getElementById("uploadBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    const file = input.files[0];
    const datasetName = datasetNameInput.value.trim();

    // 🔒 LOCK UI
    uploadBtn.disabled = true;
    cancelBtn.disabled = true;
    uploadBtn.innerText = "Mengunggah...";
    input.disabled = true;
    datasetNameInput.disabled = true;

    // 🔥 UI ELEMENT
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    try {

        // VALIDASI DULU
        if (!file || !datasetName) {
            alert("File dan nama dataset wajib diisi!");
            return;
        }

        // CEK DUPLIKAT
        const exists = await isDatasetNameExists(datasetName);

        if (exists) {
            alert("Nama dataset sudah digunakan!");
            return;
        }

        progressContainer.style.display = "block";
        progressText.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "Memproses file...";

        const text = await file.text();
        const rows = parseCSVStrict(text);

        // HITUNG STAT
        let kerja = 0, benda = 0, sifat = 0, keterangan = 0;

        rows.forEach(r => {
            const j = (r.jenis || "").toLowerCase();
            if (j === "kata kerja") kerja++;
            else if (j === "kata benda") benda++;
            else if (j === "kata sifat") sifat++;
            else if (j === "kata keterangan") keterangan++;
        });

        const { data: { session } } = await supabaseClient.auth.getSession();

        const username = localStorage.getItem("username");
        console.log("UPLOAD DEBUG username =", username);

        if (!username) {
            alert("Session hilang, login ulang!");
            window.location.href = "../../login/login.html";
            return;
        }

        // INSERT DATASET
        const { data: dataset, error: err1 } = await supabaseClient
            .from("datasets")
            .insert([{
                name: datasetName,
                file_name: file.name,
                total_data: rows.length,
                kata_kerja: kerja,
                kata_benda: benda,
                kata_sifat: sifat,
                kata_keterangan: keterangan,
                uploaded_by: username
            }])
            .select()
            .single();

        if (err1) throw err1;

        // FILTER DATA
        const rawRows = rows
            .filter(r => r.id_kata && r.id_kata !== "")
            .map(r => ({
                dataset_id: dataset.id,
                ...r
            }));

        const chunkSize = 200;
        const totalChunks = Math.ceil(rawRows.length / chunkSize);

        // INSERT CHUNK + PROGRESS
        for (let i = 0; i < rawRows.length; i += chunkSize) {
            const chunk = rawRows.slice(i, i + chunkSize);

            const { error } = await supabaseClient
                .from("raw_data")
                .insert(chunk);

            if (error) throw error;

            const currentChunk = Math.floor(i / chunkSize) + 1;
            const percent = Math.round((currentChunk / totalChunks) * 100);

            progressBar.style.width = percent + "%";
            progressText.innerText = `Uploading ${percent}% (${currentChunk}/${totalChunks})`;
        }

        progressText.innerText = "Selesai!";
        progressBar.style.width = "100%";

        setTimeout(() => {
            progressContainer.style.display = "none";
            progressText.style.display = "none";
        }, 1000);

        alert("Dataset berhasil disimpan!");

        resetFile();
        fetchDatasets();

    } catch (err) {
        console.error(err);
        alert(err.message || "Terjadi kesalahan");

        progressContainer.style.display = "none";
        progressText.style.display = "none";
    } finally {

        // 🔓 UNLOCK UI (WAJIB SELALU JALAN)
        isUploading = false;

        uploadBtn.disabled = false;
        cancelBtn.disabled = false;
        uploadBtn.innerText = "Unggah";
        input.disabled = false;
        datasetNameInput.disabled = false;
    }
}

// ==============================
// RESET
// ==============================
function resetFile() {
    const input = document.getElementById("fileInput");
    const label = document.getElementById("fileName");
    const datasetNameInput = document.getElementById("datasetName");
    const uploadBtn = document.getElementById("uploadBtn");

    input.value = "";
    label.innerText = "Belum ada file";
    datasetNameInput.value = "";
    uploadBtn.disabled = true;
}

// ==============================
// SEARCH
// ==============================
function initSearch() {
    const searchInput = document.querySelector(".search-box input");

    if (!searchInput) return;

    searchInput.addEventListener("input", function () {
        const keyword = this.value.toLowerCase();

        const filtered = datasets.filter(ds =>
            ds.name.toLowerCase().includes(keyword) ||
            ds.uploader?.toLowerCase().includes(keyword)
        );

        renderDatasets(filtered);
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } 
        else if (char === ',' && !inQuotes) {
            result.push(current);
            current = "";
        } 
        else {
            current += char;
        }
    }

    result.push(current);

    return result;
}

async function deleteDataset(datasetId) {

    const confirmDelete = confirm("Yakin ingin menghapus dataset ini?");
    if (!confirmDelete) return;

    try {

        // 🔥 HAPUS RAW DATA DULU
        const { error: errRaw } = await supabaseClient
            .from("raw_data")
            .delete()
            .eq("dataset_id", datasetId);

        if (errRaw) throw errRaw;

        // 🔥 HAPUS DATASET
        const { error: errDataset } = await supabaseClient
            .from("datasets")
            .delete()
            .eq("id", datasetId);

        if (errDataset) throw errDataset;

        alert("Dataset berhasil dihapus");

        // 🔄 REFRESH UI
        fetchDatasets();

    } catch (err) {
        console.error("DELETE ERROR:", err);
        alert("Gagal menghapus dataset");
    }
}

function goToPreprocessing() {
    window.location.href = "preprocessing.html";
}