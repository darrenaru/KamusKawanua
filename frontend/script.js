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
        const res = await fetch(`http://127.0.0.1:8000/search?query=${query}&lang=${currentLang}`);
        const data = await res.json();

        displayResults(data);

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = "<p>Server error</p>";
    }
}


// ==============================
// DISPLAY RESULTS (UNCHANGED)
// ==============================
function displayResults(data) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    if (!data.results || data.results.length === 0) {
        container.innerHTML = "<p>Tidak ditemukan</p>";
        return;
    }

    data.results.forEach(item => {
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
                ${item.method} | score: ${item.score}
            </div>
        `;

        container.appendChild(card);
    });
}