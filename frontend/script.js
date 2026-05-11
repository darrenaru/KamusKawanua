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
// LOGO BASIC PROTECTION (UI-LEVEL)
// ==============================
document.addEventListener("DOMContentLoaded", () => {
    const logo = document.getElementById("brandLogo");
    if (!logo) return;

    // Prevent dragging/saving the logo image from the page.
    logo.addEventListener("dragstart", (e) => e.preventDefault());
    logo.addEventListener("contextmenu", (e) => e.preventDefault());

    // Block save shortcut while focused on the public search page.
    document.addEventListener("keydown", (e) => {
        const isSave =
            (e.ctrlKey || e.metaKey) && String(e.key || "").toLowerCase() === "s";
        if (!isSave) return;
        e.preventDefault();
    });
});


// ==============================
// SEARCH FUNCTION (UPDATED)
// ==============================
async function search() {
    const query = document.getElementById("query").value.trim();

    if (!query) return;

    try {
        setSearchLoading(true);
        const q = encodeURIComponent(query);
        const res = await fetch(`http://127.0.0.1:8000/search?query=${q}&lang=${currentLang}&use_model=true`);
        const data = await res.json();

        displayResults(data);

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = "<p>Server error</p>";
    } finally {
        setSearchLoading(false);
    }
}

function setSearchLoading(isLoading) {
    const loadingEl = document.getElementById("searchLoading");
    const btn = document.getElementById("searchBtn");
    const input = document.getElementById("query");
    if (loadingEl) loadingEl.style.display = isLoading ? "flex" : "none";
    if (btn) btn.disabled = Boolean(isLoading);
    if (input) input.disabled = Boolean(isLoading);
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
        "kata kerja": "Verb",
        kerja: "Verb",
        verb: "Verb",
        "kata benda": "Noun",
        benda: "Noun",
        noun: "Noun",
        "kata sifat": "Adjective",
        sifat: "Adjective",
        adjective: "Adjective",
        "kata keterangan": "Adverb",
        keterangan: "Adverb",
        adverb: "Adverb",
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
    if (v === "kata keterangan" || v === "keterangan" || v === "adverb") return "adverb";
    return v;
}

function stripHtmlForDisplay(s) {
    return String(s == null ? "" : s)
        .replace(/<[^>]*>/g, "")
        .trim();
}

/**
 * Summary card (like Testing): query → dictionary match + word type & confidence per model.
 */
