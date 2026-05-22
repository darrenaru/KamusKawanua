// ==============================
// SUPABASE INIT (WAJIB GANTI)
// ==============================
const supabaseUrl = "https://cdrabgiuvfisxntfzskd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcmFiZ2l1dmZpc3hudGZ6c2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTE3MDYsImV4cCI6MjA5NDA4NzcwNn0.7mOQSIwKZqH-SJtAIQFvmM-iFwjlUrmoknc6mZiny6Y";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function bumpPageAOS() {
    requestAnimationFrame(() => {
        if (typeof window.refreshPageAOS === "function") {
            window.refreshPageAOS();
        } else if (typeof window.AOS !== "undefined" && typeof window.AOS.refresh === "function") {
            try {
                window.AOS.refresh();
            } catch (e) {
                /* ignore */
            }
        }
    });
}

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
    alert("You are not logged in!");
    window.location.href = "../../login/login.html";
    return;
}

    initFileInput();
    initValidation();
    initSearch();
    setDatasetStatus("Loading datasets...");
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
            setDatasetStatus("Unable to load dataset list.");
            return; // avoid alert here
        }

        if (!data || data.length === 0) {
            datasets = [];
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
        setDatasetStatus("Unable to load dataset list.");
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
        console.error("Upload elements are incomplete");
        return;
    }

    const uploadLabel = document.querySelector(".upload-label");
        uploadLabel.addEventListener("click", () => {
            input.click();
        });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadBox.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadBox.classList.remove("dragover");
        });
    });

    uploadBox.addEventListener("drop", (event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;
        input.files = files;
        input.dispatchEvent(new Event("change"));
    });

    input.addEventListener("change", function () {
        if (this.files && this.files.length > 0) {
            fileName.textContent = this.files[0].name;
        } else {
            fileName.textContent = "No file selected";
        }
    });
}

function initValidation() {
    const input = document.getElementById("fileInput");
    const datasetName = document.getElementById("datasetName");
    const uploadBtn = document.getElementById("uploadBtn");

    function validate() {
        const file = input.files[0];
        // Now we don't strictly require name input if file is present (auto-naming)
        uploadBtn.disabled = !file;
    }
    
    datasetName.setAttribute("maxlength", "50");

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
    updateDatasetCount(list.length, datasets.length);

    if (!list.length) {
        const hasSourceData = datasets.length > 0;
        container.innerHTML = `<div class="dataset-empty" data-aos="fade-up" data-aos-delay="60">${
            hasSourceData
                ? "No dataset matches your current search keyword."
                : "No datasets are available yet. Upload a CSV file to get started."
        }</div>`;
        setDatasetStatus(hasSourceData ? "Search completed." : "Waiting for dataset upload.");
        bumpPageAOS();
        return;
    }

    setDatasetStatus(`Showing ${list.length} dataset(s).`);

    list.forEach((ds, idx) => {
        const card = document.createElement("div");
        card.className = "dataset-card";
        card.setAttribute("data-aos", "fade-up");
        card.setAttribute("data-aos-delay", String(Math.min(60 + idx * 50, 320)));

        const safeName = String(ds.name || "dataset").replace(/"/g, "&quot;");
        card.innerHTML = `
            <div class="card-header">
                <h3>${ds.name}</h3>
                <div class="card-actions">
                    <button type="button" class="download-btn" data-dataset-id="${ds.id}" data-dataset-name="${safeName}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download CSV
                    </button>
                    <button class="delete-btn" onclick="deleteDataset(${ds.id})">Delete</button>
                </div>
            </div>

            <div class="dataset-info">
                <div>Data count</div><div>: ${ds.total}</div>
                <div>Verb</div><div>: ${ds.kerja}</div>
                <div>Noun</div><div>: ${ds.benda}</div>
                <div>Adjective</div><div>: ${ds.sifat}</div>
                <div>Adverb</div><div>: ${ds.keterangan}</div>
                <div>Uploader</div><div>: ${ds.uploader}</div>
                <div>Upload Date</div><div>: ${ds.date}</div>
            </div>
        `;

        const downloadBtn = card.querySelector(".download-btn");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                downloadDatasetCsv(
                    Number(downloadBtn.dataset.datasetId),
                    downloadBtn.dataset.datasetName || "dataset",
                );
            });
        }

        container.appendChild(card);
    });

    bumpPageAOS();
}

async function downloadDatasetCsv(datasetId, datasetName) {
    if (!datasetId) return;
    try {
        const rows = await KamusCsvExport.fetchAllSupabaseRows(
            supabaseClient,
            "raw_data",
            datasetId,
        );
        const headers = [
            "id_kata",
            "jenis",
            "manado",
            "indonesia",
            "inggris",
            "kalimat_manado",
            "kalimat_indonesia",
            "kalimat_inggris",
        ];
        KamusCsvExport.downloadCsv(
            `${datasetName || "dataset"}_upload.csv`,
            headers,
            rows,
        );
    } catch (err) {
        console.error(err);
        alert("Failed to download CSV: " + (err.message || err));
    }
}

