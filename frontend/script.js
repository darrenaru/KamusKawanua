// ==============================
// LANGUAGE STATE
// ==============================
let currentLang = "manado";
const MAX_SEARCH_WORDS = 2;
let lastResults = [];
let lastQuery = "";

function setSearchStatus(text, kind = "") {
    const el = document.getElementById("searchStatus");
    if (!el) return;
    el.classList.remove("status-loading", "status-error");
    if (kind === "loading") el.classList.add("status-loading");
    if (kind === "error") el.classList.add("status-error");
    el.textContent = text || "";
}

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

function countWords(text) {
    return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function hasValidWordLimit(text) {
    return countWords(text) <= MAX_SEARCH_WORDS;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function fetchSearchData(query) {
    const q = encodeURIComponent(query);
    const res = await fetch(
        `http://127.0.0.1:8000/search?query=${q}&lang=${currentLang}&use_model=true`
    );
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || "Gagal memproses pencarian");
    }
    return data;
}

async function generateCombinedSentenceIfTwoWords(query) {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length !== 2) return null;

    const [w1, w2] = words;
    const [d1, d2] = await Promise.all([fetchSearchData(w1), fetchSearchData(w2)]);
    const r1 = d1?.results?.[0];
    const r2 = d2?.results?.[0];
    if (!r1 || !r2) return null;

    const manadoWords = [stripTags(r1.manado), stripTags(r2.manado)].filter(Boolean).join(" ");
    const indonesiaWords = [stripTags(r1.indonesia), stripTags(r2.indonesia)].filter(Boolean).join(" ");

    if (!manadoWords || !indonesiaWords) return null;

    return {
        manadoSentence: `Contoh kalimat Manado: ${manadoWords}.`,
        indonesiaSentence: `Contoh kalimat Indonesia: ${indonesiaWords}.`,
        sourceWords: `${w1} + ${w2}`,
    };
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
    const queryInput = document.getElementById("query");
    const searchBtn = document.getElementById("searchBtn");

    queryInput.addEventListener("input", function () {
        const words = countWords(this.value);
        if (words > MAX_SEARCH_WORDS) {
            const trimmed = this.value.trim().split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS).join(" ");
            this.value = trimmed;
            setSearchStatus("Maksimal 2 kata.", "error");
        } else {
            setSearchStatus("");
        }
    });

    queryInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            search();
        }
    });

    queryInput.addEventListener("focus", () => setSearchStatus(""));
    if (searchBtn) searchBtn.disabled = false;
});


// ==============================
// SEARCH FUNCTION (UPDATED)
// ==============================
async function search() {
    const query = document.getElementById("query").value.trim();
    const container = document.getElementById("results");
    const searchBtn = document.getElementById("searchBtn");

    if (!query) return;
    if (!hasValidWordLimit(query)) {
        container.innerHTML = `<div class="empty-state">Maksimal input 2 kata.</div>`;
        setSearchStatus("Maksimal input 2 kata.", "error");
        return;
    }

    try {
        if (searchBtn) searchBtn.disabled = true;
        setSearchStatus("Sedang mencari padanan kata...", "loading");
        container.innerHTML = `<div class="empty-state">Sedang memproses pencarian...</div>`;
        lastQuery = query;
        const data = await fetchSearchData(query);
        const combinedSentence = await generateCombinedSentenceIfTwoWords(query);
        displayResults(data, combinedSentence);
        setSearchStatus(
            data?.results?.length
                ? `Ditemukan ${data.results.length} hasil`
                : "Belum ada hasil cocok"
        );

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = `<div class="empty-state">Server error. Coba lagi.</div>`;
        setSearchStatus(err.message || "Server error", "error");
    } finally {
        if (searchBtn) searchBtn.disabled = false;
    }
}