function buildSearchSummaryCardHtml(data) {
    const qRaw = String(data?.query || "").trim() || "—";
    const q = escapeHtml(qRaw);
    const rows = Array.isArray(data?.results) ? data.results : [];
    const top = rows[0];

    let transRows = "";
    if (!top) {
        transRows = `<div class="search-sum-row"><span class="search-sum-k">Dictionary match</span><span class="search-sum-v search-sum-muted">Not found</span></div>`;
    } else {
        const m = stripHtmlForDisplay(top.manado);
        const i = stripHtmlForDisplay(top.indonesia);
        const eng = stripHtmlForDisplay(top.inggris);
        if (currentLang === "manado") {
            transRows = `<div class="search-sum-row"><span class="search-sum-k">Translation (Indonesian)</span><span class="search-sum-v search-sum-em">${escapeHtml(i || "—")}</span></div>`;
        } else if (currentLang === "indonesia") {
            transRows = `<div class="search-sum-row"><span class="search-sum-k">Manado equivalent</span><span class="search-sum-v search-sum-em">${escapeHtml(m || "—")}</span></div>`;
        } else if (currentLang === "inggris") {
            transRows =
                `<div class="search-sum-row"><span class="search-sum-k">English</span><span class="search-sum-v">${escapeHtml(eng || "—")}</span></div>` +
                `<div class="search-sum-row"><span class="search-sum-k">Manado</span><span class="search-sum-v search-sum-em">${escapeHtml(m || "—")}</span></div>` +
                `<div class="search-sum-row"><span class="search-sum-k">Indonesian</span><span class="search-sum-v search-sum-em">${escapeHtml(i || "—")}</span></div>`;
        } else {
            transRows = `<div class="search-sum-row"><span class="search-sum-k">Match</span><span class="search-sum-v search-sum-em">${escapeHtml(i || m || "—")}</span></div>`;
        }
    }

    const analyses = Array.isArray(data?.model_analyses) ? data.model_analyses : [];

    function modelSummaryRow(displayLabel, algoKey) {
        const a = analyses.find((x) => String(x?.algorithm || "").toLowerCase().trim() === algoKey);
        if (!a) {
            return `<div class="search-sum-row"><span class="search-sum-k">Part of speech (${escapeHtml(displayLabel)})</span><span class="search-sum-v search-sum-muted">—</span></div>`;
        }
        if (!a.available) {
            const err = a.error ? escapeHtml(String(a.error).slice(0, 160)) : "Unavailable";
            return `<div class="search-sum-row"><span class="search-sum-k">Part of speech (${escapeHtml(displayLabel)})</span><span class="search-sum-v search-sum-muted">${err}</span></div>`;
        }
        const lab = a.label ? formatWordTypeLabel(a.label) : "—";
        const conf =
            a.confidence != null && Number.isFinite(Number(a.confidence))
                ? `${(Number(a.confidence) * 100).toFixed(0)}%`
                : "—";
        const ckpt = a.model_name ? escapeHtml(String(a.model_name)) : "";
        const ckptHtml = ckpt
            ? `<span class="search-sum-checkpoint" title="Checkpoint">${ckpt}</span>`
            : "";
        return `<div class="search-sum-row search-sum-row--stack">
            <span class="search-sum-k">Part of speech (${escapeHtml(displayLabel)})</span>
            <span class="search-sum-v">
              <span class="search-sum-mainline"><strong>${escapeHtml(lab)}</strong> <span class="search-sum-conf">(${escapeHtml(conf)})</span></span>
              ${ckptHtml}
            </span>
          </div>`;
    }

    const modelBlock =
        modelSummaryRow("IndoBERT", "indobert") +
        modelSummaryRow("mBERT", "mbert") +
        modelSummaryRow("XLM-R", "xlm-r-2");

    const modelHint =
        analyses.length === 0
            ? `<p class="search-summary-testing-hint">Model predictions are not available. Ensure IndoBERT, mBERT, and/or XLM-R (<code class="inline-code">xlm-r-2</code>) checkpoints exist on the server and the <code class="inline-code">models</code> table is populated.</p>`
            : "";

    return `
        <div class="search-summary-testing" role="region" aria-label="Search result overview">
          <div class="search-summary-testing-inner">
            <div class="search-sum-word">${q}</div>
            <div class="search-sum-arrow" aria-hidden="true">↓</div>
            <div class="search-sum-body">
              ${transRows}
              ${modelBlock}
            </div>
          </div>
          ${modelHint}
          <p class="search-summary-testing-note">Further down: full dictionary entries when available.</p>
        </div>`;
}

/**
 * Single collapsible: overview card + technical panels + consensus strip (all model-related UI).
 */
function mountCollapsibleModelInsights(container, data) {
    const summaryHtml = buildSearchSummaryCardHtml(data);
    const panelsHtml = buildAlgorithmPanelsHtml(data) || "";
    const consensusHtml = buildConsensusStripHtml(data) || "";

    const bodyHtml =
        summaryHtml +
        (panelsHtml ? `<div class="search-model-insights-panels-wrap">${panelsHtml}</div>` : "") +
        (consensusHtml ? `<div class="search-model-insights-consensus-wrap">${consensusHtml}</div>` : "");

    const html = `
<div class="search-model-insights-wrap">
  <div class="search-model-insights-card">
    <button type="button" class="search-model-insights-toggle" aria-expanded="false" aria-controls="search-model-insights-panel">
      <span class="search-model-insights-toggle-text">Show translation &amp; model output</span>
      <svg class="search-model-insights-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div id="search-model-insights-panel" class="search-model-insights-collapsible" role="region" aria-label="Translation and model classification">
      <div class="search-model-insights-collapsible-inner">
        ${bodyHtml}
      </div>
    </div>
  </div>
</div>`;
    container.insertAdjacentHTML("beforeend", html);
    const section = container.querySelector(".search-model-insights-wrap:last-of-type");
    if (!section) return;
    const btn = section.querySelector(".search-model-insights-toggle");
    const label = section.querySelector(".search-model-insights-toggle-text");
    const panel = section.querySelector("#search-model-insights-panel");
    if (!btn || !label) return;
    btn.addEventListener("click", () => {
        const open = section.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (panel) panel.setAttribute("aria-hidden", open ? "false" : "true");
        label.textContent = open
            ? "Hide translation & model output"
            : "Show translation & model output";
    });
    if (panel) panel.setAttribute("aria-hidden", "true");
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

/** One-line summary strip above the result list */
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

    mountCollapsibleModelInsights(container, data);

    if (!data.results || data.results.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-results-msg";
        empty.textContent =
            "No extra dictionary entries. Translation and model output are in the collapsible section above.";
        container.appendChild(empty);
        return;
    }

    const results = Array.isArray(data.results) ? data.results : [];
    const grouped = groupResultsByAlgorithmMatch(results);

    container.insertAdjacentHTML(
        "beforeend",
        `<div class="result-section-title result-section-title--dictionary">Dictionary entries — words &amp; translations</div>`,
    );

    renderResultGroup(container, data, "Matches both IndoBERT & mBERT", grouped.both);
    renderResultGroup(container, data, "Matches IndoBERT", grouped.indobertOnly);
    renderResultGroup(container, data, "Matches mBERT", grouped.mbertOnly);
    renderResultGroup(container, data, "Other matches", grouped.none);
}