// ==============================
// CSV PARSER
// ==============================
function parseCSVStrict(text) {
    const lines = text.split("\n").filter(l => l.trim() !== "");

    // Handle header
    const header = parseCSVLine(lines[0]);

    // Format baru (8 kolom) yang sempat dipakai:
    // id_kata, manado, indonesia, jenis, kalimat_manado, kalimat_indonesia, kategori, sumber
    // Catatan: kolom kategori/sumber sekarang diabaikan saat insert ke raw_data.
    const expected8New = [
        "id_kata",
        "manado",
        "indonesia",
        "jenis",
        "kalimat_manado",
        "kalimat_indonesia",
        "kategori",
        "sumber"
    ];

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
    const isHeader8New = expected8New.every((col, i) => normalizedHeader[i] === col);

    if (!isHeader8 && !isHeader6 && !isHeader8New) {
        console.log("HEADER:", header);
        throw new Error("Invalid CSV format! Use a supported header (6-col legacy, 8-col legacy, or 8-col new).");
    }

    // Parse data
    return lines.slice(1).map(line => {
        const c = parseCSVLine(line);

        // Format 8 kolom baru: tidak ada inggris/kalimat_inggris.
        // Untuk kompatibilitas schema lama, inggris/kalimat_inggris diisi string kosong.
        if (isHeader8New) {
            return {
                id_kata: c[0],
                manado: c[1],
                indonesia: c[2],
                jenis: c[3],
                kalimat_manado: c[4],
                kalimat_indonesia: c[5],
                inggris: "",
                kalimat_inggris: ""
            };
        }

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
    uploadBtn.innerText = "Uploading...";
    input.disabled = true;
    datasetNameInput.disabled = true;

    // UI elements
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    try {

        if (!file) {
            alert("Please select a CSV file.");
            uploadBtn.disabled = false;
            cancelBtn.disabled = false;
            uploadBtn.innerText = "Upload to Database";
            input.disabled = false;
            datasetNameInput.disabled = false;
            isUploading = false;
            return;
        }

        let finalName = datasetName || file.name.replace(/\.[^/.]+$/, "");
        finalName = finalName.substring(0, 50).trim();

        let isDuplicate = await isDatasetNameExists(finalName);
        if (isDuplicate) {
            if (datasetName) {
                alert("Dataset name '" + finalName + "' is already used! Please choose another name.");
                uploadBtn.disabled = false;
                cancelBtn.disabled = false;
                uploadBtn.innerText = "Upload to Database";
                input.disabled = false;
                datasetNameInput.disabled = false;
                isUploading = false;
                return;
            } else {
                let counter = 1;
                let newName = finalName;
                while (isDuplicate) {
                    const suffix = "_" + counter;
                    newName = finalName.substring(0, 50 - suffix.length) + suffix;
                    isDuplicate = await isDatasetNameExists(newName);
                    counter++;
                }
                finalName = newName;
            }
        }

        progressContainer.style.display = "block";
        progressText.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "Processing file...";

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
            alert("Session lost, please log in again!");
            window.location.href = "../../login/login.html";
            return;
        }

        // INSERT DATASET
        const { data: dataset, error: err1 } = await supabaseClient
            .from("datasets")
            .insert([{
                name: finalName,
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
        // Whitelist kolom raw_data agar field lama (mis. kategori/sumber)
        // tidak ikut terkirim ke Supabase.
        const rawRows = rows
            .filter(r => r.id_kata && r.id_kata !== "")
            .map(r => ({
                dataset_id: dataset.id,
                id_kata: r.id_kata,
                jenis: r.jenis,
                manado: r.manado,
                indonesia: r.indonesia,
                inggris: r.inggris ?? "",
                kalimat_manado: r.kalimat_manado,
                kalimat_indonesia: r.kalimat_indonesia,
                kalimat_inggris: r.kalimat_inggris ?? "",
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

        progressText.innerText = "Completed!";
        progressBar.style.width = "100%";

        setTimeout(() => {
            progressContainer.style.display = "none";
            progressText.style.display = "none";
        }, 1000);

        alert("Dataset saved successfully!");

        resetFile();
        fetchDatasets();

    } catch (err) {
        console.error(err);
        alert(err.message || "An error occurred");

        progressContainer.style.display = "none";
        progressText.style.display = "none";
    } finally {

        // 🔓 UNLOCK UI (WAJIB SELALU JALAN)
        isUploading = false;

        uploadBtn.disabled = false;
        cancelBtn.disabled = false;
        uploadBtn.innerText = "Upload";
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
    label.innerText = "No file selected";
    datasetNameInput.value = "";
    uploadBtn.disabled = true;
}

// ==============================
// SEARCH
// ==============================
function initSearch() {
    const searchInput = document.getElementById("searchInput");

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

function updateDatasetCount(visibleCount, totalCount) {
    const el = document.getElementById("datasetCount");
    if (!el) return;
    el.textContent = `Total datasets: ${totalCount} | Visible: ${visibleCount}`;
}

function setDatasetStatus(text) {
    const el = document.getElementById("datasetStatus");
    if (!el) return;
    el.textContent = text;
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

    const confirmDelete = confirm("Are you sure you want to delete this dataset?");
    if (!confirmDelete) return;

    try {

        // Delete raw_data first
        const { error: errRaw } = await supabaseClient
            .from("raw_data")
            .delete()
            .eq("dataset_id", datasetId);

        if (errRaw) throw errRaw;

        // Delete dataset
        const { error: errDataset } = await supabaseClient
            .from("datasets")
            .delete()
            .eq("id", datasetId);

        if (errDataset) throw errDataset;

        alert("Dataset deleted successfully");

        // Refresh UI
        fetchDatasets();

    } catch (err) {
        console.error("DELETE ERROR:", err);
        alert("Failed to delete dataset");
    }
}

function goToPreprocessing() {
    window.location.href = "preprocessing.html";
}