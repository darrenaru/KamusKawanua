// ==============================
// INIT LANGUAGE OUTPUT
// ==============================
function updateOutputOptions() {
    const inputLang = document.getElementById("inputLang").value;
    const output = document.getElementById("outputLang");

    if (inputLang === "manado") {
        output.value = "Indonesia - Inggris";
    } else if (inputLang === "indonesia") {
        output.value = "Manado - Inggris";
    } else {
        output.value = "Manado - Indonesia";
    }
}

document.addEventListener("DOMContentLoaded", updateOutputOptions);


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
// SEARCH FUNCTION
// ==============================
async function search() {
    const query = document.getElementById("query").value.trim();
    const inputLang = document.getElementById("inputLang").value;

    if (!query) return;

    try {
        const res = await fetch(`http://127.0.0.1:8000/search?query=${query}&lang=${inputLang}`);
        const data = await res.json();

        console.log("API RESPONSE FULL:", JSON.stringify(data, null, 2));

        displayResults(data);

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = "<p>Server error</p>";
    }
    console.log(data);
}


// ==============================
// SUPER ROBUST EXTRACTOR
// ==============================
function extractValue(data) {
    if (!data) return "";

    // kalau array
    if (Array.isArray(data)) {

        // cari semua string dalam array
        for (let item of data) {

            // nested array
            if (Array.isArray(item)) {
                for (let sub of item) {
                    if (typeof sub === "string" && sub.length > 1) {
                        return sub;
                    }
                }
            }

            // langsung string
            if (typeof item === "string" && item.length > 1) {
                return item;
            }
        }
    }

    // fallback kalau string langsung
    if (typeof data === "string") return data;

    return "";
}


// ==============================
// DISPLAY RESULTS
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

                <div class="result-section">
                    <strong>INGGRIS</strong>
                    <p>${item.inggris}</p>
                    <p class="example">${item.kalimat_inggris}</p>
                </div>
            </div>

            <div class="score">
                ${item.method} | score: ${item.score}
            </div>
        `;

        container.appendChild(card);
    });
}