function buildAlgorithmPanelsHtml(data) {
    const analyses = Array.isArray(data?.model_analyses) ? data.model_analyses : [];
    if (analyses.length === 0) return "";

    const cards = analyses
        .map((a) => {
            const title = escapeHtml(a?.display_name || a?.algorithm || "Model");
            const available = Boolean(a?.available);
            const label = a?.label ? escapeHtml(formatWordTypeLabel(a.label)) : "-";
            const conf =
                a?.confidence != null && Number.isFinite(Number(a.confidence))
                    ? `${(Number(a.confidence) * 100).toFixed(0)}%`
                    : "-";
            const modelName = a?.model_name ? escapeHtml(String(a.model_name)) : "-";
            const maxLen = a?.max_length_used != null ? escapeHtml(String(a.max_length_used)) : "-";
            const err = a?.error ? escapeHtml(String(a.error)) : "";
            const pill = available
                ? `<span class="algo-pill">${label} <span style="font-weight:600; opacity:.8">(${conf})</span></span>`
                : `<span class="algo-pill algo-pill--muted">Unavailable</span>`;

            const checkpointBlock = available
                ? `<p class="algo-panel-checkpoint"><span class="algo-panel-checkpoint-label">Checkpoint (trained_models folder)</span><span class="algo-panel-checkpoint-name">${modelName}</span></p><p class="algo-panel-meta"><strong>max_length:</strong> ${maxLen}</p>`
                : `<p class="algo-panel-meta algo-panel-meta--error">${err || "Model unavailable or failed to load."}</p>`;

            return `
              <div class="algo-panel">
                <p class="algo-panel-title">${title}</p>
                ${pill}
                ${checkpointBlock}
              </div>
            `;
        })
        .join("");

    return `<div class="algo-panels">${cards}</div>`;
}

function groupResultsByAlgorithmMatch(results) {
    const out = { both: [], indobertOnly: [], mbertOnly: [], none: [] };
    results.forEach((item) => {
        const mi = Boolean(item?.model_match_indobert);
        const mm = Boolean(item?.model_match_mbert);
        if (mi && mm) out.both.push(item);
        else if (mi) out.indobertOnly.push(item);
        else if (mm) out.mbertOnly.push(item);
        else out.none.push(item);
    });
    return out;
}

function renderResultGroup(container, data, title, items) {
    if (!items || items.length === 0) return;
    container.insertAdjacentHTML(
        "beforeend",
        `<div class="result-section-title">${escapeHtml(title)}</div>`,
    );
    items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const tooltipInner = buildConsensusTooltipHtml(data, item);
        const jenisRaw = String(item.jenis || "").replace(/<[^>]*>/g, "").trim();
        const jenisDisp = jenisRaw ? escapeHtml(formatWordTypeLabel(jenisRaw)) : "—";

        const matchBits = [];
        if (item.model_match_indobert) matchBits.push("POS matches IndoBERT");
        if (item.model_match_mbert) matchBits.push("POS matches mBERT");
        if (item.model_match_xlm) matchBits.push("POS matches XLM-R");
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
                    <p class="result-lemma">${item.manado}</p>
                    <p class="example">${item.kalimat_manado}</p>
                </div>

                <div class="result-section">
                    <strong>INDONESIA</strong>
                    <p class="result-lemma">${item.indonesia}</p>
                    <p class="example">${item.kalimat_indonesia}</p>
                </div>
            </div>
            <p class="result-entry-meta"><strong>Dictionary POS (this entry):</strong> ${jenisDisp}</p>

            <div class="score">
                ${item.method} | score: ${item.score}${item.model_match ? " | POS matches at least one model" : ""}${matchStr}
            </div>
        `;

        container.appendChild(card);
    });
}