// ==============================
// DISPLAY RESULTS (UNCHANGED)
// ==============================
function displayResults(data, combinedSentence = null) {
    const container = document.getElementById("results");
    container.innerHTML = "";
    lastResults = Array.isArray(data?.results) ? data.results : [];

    if (combinedSentence) {
        const sentenceCard = document.createElement("div");
        sentenceCard.className = "result-card";
        sentenceCard.innerHTML = `
            <h3>Kalimat hasil gabungan 2 kata</h3>
            <p class="example">Sumber kata: ${escapeHtml(combinedSentence.sourceWords)}</p>
            <div class="result-grid">
                <div class="result-section">
                    <strong>MANADO</strong>
                    <p>${escapeHtml(combinedSentence.manadoSentence)}</p>
                </div>
                <div class="result-section">
                    <strong>INDONESIA</strong>
                    <p>${escapeHtml(combinedSentence.indonesiaSentence)}</p>
                </div>
            </div>
        `;
        container.appendChild(sentenceCard);
    }

    if (!data.results || data.results.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Tidak ditemukan";
        container.appendChild(empty);
        return;
    }

    data.results.forEach((item, idx) => {
        const card = document.createElement("div");
        card.className = "result-card";

        card.innerHTML = `
            <h3>${item.manado}</h3>

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
                ${item.method} | score: ${item.score}${item.model_match ? " | model match" : ""}
            </div>
            <div class="feedback-wrap">
                <button class="feedback-btn" onclick="toggleFeedback(${idx})">
                    Hasil masih salah? Kirim masukan
                </button>
                <div class="feedback-form" id="feedback-form-${idx}" style="display:none;">
                    <input id="fb-manado-${idx}" type="text" placeholder="Kata Manado yang benar" />
                    <input id="fb-indonesia-${idx}" type="text" placeholder="Kata Indonesia yang benar" />
                    <input id="fb-kalimat-manado-${idx}" type="text" placeholder="Contoh kalimat Manado" />
                    <input id="fb-kalimat-indonesia-${idx}" type="text" placeholder="Contoh kalimat Indonesia" />
                    <input id="fb-jenis-${idx}" type="text" placeholder="Jenis kata (opsional, mis. kata benda)" />
                    <input id="fb-note-${idx}" type="text" placeholder="Catatan kesalahan (opsional)" />
                    <button class="feedback-submit-btn" onclick="submitFeedback(${idx})">Kirim masukan</button>
                    <p id="fb-msg-${idx}" class="feedback-msg"></p>
                </div>
            </div>
        `;

        container.appendChild(card);
        prefillFeedback(idx, item);
    });
}

function stripTags(value) {
    return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function prefillFeedback(idx, item) {
    const manadoInput = document.getElementById(`fb-manado-${idx}`);
    const indonesiaInput = document.getElementById(`fb-indonesia-${idx}`);
    const kalimatManadoInput = document.getElementById(`fb-kalimat-manado-${idx}`);
    const kalimatIndonesiaInput = document.getElementById(`fb-kalimat-indonesia-${idx}`);
    const jenisInput = document.getElementById(`fb-jenis-${idx}`);

    if (manadoInput) manadoInput.value = stripTags(item?.manado);
    if (indonesiaInput) indonesiaInput.value = stripTags(item?.indonesia);
    if (kalimatManadoInput) kalimatManadoInput.value = stripTags(item?.kalimat_manado);
    if (kalimatIndonesiaInput) kalimatIndonesiaInput.value = stripTags(item?.kalimat_indonesia);
    if (jenisInput) jenisInput.value = stripTags(item?.jenis || "");
}

function toggleFeedback(idx) {
    const el = document.getElementById(`feedback-form-${idx}`);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
}

async function submitFeedback(idx) {
    const msg = document.getElementById(`fb-msg-${idx}`);
    const manado = document.getElementById(`fb-manado-${idx}`)?.value?.trim() || "";
    const indonesia = document.getElementById(`fb-indonesia-${idx}`)?.value?.trim() || "";
    const kalimatManado = document.getElementById(`fb-kalimat-manado-${idx}`)?.value?.trim() || "";
    const kalimatIndonesia = document.getElementById(`fb-kalimat-indonesia-${idx}`)?.value?.trim() || "";
    const jenis = document.getElementById(`fb-jenis-${idx}`)?.value?.trim() || "";
    const note = document.getElementById(`fb-note-${idx}`)?.value?.trim() || "";

    if (!manado || !indonesia) {
        if (msg) msg.textContent = "Kata Manado dan Indonesia wajib diisi.";
        return;
    }
    if (!kalimatManado && !kalimatIndonesia) {
        if (msg) msg.textContent = "Minimal satu contoh kalimat wajib diisi.";
        return;
    }

    if (msg) msg.textContent = "Mengirim masukan...";

    try {
        const res = await fetch("http://127.0.0.1:8000/feedback/dictionary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source_lang: currentLang,
                input_text: lastQuery,
                manado,
                indonesia,
                kalimat_manado: kalimatManado,
                kalimat_indonesia: kalimatIndonesia,
                jenis,
                note,
            }),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            throw new Error(data?.message || "Gagal kirim masukan");
        }
        if (msg) msg.textContent = "Terima kasih! Masukan kamu berhasil disimpan.";
    } catch (e) {
        if (msg) msg.textContent = `Gagal: ${e.message}`;
    }
}