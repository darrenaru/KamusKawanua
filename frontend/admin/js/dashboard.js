// ==============================
// AUTH CHECK (PROTEKSI HALAMAN)
// ==============================

const isLoggedIn = sessionStorage.getItem("isLoggedIn");

if (!isLoggedIn) {
    window.location.href = "../../login/login.html";
}

// ==============================
// ELEMENT
// ==============================

const buttons = document.querySelectorAll(".algo-btn");
const nextBtn = document.getElementById("nextBtn");

// ==============================
// LABEL MAP
// ==============================

const labelMap = {
    mbert: "mBERT",
    indobert: "IndoBERT",
    "xlm-r": "XLM-R",
    "xlm-r-2": "XLM-R",
    xlmr: "XLM-R",
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

    nextBtn.disabled = false;
}

// ==============================
// CLICK HANDLER
// ==============================

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const algo = btn.dataset.algo;

        sessionStorage.setItem("selectedAlgorithm", algo);

        applySelection(algo);
    });
});

// ==============================
// INIT LOAD
// ==============================

function normalizeStoredAlgorithmSelection(raw) {
    const k = String(raw || "").toLowerCase().trim().replace(/_/g, "-");
    if (k === "xlmr" || k === "xlm-r" || k === "xlm-r-2") return "xlm-r";
    return k;
}

window.onload = () => {
    if (typeof window.kamusInitXlmGeneration === "function") {
        void window.kamusInitXlmGeneration();
    }
    let saved = normalizeStoredAlgorithmSelection(
        sessionStorage.getItem("selectedAlgorithm")
    );
    if (saved === "xlmr" || saved === "xlm-r" || saved === "xlm-r-2") {
        saved = "xlm-r";
        sessionStorage.setItem("selectedAlgorithm", saved);
    }

    if (saved) {
        applySelection(saved);
    } else {
        sessionStorage.setItem("selectedAlgorithm", "indobert");
        applySelection("indobert");
    }
};

// ==============================
// NEXT BUTTON VALIDATION
// ==============================

nextBtn.addEventListener("click", () => {
    const selected = sessionStorage.getItem("selectedAlgorithm");

    if (!selected) {
        alert("Please select an algorithm first!");
        return;
    }

    // Persist current selection
    console.log("Continue with algorithm:", selected);

    // Redirect to Data Collection
    window.location.href = "../pages/data-collection.html";
});