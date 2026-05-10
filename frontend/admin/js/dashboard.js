// ==============================
// AUTH CHECK (PROTEKSI HALAMAN)
// ==============================

const isLoggedIn = localStorage.getItem("isLoggedIn");

if (!isLoggedIn) {
    window.location.href = "../../login/login.html";
}

// Pilihan alur utama (preprocess/train); jangan sampai tertimpa tab Evaluasi.
const WORKFLOW_ALGORITHM_KEY = "kamusWorkflowAlgorithm";

// ==============================
// ELEMENT
// ==============================

const buttons = document.querySelectorAll(".algo-btn");
const info = document.getElementById("selectedInfo");
const nextBtn = document.getElementById("nextBtn");

// ==============================
// LABEL MAP
// ==============================

const labelMap = {
    mbert: "mBERT",
    indobert: "IndoBERT",
    "xlm-r-2": "XLM-R",
    xlmr: "XLM-R",
    "xlm-r": "XLM-R",
    word2vec: "Word2Vec",
    glove: "GloVe"
};

// ==============================
// APPLY UI STATE
// ==============================

function applySelection(algo) {
    buttons.forEach(btn => {
        btn.classList.remove("active");

        if (btn.dataset.algo === algo) {
            btn.classList.add("active");
        }
    });

    info.innerText = "Selected algorithm: " + labelMap[algo];
    nextBtn.disabled = false;
}

// ==============================
// CLICK HANDLER
// ==============================

function persistDashboardAlgorithm(algo) {
    const v = String(algo || "").trim();
    if (!v) return;
    localStorage.setItem("selectedAlgorithm", v);
    localStorage.setItem(WORKFLOW_ALGORITHM_KEY, v);
}

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        /* getAttribute menghindari perbedaan dataset di beberapa lingkungan */
        const algo = btn.getAttribute("data-algo") || btn.dataset.algo || "";

        persistDashboardAlgorithm(algo);

        applySelection(algo);
    });
});

// ==============================
// INIT LOAD
// ==============================

window.onload = () => {
    let saved =
        localStorage.getItem(WORKFLOW_ALGORITHM_KEY) ||
        localStorage.getItem("selectedAlgorithm");
    if (saved === "xlmr" || saved === "xlm-r") {
        saved = "xlm-r-2";
    }
    if (saved) {
        persistDashboardAlgorithm(saved);
    }

    if (saved) {
        applySelection(saved);
    } else {
        info.innerText = "No algorithm selected yet.";
        nextBtn.disabled = true;
    }
};

// ==============================
// NEXT BUTTON VALIDATION
// ==============================

nextBtn.addEventListener("click", () => {
    const selected = localStorage.getItem("selectedAlgorithm");

    if (!selected) {
        alert("Please select an algorithm first!");
        return;
    }

    // Persist current selection
    console.log("Continue with algorithm:", selected);

    persistDashboardAlgorithm(selected);

    // Redirect to Data Collection
    window.location.href = "../pages/data-collection.html";
});