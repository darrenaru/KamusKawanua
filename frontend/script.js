// ==============================
// LANGUAGE STATE
// ==============================
let currentLang = "manado";

function updateLanguageUI() {
    const input = document.getElementById("inputLang");
    const output = document.getElementById("outputLang");

    if (currentLang === "manado") {
        input.value = "Manado";
        output.value = "Indonesia";
    } else {
        input.value = "Indonesia";
        output.value = "Manado";
    }
}

// ==============================
// SWAP FUNCTION
// ==============================
function swapLanguage() {
    currentLang = currentLang === "manado" ? "indonesia" : "manado";
    updateLanguageUI();
}

document.addEventListener("DOMContentLoaded", updateLanguageUI);


// ==============================
// ENTER KEY SUPPORT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("query").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            search();
        }
    });
});


// ==============================
// SEARCH FUNCTION (UPDATED)
// ==============================
async function search() {
    const query = document.getElementById("query").value.trim();

    if (!query) return;

    try {
        const q = encodeURIComponent(query);
        const res = await fetch(`http://127.0.0.1:8000/search?query=${q}&lang=${currentLang}&use_model=true`);
        const data = await res.json();

        displayResults(data);

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = "<p>Server error</p>";
    }
}


// ==============================
// DISPLAY RESULTS + dual-model analysis
// ==============================
function escapeHtml(s) {
    const t = document.createElement("div");
    t.textContent = s == null ? "" : String(s);
    return t.innerHTML;
}

/** Tooltip i: konsensus + tiap algoritma + banding entri kamus */
function buildConsensusTooltipHtml(data, item) {
    const mc = data.model_consensus;
    let html =
        '<strong>Perbandingan algoritma</strong><br/><span class="tooltip-muted">Prediksi jenis untuk kata yang Anda cari.</span><br/><br/>';

    if (!mc || !mc.per_algorithm || mc.per_algorithm.length === 0) {
        html += "Tidak ada data model.";
        return html;
    }

    if (mc.consensus_label && mc.total_with_prediction > 0) {
        html += `<strong>Konsensus mayoritas:</strong> ${escapeHtml(mc.consensus_label)} (${escapeHtml(String(mc.majority_count))}/${escapeHtml(String(mc.total_with_prediction))} algoritma sepakat)<br/><br/>`;
    } else {
        html += "<strong>Konsensus mayoritas:</strong> tidak terbentuk.<br/><br/>";
    }

    html += "<strong>Tiap algoritma:</strong><br/>";
    for (const p of mc.per_algorithm) {
        const name = escapeHtml(p.display_name || p.algorithm || "");
        if (p.role === "unavailable") {
            const det = p.detail ? escapeHtml(String(p.detail).slice(0, 140)) : "";
            html += `- ${name}: <em>tidak tersedia</em>${det ? " &ndash; " + det : ""}<br/>`;
        } else if (p.role === "no_prediction") {
            html += `- ${name}: tidak ada prediksi<br/>`;
        } else {
            const lab = escapeHtml(p.label || "");
            const ok = p.matches_consensus;
            const tag = ok
                ? '<strong class="tag-ok">sepakat</strong>'
                : '<strong class="tag-no">tidak sepakat</strong>';
            const conf =
                p.confidence != null && Number.isFinite(Number(p.confidence))
                    ? ` (${(Number(p.confidence) * 100).toFixed(0)}%)`
                    : "";
            html += `- ${name}: ${lab}${conf} &ndash; ${tag} dengan mayoritas<br/>`;
        }
    }

    const rawJenis =
        item.jenis != null
            ? String(item.jenis)
                  .replace(/<[^>]*>/g, "")
                  .trim()
            : "";
    if (rawJenis) {
        html +=
            "<br/><strong>Jenis di entri kamus ini:</strong> " + escapeHtml(rawJenis);
        if (mc.consensus_label) {
            const same =
                rawJenis.toLowerCase() ===
                String(mc.consensus_label).toLowerCase().trim();
            html += `<br/><em>${same ? "Sesuai konsensus mayoritas." : "Berbeda dari konsensus mayoritas."}</em>`;
        }
    }

    return html;
}

/** Ringkasan satu baris di atas daftar hasil */
function buildConsensusStripHtml(data) {
    const mc = data.model_consensus;
    if (!mc || !data.model_analyses || data.model_analyses.length === 0) {
        return "";
    }
    if (!mc.consensus_label || !mc.total_with_prediction) {
        return `
        <div class="model-consensus-strip">
          <p class="consensus-banner muted">Prediksi model: konsensus belum terbentuk (cek apakah checkpoint ada di folder trained_models).</p>
        </div>`;
    }
    return `
        <div class="model-consensus-strip">
          <p class="consensus-banner">
            <strong>Jenis mayoritas (kata yang dicari):</strong>
            ${escapeHtml(mc.consensus_label)}
            <span class="consensus-meta">(${escapeHtml(String(mc.majority_count))}/${escapeHtml(String(mc.total_with_prediction))} algoritma sepakat)</span>
          </p>
        </div>`;
}

function displayResults(data) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    const stripHtml = buildConsensusStripHtml(data);
    if (stripHtml) {
        container.insertAdjacentHTML("beforeend", stripHtml);
    }

    if (!data.results || data.results.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-results-msg";
        empty.textContent = "Tidak ditemukan";
        container.appendChild(empty);
        return;
    }

    data.results.forEach((item) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const tooltipInner = buildConsensusTooltipHtml(data, item);

        const matchBits = [];
        if (item.model_match_indobert) matchBits.push("cocok jenis ↔ IndoBERT");
        if (item.model_match_mbert) matchBits.push("cocok jenis ↔ mBERT");
        const matchStr =
            matchBits.length > 0 ? ` | ${matchBits.join(", ")}` : "";

        card.innerHTML = `
            <div class="result-card-heading">
              <h3 class="result-word-title">${item.manado}</h3>
              <span class="label-with-help label-with-help--inline">
                <span class="param-help-icon" tabindex="0" aria-label="Rincian prediksi per algoritma">i
                  <span class="param-help-tooltip param-help-tooltip--wide">${tooltipInner}</span>
                </span>
              </span>
            </div>

            <div class="result-grid">
                <div class="result-section">
                    <strong>MANADO</strong>
                    <p>${item.manado}</p>
                    <p class="example">${item.kalimat_manado}</p>
                </div>

                <div class="result-section">
                    <strong>INDONESIA</strong>
                    <p>${item.indonesia}</p>
                    <p class="example">${item.kalimat_indonesia}</p>
                </div>
            </div>

            <div class="score">
                ${item.method} | skor: ${item.score}${item.model_match ? " | cocok salah satu model dengan entri" : ""}${matchStr}
            </div>
        `;

        container.appendChild(card);
    });
}