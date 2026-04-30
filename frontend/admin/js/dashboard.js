// ==============================
// AUTH CHECK (PROTEKSI HALAMAN)
// ==============================

const isLoggedIn = localStorage.getItem("isLoggedIn");

if (!isLoggedIn) {
    window.location.href = "../../login/login.html";
}

// ==============================
// ELEMENT
// ==============================

const buttons = document.querySelectorAll(".algo-btn");
const info = document.getElementById("selectedInfo");
<<<<<<< HEAD
=======
const nextBtn = document.getElementById("nextBtn");
>>>>>>> 5389e9f (Initial commit)

// ==============================
// LABEL MAP
// ==============================

const labelMap = {
    mbert: "mBERT",
    indobert: "IndoBERT",
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

<<<<<<< HEAD
    info.innerText = "Algoritma dipilih: " + labelMap[algo];
=======
    info.innerText = "Selected algorithm: " + labelMap[algo];
>>>>>>> 5389e9f (Initial commit)
}

// ==============================
// CLICK HANDLER
// ==============================

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const algo = btn.dataset.algo;

        localStorage.setItem("selectedAlgorithm", algo);

        applySelection(algo);
    });
});

// ==============================
// INIT LOAD
// ==============================

window.onload = () => {
    const saved = localStorage.getItem("selectedAlgorithm");

    if (saved) {
        applySelection(saved);
    }
};
<<<<<<< HEAD
=======

// ==============================
// NEXT BUTTON VALIDATION
// ==============================

nextBtn.addEventListener("click", () => {
    const selected = localStorage.getItem("selectedAlgorithm");

    if (!selected) {
        alert("Select an algorithm first!");
        return;
    }

    // 🔥 SIMPAN STATE (SUDAH ADA)
    console.log("Continue dengan algoritma:", selected);

    // 🔥 REDIRECT KE DATA COLLECTION
    window.location.href = "../pages/data-collection.html";
});
>>>>>>> 5389e9f (Initial commit)
