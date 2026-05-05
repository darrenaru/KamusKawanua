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

function formatWordTypeLabel(raw) {
    const v = String(raw || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
    const map = {
        "kata kerja": "Verb / Kata kerja",
        kerja: "Verb / Kata kerja",
        verb: "Verb / Kata kerja",
        "kata benda": "Noun / Kata benda",
        benda: "Noun / Kata benda",
        noun: "Noun / Kata benda",
        "kata sifat": "Adjective / Kata sifat",
        sifat: "Adjective / Kata sifat",
        adjective: "Adjective / Kata sifat",
    };
    return map[v] || String(raw || "");
}

function canonicalWordType(raw) {
    const v = String(raw || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
    if (v === "kata kerja" || v === "kerja" || v === "verb") return "verb";
    if (v === "kata benda" || v === "benda" || v === "noun") return "noun";
    if (v === "kata sifat" || v === "sifat" || v === "adjective") return "adjective";
    return v;
}

/** Info tooltip: consensus + per-algorithm details + dictionary entry check */
function buildConsensusTooltipHtml(data, item) {
    const mc = data.model_consensus;
    const analyses = Array.isArray(data.model_analyses) ? data.model_analyses : [];
    const analysisByAlgo = {};
    analyses.forEach((a) => {
        const k = String(a?.algorithm || "").toLowerCase().trim();
        if (!k || analysisByAlgo[k]) return;
        analysisByAlgo[k] = a;
    });
    let html =
        '<strong>Algorithm comparison</strong><br/><span class="tooltip-muted">Part-of-speech predictions for your query.</span><br/><br/>';

    if (!mc || !mc.per_algorithm || mc.per_algorithm.length === 0) {
        html += "No model data available.";
        return html;
    }

    if (mc.consensus_label && mc.total_with_prediction > 0) {
        html += `<strong>Majority consensus:</strong> ${escapeHtml(formatWordTypeLabel(mc.consensus_label))} (${escapeHtml(String(mc.majority_count))}/${escapeHtml(String(mc.total_with_prediction))} algorithms agree)<br/><br/>`;
    } else {
        html += "<strong>Majority consensus:</strong> not formed.<br/><br/>";
    }

    html += "<strong>Per algorithm:</strong><br/>";
    for (const p of mc.per_algorithm) {
        const name = escapeHtml(p.display_name || p.algorithm || "");
        const algoKey = String(p.algorithm || "").toLowerCase().trim();
        const detail = analysisByAlgo[algoKey] || {};
        const modelName = detail.model_name ? escapeHtml(String(detail.model_name)) : "-";
        const modelMeta = ` | model: ${modelName}`;
        if (p.role === "unavailable") {
            const det = p.detail ? escapeHtml(String(p.detail).slice(0, 140)) : "";
            html += `- ${name}: <em>unavailable</em>${modelMeta}${det ? " &ndash; " + det : ""}<br/>`;
        } else if (p.role === "no_prediction") {
            html += `- ${name}: no prediction${modelMeta}<br/>`;
        } else {
            const lab = escapeHtml(formatWordTypeLabel(p.label || ""));
            const ok = p.matches_consensus;
            const tag = ok
                ? '<strong class="tag-ok">agrees</strong>'
                : '<strong class="tag-no">disagrees</strong>';
            const conf =
                p.confidence != null && Number.isFinite(Number(p.confidence))
                    ? ` (${(Number(p.confidence) * 100).toFixed(0)}%)`
                    : "";
            html += `- ${name}: ${lab}${conf} &ndash; ${tag} with majority${modelMeta}<br/>`;
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
            "<br/><strong>Type in this dictionary entry:</strong> " + escapeHtml(formatWordTypeLabel(rawJenis));
        if (mc.consensus_label) {
            const same =
                canonicalWordType(rawJenis) === canonicalWordType(mc.consensus_label);
            html += `<br/><em>${same ? "Matches the majority consensus." : "Differs from the majority consensus."}</em>`;
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
          <p class="consensus-banner muted">Model prediction: consensus is not formed yet (check whether checkpoints exist in the trained_models folder).</p>
        </div>`;
    }
    return `
        <div class="model-consensus-strip">
          <p class="consensus-banner">
            <strong>Majority type (searched word):</strong>
            ${escapeHtml(formatWordTypeLabel(mc.consensus_label))}
            <span class="consensus-meta">(${escapeHtml(String(mc.majority_count))}/${escapeHtml(String(mc.total_with_prediction))} algorithms agree)</span>
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
        empty.textContent = "No results found";
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
                <span class="param-help-icon" tabindex="0" aria-label="Per-algorithm prediction details">i
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