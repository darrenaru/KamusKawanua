const supabaseUrl = "https://fhpjbkelhvopvfzykjne.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let datasets = [];
let selectedDataset = null;
let isProcessing = false;

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
// FETCH ALL RAW DATA (FIX LIMIT 1000)
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

    console.log("TOTAL RAW FETCHED:", allData.length);
    return allData;
}

// ==============================
// PREPROCESSING
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
        // LOCK UI
        btn.disabled = true;
        btn.innerText = "Memproses...";
        table.style.pointerEvents = "none";
        table.style.opacity = "0.6";

        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
        progressText.innerText = "0%";

        // 🔥 FIX: FETCH ALL DATA
        const allData = await fetchAllRawData(selectedDataset.id);

        if (!allData || allData.length === 0) {
            throw new Error("Raw data kosong");
        }

        const total = allData.length;
        const chunkSize = 50;

        // ==============================
        // PROCESS LOOP
        // ==============================
        for (let i = 0; i < total; i += chunkSize) {
            const chunk = allData.slice(i, i + chunkSize);

            console.log(`Processing chunk ${i} - ${i + chunk.length}`);

            const processed = chunk.map(row => ({
                dataset_id: row.dataset_id,
                id_kata: row.id_kata,
                jenis: row.jenis,

                // ORIGINAL
                manado: row.manado,
                indonesia: row.indonesia,
                inggris: row.inggris,
                kalimat_manado: row.kalimat_manado,
                kalimat_indonesia: row.kalimat_indonesia,
                kalimat_inggris: row.kalimat_inggris,

                // CLEAN
                manado_clean: row.manado?.toLowerCase(),
                indonesia_clean: row.indonesia?.toLowerCase(),
                inggris_clean: row.inggris?.toLowerCase(),

                kalimat_manado_clean: row.kalimat_manado?.toLowerCase(),
                kalimat_indonesia_clean: row.kalimat_indonesia?.toLowerCase(),
                kalimat_inggris_clean: row.kalimat_inggris?.toLowerCase(),
            }));

            const { data: inserted, error: insertError } = await supabaseClient
                .from("preprocessed_data")
                .insert(processed)
                .select();

            if (insertError) throw insertError;

            if (!inserted || inserted.length !== processed.length) {
                throw new Error(`Insert tidak lengkap di chunk ${i}`);
            }

            // 🔥 anti rate limit
            await new Promise(r => setTimeout(r, 100));

            const percent = Math.round(((i + chunk.length) / total) * 100);
            progressBar.style.width = percent + "%";
            progressText.innerText = percent + "%";
        }

        // ==============================
// UPDATE STATUS (FIX TOTAL)
// ==============================
const datasetId = Number(selectedDataset.id);

console.log("UPDATE DATASET ID:", datasetId, typeof datasetId);

const { data: updated, error: updateError } = await supabaseClient
    .from("datasets")
    .update({ is_preprocessed: true })
    .eq("id", datasetId)
    .select();

console.log("UPDATE RESULT:", updated);
console.log("UPDATE ERROR:", updateError);

if (updateError) throw updateError;

if (!updated || updated.length === 0) {
    throw new Error("Update gagal: tidak ada row yang terupdate (cek ID / RLS)");
}

        progressBar.style.width = "100%";
        progressText.innerText = "Selesai";

        alert("Preprocessing selesai");

        await loadDatasets();

// 🔥 REFRESH SELECTED DATASET (WAJIB)
const updatedDataset = datasets.find(d => d.id === selectedDataset.id);

if (updatedDataset) {
    selectDataset(updatedDataset);
}

    } catch (err) {
        console.error("PREPROCESS ERROR:", err);
        alert(err.message || "Terjadi kesalahan");
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