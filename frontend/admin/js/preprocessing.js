const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let selectedDataset = null;
let isProcessing = false;

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

    document.getElementById("processBtn").disabled = ds.is_preprocessed;

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
// START PREPROCESSING
// ==============================
document.getElementById("processBtn").addEventListener("click", startPreprocessing);

async function startPreprocessing() {
    if (!selectedDataset) return;
    if (isProcessing) return;

    isProcessing = true;

    const btn = document.getElementById("processBtn");
    const table = document.getElementById("datasetTable");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const progressContainer = document.getElementById("progressContainer");

    try {
        btn.disabled = true;
        btn.innerText = "Memproses...";
        table.style.pointerEvents = "none";
        table.style.opacity = "0.6";

        progressContainer.style.display = "block";
        progressBar.style.width = "10%";
        progressText.innerText = "Cleaning data...";

        const allData = await fetchAllRawData(selectedDataset.id);

        if (!allData || allData.length === 0) {
            throw new Error("Raw data kosong");
        }

        const chunkSize = 100;

        for (let i = 0; i < allData.length; i += chunkSize) {
            const chunk = allData.slice(i, i + chunkSize);

            const processed = chunk.map(row => ({
                dataset_id: row.dataset_id,
                id_kata: row.id_kata,
                jenis: row.jenis,

                manado: row.manado,
                indonesia: row.indonesia,
                inggris: row.inggris,
                kalimat_manado: row.kalimat_manado,
                kalimat_indonesia: row.kalimat_indonesia,
                kalimat_inggris: row.kalimat_inggris,

                manado_clean: cleanText(row.manado),
                indonesia_clean: cleanText(row.indonesia),
                inggris_clean: cleanText(row.inggris),

                kalimat_manado_clean: cleanText(row.kalimat_manado),
                kalimat_indonesia_clean: cleanText(row.kalimat_indonesia),
                kalimat_inggris_clean: cleanText(row.kalimat_inggris)
            }));

            const { error } = await supabaseClient
                .from("preprocessed_data")
                .insert(processed);

            if (error) throw error;
        }

        // 🔥 TOKENIZER BACKEND
        progressBar.style.width = "50%";
progressText.innerText = "Tokenizing (mBERT)...";

const res = await fetch(`http://127.0.0.1:8000/preprocess/${selectedDataset.id}`, {
    method: "POST"
});

const result = await res.json();

if (!res.ok) {
    throw new Error("Backend tokenizer gagal");
}

// 🔥 PROGRESS REAL BASED ON RESULT
const percent = Math.round((result.success / result.total) * 100);

progressBar.style.width = percent + "%";
progressText.innerText = `${percent}% (${result.success}/${result.total})`;

progressBar.style.width = "100%";
progressText.innerText = "Selesai";

        await supabaseClient
            .from("datasets")
            .update({ is_preprocessed: true })
            .eq("id", selectedDataset.id);

        alert("Preprocessing + Tokenisasi selesai");

        await loadDatasets();

    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        isProcessing = false;
        btn.disabled = false;
        btn.innerText = "Mulai Preprocessing";
        table.style.pointerEvents = "auto";
        table.style.opacity = "1";
    }
}

// INIT
loadDatasets();