(function () {
  "use strict";

  const SUPABASE_URL = "https://fhpjbkelhvopvfzykjne.supabase.co";
  const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGpia2VsaHZvcHZmenlram5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTQ2NTQsImV4cCI6MjA5MDk3MDY1NH0.xSUPwXaPCcO4uDi-rH1MdeaJCeJU56pwvLDEgVT_SDQ";

  let supabaseClient = null;
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  let selectedDataset = null;
  let selectedModel = null;
  let currentAlgo = "";
  let currentMode = "cari-rasio";
  let modelNameSaved = false;
  let trainingCounter = 0;

  // Variable untuk menyimpan parameter terbaik global
  let globalBestParams = null;
  let ratioComparisonData = {}; // Untuk menyimpan data perbandingan rasio
  let epochResultsData = []; // Untuk menyimpan hasil per epoch
  // ==================== RASIO DATA SPLIT MANAGER ====================
  let ratioData = [];
  let editingIndex = -1;
  let deletePendingIndex = -1;
  let confirmModal = null;

  function initRatioManager() {
    loadRatioFromLocalStorage();
    setupRatioEventListeners();
    updateRatioDropdown();
    updateRatioTableVisibility();
    createRatioConfirmModal();
  }

  function loadRatioFromLocalStorage() {
    const saved = localStorage.getItem("ratio_data_split");
    if (saved) {
      try {
        ratioData = JSON.parse(saved);
      } catch (e) {
        ratioData = []; // KOSONGKAN
      }
    } else {
      ratioData = []; // KOSONGKAN - tidak ada data default
    }
    renderRatioTable();
    updateRatioTableVisibility(); // TAMBAHKAN
  }

  function saveRatioToLocalStorage() {
    localStorage.setItem("ratio_data_split", JSON.stringify(ratioData));
  }

  function setupRatioEventListeners() {
    const trainInput = document.getElementById("train-input");
    const testInput = document.getElementById("test-input");
    const btnAddRatio = document.getElementById("btn-add-ratio");

    if (trainInput) {
      trainInput.addEventListener("input", function () {
        const trainVal = parseInt(this.value);
        if (!isNaN(trainVal) && trainVal >= 1 && trainVal <= 99) {
          if (!testInput.value || testInput.dataset.auto === "true") {
            testInput.value = 100 - trainVal;
            testInput.dataset.auto = "true";
          }
          this.classList.remove("error");
        } else if (this.value) {
          this.classList.add("error");
        }
      });
    }

    if (testInput) {
      testInput.addEventListener("input", function () {
        testInput.dataset.auto = "false";
        const testVal = parseInt(this.value);
        if (!isNaN(testVal) && testVal >= 1 && testVal <= 99) {
          this.classList.remove("error");
        } else if (this.value) {
          this.classList.add("error");
        }
      });
    }

    if (btnAddRatio) {
      btnAddRatio.addEventListener("click", handleAddOrUpdateRatio);
    }

    if (trainInput) {
      trainInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAddOrUpdateRatio();
      });
    }
    if (testInput) {
      testInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAddOrUpdateRatio();
      });
    }
  }

  function handleAddOrUpdateRatio() {
    const trainInput = document.getElementById("train-input");
    const testInput = document.getElementById("test-input");
    const trainVal = parseInt(trainInput.value);
    let testVal = parseInt(testInput.value);

    if (isNaN(trainVal) || trainVal < 1 || trainVal > 99) {
      showToast("Masukkan nilai Train yang valid (1-99)", "error");
      trainInput.classList.add("error");
      return;
    }

    if (isNaN(testVal)) {
      testVal = 100 - trainVal;
      testInput.value = testVal;
    }

    if (testVal < 1 || testVal > 99) {
      showToast("Nilai Test harus antara 1-99", "error");
      testInput.classList.add("error");
      return;
    }

    if (trainVal + testVal !== 100) {
      showToast(
        `Total Train + Test harus 100 (saat ini ${trainVal + testVal})`,
        "error",
      );
      trainInput.classList.add("error");
      testInput.classList.add("error");
      return;
    }

    const isDuplicate = ratioData.some(
      (item, idx) =>
        idx !== editingIndex &&
        item.train === trainVal &&
        item.test === testVal,
    );

    if (isDuplicate) {
      showToast("Rasio ini sudah ada di tabel", "error");
      return;
    }

    trainInput.classList.remove("error");
    testInput.classList.remove("error");

    if (editingIndex >= 0) {
      ratioData[editingIndex] = { train: trainVal, test: testVal };
      showToast(`Rasio ${trainVal}:${testVal} berhasil diperbarui`);
      editingIndex = -1;
      document.getElementById("btn-add-ratio").innerHTML = "➕ Tambah";
    } else {
      ratioData.push({ train: trainVal, test: testVal });
      showToast(`Rasio ${trainVal}:${testVal} berhasil ditambahkan`);
    }

    trainInput.value = "";
    testInput.value = "";
    testInput.dataset.auto = "true";

    saveRatioToLocalStorage();
    renderRatioTable();
    updateRatioDropdown();
    updateRatioTableVisibility();
  }

  function renderRatioTable() {
    const ratioTableBody = document.getElementById("ratio-table-body");
    if (!ratioTableBody) return;

    if (ratioData.length === 0) {
      ratioTableBody.innerHTML = "";
      updateRatioTableVisibility(); // TAMBAHKAN
      return;
    }

    ratioTableBody.innerHTML = ratioData
      .map(
        (item, index) => `
      <tr>
        <td><strong>${item.train}%</strong></td>
        <td><strong>${item.test}%</strong></td>
        <td>
          <button class="btn-edit" data-index="${index}">✏️ Ubah</button>
          <button class="btn-delete" data-index="${index}">🗑️ Hapus</button>
        </td>
      </tr>
    `,
      )
      .join("");

    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        editRatioByIndex(index);
      });
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        confirmDeleteRatio(index);
      });
    });
    updateRatioTableVisibility();
  }

  function editRatioByIndex(index) {
    const item = ratioData[index];
    if (!item) return;

    const trainInput = document.getElementById("train-input");
    const testInput = document.getElementById("test-input");

    trainInput.value = item.train;
    testInput.value = item.test;
    testInput.dataset.auto = "false";

    editingIndex = index;
    document.getElementById("btn-add-ratio").innerHTML = "💾 Simpan";
    trainInput.focus();
  }

  function confirmDeleteRatio(index) {
    deletePendingIndex = index;
    const item = ratioData[index];

    const modalP = confirmModal.querySelector("p");
    modalP.innerHTML = `Apakah Anda yakin ingin menghapus rasio <strong>${item.train}:${item.test}</strong>?`;
    confirmModal.style.display = "flex";
  }

  function deleteRatioByIndex(index) {
    if (index >= 0 && index < ratioData.length) {
      const deleted = ratioData[index];
      ratioData.splice(index, 1);

      saveRatioToLocalStorage();
      renderRatioTable();
      updateRatioDropdown();
      updateRatioTableVisibility();

      showToast(`Rasio ${deleted.train}:${deleted.test} dihapus`);

      if (editingIndex === index) {
        document.getElementById("train-input").value = "";
        document.getElementById("test-input").value = "";
        document.getElementById("test-input").dataset.auto = "true";
        editingIndex = -1;
        document.getElementById("btn-add-ratio").innerHTML = "➕ Tambah";
      } else if (editingIndex > index) {
        editingIndex--;
      }
    }
  }

  function updateRatioDropdown() {
    const splitSelect = document.getElementById("split-ratio-select");
    if (!splitSelect) return;

    const currentValue = splitSelect.value;
    let options =
      '<option value="" disabled selected>-- Pilih Rasio --</option>';

    ratioData.forEach((item) => {
      const ratioString = `${item.train}:${item.test}`;
      const selected = ratioString === currentValue ? "selected" : "";
      options += `<option value="${ratioString}" ${selected}>${ratioString}</option>`;
    });

    splitSelect.innerHTML = options;

    if (!currentValue || currentValue === "") {
      const defaultOption = ratioData.find(
        (r) => r.train === 80 && r.test === 20,
      );
      if (defaultOption) {
        splitSelect.value = "80:20";
      } else if (ratioData.length > 0) {
        splitSelect.value = `${ratioData[0].train}:${ratioData[0].test}`;
      }
    }
  }

  function updateRatioTableVisibility() {
    const ratioTableContainer = document.querySelector(
      ".ratio-table-container",
    );
    const ratioEmptyState = document.getElementById("ratio-empty-state");

    if (!ratioTableContainer || !ratioEmptyState) return;

    if (ratioData.length === 0) {
      ratioTableContainer.style.display = "none";
      ratioEmptyState.style.display = "block";
    } else {
      ratioTableContainer.style.display = "block";
      ratioEmptyState.style.display = "none";
    }
  }

  function createRatioConfirmModal() {
    confirmModal = document.createElement("div");
    confirmModal.className = "modal-confirm-overlay";
    confirmModal.innerHTML = `
      <div class="modal-confirm">
        <h4>⚠️ Konfirmasi Hapus</h4>
        <p>Apakah Anda yakin ingin menghapus rasio ini?</p>
        <div class="modal-confirm-actions">
          <button class="btn-confirm-cancel" id="btn-confirm-cancel">Batal</button>
          <button class="btn-confirm-delete" id="btn-confirm-delete">Hapus</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    document
      .getElementById("btn-confirm-cancel")
      .addEventListener("click", () => {
        confirmModal.style.display = "none";
        deletePendingIndex = -1;
      });

    document
      .getElementById("btn-confirm-delete")
      .addEventListener("click", () => {
        if (deletePendingIndex >= 0) {
          deleteRatioByIndex(deletePendingIndex);
        }
        confirmModal.style.display = "none";
        deletePendingIndex = -1;
      });

    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) {
        confirmModal.style.display = "none";
        deletePendingIndex = -1;
      }
    });
  }

  window.editRatio = function (btn) {
    const row = btn.closest("tr");
    const cells = row.querySelectorAll("td");
    const trainVal = parseInt(cells[0].innerText);
    const testVal = parseInt(cells[1].innerText);

    const index = ratioData.findIndex(
      (item) => item.train === trainVal && item.test === testVal,
    );
    if (index >= 0) {
      editRatioByIndex(index);
    }
  };

  window.deleteRatio = function (btn) {
    const row = btn.closest("tr");
    const cells = row.querySelectorAll("td");
    const trainVal = parseInt(cells[0].innerText);
    const testVal = parseInt(cells[1].innerText);

    const index = ratioData.findIndex(
      (item) => item.train === trainVal && item.test === testVal,
    );
    if (index >= 0) {
      confirmDeleteRatio(index);
    }
  };

  // ==================== END RASIO MANAGER ====================

  document.addEventListener("DOMContentLoaded", function () {
    const algoSelect = document.getElementById("algo-select");
    const modelSelect = document.getElementById("model-select");
    const modeRadios = document.querySelectorAll('input[name="training-mode"]');
    const manualBtn = document.getElementById("manual-btn");
    const btnSimpanNama = document.getElementById("btn-simpan-nama");

    initRatioManager();

    algoSelect.addEventListener("change", onAlgoChange);
    modelSelect.addEventListener("change", onModelSelectChange);
    modeRadios.forEach((radio) =>
      radio.addEventListener("change", onModeChange),
    );
    manualBtn.addEventListener(
      "click",
      () => (document.getElementById("modal-manual").style.display = "flex"),
    );

    if (btnSimpanNama) {
      btnSimpanNama.addEventListener("click", simpanNamaModel);
    }

    document
      .getElementById("dataset-list")
      .addEventListener("click", function (e) {
        const li = e.target.closest("li");
        if (!li) return;
        document
          .querySelectorAll("#dataset-list li")
          .forEach((el) => el.classList.remove("selected"));
        li.classList.add("selected");
      });

    document
      .getElementById("model-list")
      .addEventListener("click", function (e) {
        const li = e.target.closest("li");
        if (!li) return;
        document
          .querySelectorAll("#model-list li")
          .forEach((el) => el.classList.remove("selected"));
        li.classList.add("selected");
        selectedModel = li;
      });

    const trainingCardsContainer = document.getElementById(
      "training-cards-container",
    );
    if (trainingCardsContainer) {
      trainingCardsContainer.addEventListener("click", function (e) {
        if (
          e.target.classList.contains("btn-remove-training") ||
          e.target.closest(".btn-remove-training")
        ) {
          const card = e.target.closest(".training-card");
          if (card) {
            card.remove();
            showToast("🗑️ Hasil training dihapus");
          }
        }

        // Tombol "Gunakan Rasio Terbaik" di dalam card
        if (
          e.target.classList.contains("btn-gunakan-terbaik-card") ||
          e.target.closest(".btn-gunakan-terbaik-card")
        ) {
          const button = e.target.closest(".btn-gunakan-terbaik-card");
          const card = button.closest(".training-card");
          gunakanRasioTerbaik(card);
        }

        if (
          e.target.classList.contains("btn-simpan-card") ||
          e.target.closest(".btn-simpan-card")
        ) {
          const card = e.target.closest(".training-card");
          saveModelFromCard(card);
        }
      });
    }
  });

  function simpanNamaModel() {
    const namaModelInput = document.getElementById("new-model-name");
    const namaModel = namaModelInput.value.trim();

    if (!namaModel) {
      showToast("⚠️ Masukkan nama model terlebih dahulu");
      return;
    }

    modelNameSaved = true;

    const nameCard = document.getElementById("new-model-name-card");
    nameCard.innerHTML = `
      <p class="file-card-label">📝 Nama Model</p>
      <p class="file-card-name" style="flex:1;">${namaModel}</p>
      <button class="btn-small" id="btn-edit-nama" style="padding:8px 16px; margin-left:10px; background:transparent; color:#2c1f0e; border:1px solid #2c1f0e; border-radius:6px; cursor:pointer;">Edit</button>
    `;

    document
      .getElementById("btn-edit-nama")
      .addEventListener("click", function () {
        nameCard.innerHTML = `
        <p class="file-card-label">📝 Nama Model Baru</p>
        <input type="text" id="new-model-name" placeholder="Masukkan nama model baru" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${namaModel}">
        <button class="btn-small" id="btn-simpan-nama" style="padding:8px 16px; margin-left:10px; background:#2c1f0e; color:white; border:none; border-radius:6px; cursor:pointer;">Simpan</button>
      `;
        document
          .getElementById("btn-simpan-nama")
          .addEventListener("click", simpanNamaModel);
        modelNameSaved = false;
      });

    showToast("✅ Nama model berhasil disimpan");
  }

  function onAlgoChange(e) {
    currentAlgo = e.target.value;

    if (globalBestParams && globalBestParams.algo === currentAlgo) {
      renderParameters(currentMode, () => {
        updateRatioDropdown();
        fillParametersFromGlobalBest();
      });
    } else {
      renderParameters(currentMode);
    }
  }

  function onModeChange(e) {
    currentMode = e.target.value;
    const paramCardCari = document.getElementById("param-card-cari-rasio");
    const paramCardFinal = document.getElementById("param-card-training-final");
    const ratioSection = document.querySelector(".ratio-section");
    const comparisonSection = document.getElementById(
      "ratio-comparison-section",
    );
    const bestParamsDisplay = document.getElementById("best-params-display");
    const trainingCardsContainer = document.getElementById(
      "training-cards-container",
    );

    if (currentMode === "cari-rasio") {
      paramCardCari.style.display = "block";
      paramCardFinal.style.display = "none";

      if (ratioSection) {
        ratioSection.style.opacity = "1";
        ratioSection.style.pointerEvents = "all";
      }

      if (comparisonSection) {
        comparisonSection.style.display =
          Object.keys(ratioComparisonData).length > 0 ? "block" : "none";
      }

      if (bestParamsDisplay) {
        bestParamsDisplay.style.display = globalBestParams ? "block" : "none";
      }

      // 🔧 Tampilkan container training cards
      if (trainingCardsContainer) {
        trainingCardsContainer.style.display = "flex";
      }
    } else {
      // Mode: Training Final
      paramCardCari.style.display = "none";
      paramCardFinal.style.display = "block";

      // 🔧 RESET training counter ke 0 untuk Training Final
      trainingCounter = 0;

      if (ratioSection) {
        ratioSection.style.opacity = "0.9";
        ratioSection.style.pointerEvents = "none";
      }

      if (comparisonSection) {
        comparisonSection.style.display = "none";
      }

      if (bestParamsDisplay) {
        bestParamsDisplay.style.display = "none";
      }

      // 🔧 JANGAN SEMBUNYIKAN container! Biarkan tetap flex
      // Tapi hapus isinya (card lama dari mode cari-rasio)
      if (trainingCardsContainer) {
        // Hapus semua card lama (hasil pencarian rasio)
        trainingCardsContainer.innerHTML = "";
        trainingCardsContainer.style.display = "flex";
      }
    }

    renderParameters(currentMode, () => {
      if (currentMode === "training-final" && globalBestParams) {
        updateRatioDropdown();
        fillParametersFromGlobalBest();
      }

      if (currentMode === "training-final") {
        renderHistoryTable();
      }
    });
  }

  function onModelSelectChange(e) {
    const value = e.target.value;
    const datasetCard = document.getElementById("dataset-card");
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");

    if (value === "baru") {
      document.getElementById("modal-dataset").style.display = "flex";
      datasetCard.style.display = "none";
      modelCard.style.display = "none";
      newModelNameCard.style.display = "flex";
      modelNameSaved = false;

      newModelNameCard.innerHTML = `
      <p class="file-card-label">📝 New Model Name</p>
      <input type="text" id="new-model-name" placeholder="Enter new model name" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;">
      <button class="btn-small" id="btn-simpan-nama" style="padding:8px 16px; margin-left:10px; background:#2c1f0e; color:white; border:none; border-radius:6px; cursor:pointer;">Save</button>
    `;
      document
        .getElementById("btn-simpan-nama")
        .addEventListener("click", simpanNamaModel);
    } else if (value === "lama") {
      document.getElementById("modal-lama").style.display = "flex";
      datasetCard.style.display = "none";
      modelCard.style.display = "flex";
      newModelNameCard.style.display = "none";
    }
  }

  function renderParameters(mode, callback) {
    const container =
      mode === "cari-rasio"
        ? document.getElementById("dynamic-params-cari-rasio")
        : document.getElementById("dynamic-params-training-final");

    const otherContainer =
      mode === "cari-rasio"
        ? document.getElementById("dynamic-params-training-final")
        : document.getElementById("dynamic-params-cari-rasio");
    if (otherContainer) otherContainer.innerHTML = "";

    if (!currentAlgo) {
      container.innerHTML =
        '<p style="color:#999; text-align:center; padding:20px;">Pilih algoritma terlebih dahulu</p>';
      if (callback) setTimeout(callback, 150);
      return;
    }

    let html = generateSplitValidationParams();

    switch (currentAlgo) {
      case "indobert":
        html += generateIndoBERTParams();
        break;
      case "mbert":
        html += generateMBERTParams();
        break;
      case "xlm-r":
        html += generateXLMRParams();
        break;
      case "glove":
        html += generateGloVEParams();
        break;
      case "word2vec":
        html += generateWord2VecParams();
        break;
    }

    container.innerHTML = html;
    attachParamEvents();

    // 🔧 TAMBAHKAN: Panggil callback setelah render
    if (callback) {
      setTimeout(callback, 150);
    }
  }

  // SESUDAH
  function fillParametersFromGlobalBest() {
    if (!globalBestParams) return;
    const params = globalBestParams;

    // ✅ FIX: Scope ke container mode yang sedang aktif
    const activeContainerId =
      currentMode === "training-final"
        ? "dynamic-params-training-final"
        : "dynamic-params-cari-rasio";
    const activeContainer = document.getElementById(activeContainerId);

    // Helper: cari elemen di dalam container aktif saja
    function getField(id) {
      return activeContainer
        ? activeContainer.querySelector("#" + id)
        : document.getElementById(id);
    }

    if (params.splitRatio) {
      const splitSelect = getField("split-ratio-select");
      if (splitSelect) splitSelect.value = params.splitRatio;
    }

    const fieldMappings = [
      { id: "lr", key: "lr" },
      { id: "epoch", key: "epoch" },
      { id: "batch-size", key: "batchSize" },
      { id: "max-length", key: "maxLength" },
      { id: "optimizer", key: "optimizer" },
      { id: "weight-decay", key: "weightDecay" },
      { id: "scheduler", key: "scheduler" },
      { id: "warmup", key: "warmup" },
      { id: "dropout", key: "dropout" },
      { id: "early-stopping", key: "earlyStopping" },
      { id: "grad-accum", key: "gradAccum" },
      { id: "vector-size", key: "vectorSize" },
      { id: "window-size", key: "windowSize" },
      { id: "min-count", key: "minCount" },
      { id: "model-type", key: "modelType" },
      { id: "negative", key: "negative" },
      { id: "x-max", key: "xMax" },
      { id: "alpha", key: "alpha" },
    ];

    fieldMappings.forEach((mapping) => {
      const element = getField(mapping.id);
      const value = params[mapping.key];
      if (element && value !== undefined && value !== null && value !== "") {
        element.value = value;
      }
    });
  }

  function fillParametersFromModel(modelData) {
    // 🔧 Scope ke container mode yang sedang aktif
    const activeContainerId =
      currentMode === "training-final"
        ? "dynamic-params-training-final"
        : "dynamic-params-cari-rasio";
    const activeContainer = document.getElementById(activeContainerId);

    // Helper: cari elemen di dalam container aktif saja
    function getField(id) {
      return activeContainer
        ? activeContainer.querySelector("#" + id)
        : document.getElementById(id);
    }

    // Set rasio dropdown
    if (modelData.ratio) {
      const splitSelect = getField("split-ratio-select");
      if (splitSelect) {
        splitSelect.value = modelData.ratio;
        console.log(`✅ split-ratio-select diisi: ${modelData.ratio}`);
      } else {
        console.log("❌ split-ratio-select tidak ditemukan");
      }
    }

    // Field mappings
    const fieldMappings = [
      { attr: "lr", id: "lr" },
      { attr: "epoch", id: "epoch" },
      { attr: "batch", id: "batch-size" },
      { attr: "maxlen", id: "max-length" },
      { attr: "optimizer", id: "optimizer" },
      { attr: "weightDecay", id: "weight-decay" },
      { attr: "scheduler", id: "scheduler" },
      { attr: "warmup", id: "warmup" },
      { attr: "dropout", id: "dropout" },
      { attr: "earlyStopping", id: "early-stopping" },
      { attr: "gradAccum", id: "grad-accum" },
      { attr: "vectorSize", id: "vector-size" },
      { attr: "windowSize", id: "window-size" },
      { attr: "minCount", id: "min-count" },
      { attr: "modelType", id: "model-type" },
      { attr: "negative", id: "negative" },
      { attr: "xMax", id: "x-max" },
      { attr: "alpha", id: "alpha" },
    ];

    fieldMappings.forEach((mapping) => {
      const element = getField(mapping.id);
      const value = modelData[mapping.attr];

      if (element && value !== undefined && value !== null && value !== "") {
        element.value = value;
        console.log(`✅ ${mapping.id} diisi: ${value}`);
      } else if (element) {
        console.log(`⚠️ ${mapping.id} value kosong:`, value);
      } else {
        console.log(`❌ ${mapping.id} tidak ditemukan`);
      }
    });
  }

  function generateSplitValidationParams() {
    return `
    <div class="param-row">
      <div class="param-group" style="grid-column: span 2;">
        <label>Rasio Data Split</label>
        <select id="split-ratio-select" class="split-select">
          <option value="" disabled selected>-- Pilih Rasio --</option>
        </select>
      </div>
    </div>
  `;
  }

  // ==================== INDOBERT PARAMETERS (DROPDOWN) ====================
  function generateIndoBERTParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="lr-options">
          <option value="1e-5">1e-5</option>
          <option value="2e-5">2e-5 (Recommended)</option>
          <option value="3e-5">3e-5</option>
          <option value="5e-5">5e-5</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 3" value="" min="1" max="100">
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Batch Size</label>
        <input type="text" id="batch-size" list="batch-size-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="batch-size-options">
          <option value="8">8</option>
          <option value="16">16 (Recommended)</option>
          <option value="32">32</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Max Length</label>
        <input type="text" id="max-length" list="max-length-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="max-length-options">
          <option value="8">8</option>
          <option value="16">16 (Recommended)</option>
          <option value="32">32</option>
          <option value="64">64</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Optimizer</label>
        <input type="text" id="optimizer" list="optimizer-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="optimizer-options">
          <option value="AdamW">AdamW (Recommended)</option>
          <option value="Adam">Adam</option>
          <option value="SGD">SGD</option>
          <option value="RMSProp">RMSProp</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Weight Decay</label>
        <input type="text" id="weight-decay" list="weight-decay-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="weight-decay-options">
          <option value="0.0">0.0</option>
          <option value="0.01">0.01 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Scheduler</label>
        <input type="text" id="scheduler" list="scheduler-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="scheduler-options">
          <option value="linear">Linear (Recommended)</option>
          <option value="cosine">Cosine</option>
          <option value="step">Step</option>
          <option value="exponential">Exponential</option>
          <option value="constant">Constant</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Dropout</label>
        <input type="text" id="dropout" list="dropout-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="dropout-options">
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
          <option value="0.3">0.3</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Early Stopping</label>
        <input type="text" id="early-stopping" list="early-stopping-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="early-stopping-options">
          <option value="0">Nonaktif</option>
          <option value="2">Aktif (patience 2) (Recommended)</option>
          <option value="3">Aktif (patience 3)</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Gradient Accumulation</label>
        <input type="text" id="grad-accum" list="grad-accum-options" placeholder="Pilih atau ketik manual" value="">
        <datalist id="grad-accum-options">
          <option value="1">1 (Recommended)</option>
          <option value="2">2</option>
          <option value="4">4</option>
        </datalist>
      </div>
    </div>
  `;
  }

  // ==================== mBERT PARAMETERS  ====================
  // ==================== mBERT PARAMETERS (DATALIST) ====================
  function generateMBERTParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="lr-options-mbert">
          <option value="1e-5">1e-5</option>
          <option value="2e-5">2e-5 (Recommended)</option>
          <option value="3e-5">3e-5</option>
          <option value="5e-5">5e-5</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 4 (Range: 2–5)" value="" min="1" max="100">
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Batch Size</label>
        <input type="text" id="batch-size" list="batch-size-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="batch-size-options-mbert">
          <option value="8">8</option>
          <option value="16">16 (Recommended)</option>
          <option value="32">32</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Max Length</label>
        <input type="text" id="max-length" list="max-length-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="max-length-options-mbert">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32">32 (Recommended)</option>
          <option value="64">64</option>
          <option value="128">128</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Optimizer</label>
        <input type="text" id="optimizer" list="optimizer-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="optimizer-options-mbert">
          <option value="AdamW">AdamW (Recommended)</option>
          <option value="Adam">Adam</option>
          <option value="SGD">SGD</option>
          <option value="RMSProp">RMSProp</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Weight Decay</label>
        <input type="text" id="weight-decay" list="weight-decay-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="weight-decay-options-mbert">
          <option value="0.0">0.0</option>
          <option value="0.01">0.01 (Recommended)</option>
          <option value="0.05">0.05</option>
          <option value="0.1">0.1</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Scheduler</label>
        <input type="text" id="scheduler" list="scheduler-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="scheduler-options-mbert">
          <option value="linear">Linear (Recommended)</option>
          <option value="cosine">Cosine</option>
          <option value="step">Step</option>
          <option value="exponential">Exponential</option>
          <option value="constant">Constant</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Warmup Ratio</label>
        <input type="text" id="warmup" list="warmup-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="warmup-options-mbert">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
          <option value="0.3">0.3</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Dropout</label>
        <input type="text" id="dropout" list="dropout-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="dropout-options-mbert">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
          <option value="0.3">0.3</option>
          <option value="0.5">0.5</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Early Stopping</label>
        <input type="text" id="early-stopping" list="early-stopping-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="early-stopping-options-mbert">
          <option value="0">Nonaktif</option>
          <option value="2">2</option>
          <option value="3">3 (Recommended)</option>
          <option value="5">5</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Gradient Accumulation</label>
        <input type="text" id="grad-accum" list="grad-accum-options-mbert" placeholder="Pilih atau ketik manual" value="">
        <datalist id="grad-accum-options-mbert">
          <option value="1">1 (Recommended)</option>
          <option value="2">2</option>
          <option value="4">4</option>
        </datalist>
      </div>
    </div>
  `;
  }

  // ==================== XLM-R PARAMETERS (DROPDOWN + INPUT MANUAL) ====================
  // ==================== XLM-R PARAMETERS (DATALIST) ====================
  function generateXLMRParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="lr-options-xlmr">
          <option value="1e-5">1e-5 (Recommended)</option>
          <option value="1.5e-5">1.5e-5</option>
          <option value="2e-5">2e-5</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 3 (Range: 3–5)" value="" min="1" max="100">
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Batch Size</label>
        <input type="text" id="batch-size" list="batch-size-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="batch-size-options-xlmr">
          <option value="8">8 (Recommended)</option>
          <option value="16">16</option>
          <option value="32">32</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Max Length</label>
        <input type="text" id="max-length" list="max-length-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="max-length-options-xlmr">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32">32 (Recommended)</option>
          <option value="64">64</option>
          <option value="128">128</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Optimizer</label>
        <input type="text" id="optimizer" list="optimizer-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="optimizer-options-xlmr">
          <option value="AdamW">AdamW (Recommended)</option>
          <option value="Adam">Adam</option>
          <option value="SGD">SGD</option>
          <option value="RMSProp">RMSProp</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Weight Decay</label>
        <input type="text" id="weight-decay" list="weight-decay-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="weight-decay-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.01">0.01 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Scheduler</label>
        <input type="text" id="scheduler" list="scheduler-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="scheduler-options-xlmr">
          <option value="linear">Linear (Recommended)</option>
          <option value="cosine">Cosine</option>
          <option value="step">Step</option>
          <option value="exponential">Exponential</option>
          <option value="constant">Constant</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Warmup Steps</label>
        <input type="text" id="warmup" list="warmup-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="warmup-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Dropout</label>
        <input type="text" id="dropout" list="dropout-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="dropout-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
          <option value="0.3">0.3</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Early Stopping</label>
        <input type="text" id="early-stopping" list="early-stopping-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="early-stopping-options-xlmr">
          <option value="0">Nonaktif</option>
          <option value="2">2 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Gradient Accumulation</label>
        <input type="text" id="grad-accum" list="grad-accum-options-xlmr" placeholder="Pilih atau ketik manual" value="">
        <datalist id="grad-accum-options-xlmr">
          <option value="1">1 (Recommended)</option>
          <option value="2">2</option>
          <option value="4">4</option>
        </datalist>
      </div>
    </div>
  `;
  }

  // ==================== Word2Vec PARAMETERS (DATALIST) ====================
  function generateWord2VecParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        <label>Vector Size</label>
        <input type="text" id="vector-size" list="vector-size-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="vector-size-options-w2v">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Window Size</label>
        <input type="text" id="window-size" list="window-size-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="window-size-options-w2v">
          <option value="3">3</option>
          <option value="5">5 (Recommended)</option>
          <option value="7">7</option>
          <option value="10">10</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Min Count</label>
        <input type="text" id="min-count" list="min-count-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="min-count-options-w2v">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="lr-options-w2v">
          <option value="0.01">0.01</option>
          <option value="0.025">0.025 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        <label>Model Type</label>
        <input type="text" id="model-type" list="model-type-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="model-type-options-w2v">
          <option value="skip-gram">Skip-gram (Recommended)</option>
          <option value="cbow">CBOW</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Negative Sampling</label>
        <input type="text" id="negative" list="negative-options-w2v" placeholder="Pilih atau ketik manual" value="">
        <datalist id="negative-options-w2v">
          <option value="3">3</option>
          <option value="5">5 (Recommended)</option>
          <option value="10">10</option>
          <option value="15">15</option>
        </datalist>
      </div>
      <div class="param-group"></div>
    </div>
  `;
  }

  // ==================== GloVe PARAMETERS (DATALIST) ====================
  function generateGloVEParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        <label>Vector Size</label>
        <input type="text" id="vector-size" list="vector-size-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="vector-size-options-glove">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Window Size</label>
        <input type="text" id="window-size" list="window-size-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="window-size-options-glove">
          <option value="3">3</option>
          <option value="5">5 (Recommended)</option>
          <option value="7">7</option>
          <option value="10">10</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Min Count</label>
        <input type="text" id="min-count" list="min-count-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="min-count-options-glove">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="lr-options-glove">
          <option value="0.01">0.01</option>
          <option value="0.05">0.05 (Recommended)</option>
          <option value="0.1">0.1</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        <label>X_max</label>
        <input type="text" id="x-max" list="x-max-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="x-max-options-glove">
          <option value="50">50</option>
          <option value="100">100 (Recommended)</option>
          <option value="200">200</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        <label>Alpha</label>
        <input type="text" id="alpha" list="alpha-options-glove" placeholder="Pilih atau ketik manual" value="">
        <datalist id="alpha-options-glove">
          <option value="0.5">0.5</option>
          <option value="0.75">0.75 (Recommended)</option>
          <option value="1.0">1.0</option>
        </datalist>
      </div>
      <div class="param-group"></div>
    </div>
  `;
  }

  function attachParamEvents() {
    setTimeout(() => updateRatioDropdown(), 100);
    attachValidation();
  }

  function attachValidation() {
    // Tidak diperlukan validasi khusus untuk dropdown
  }

  window.pilihDataset = function () {
    const selected = document.querySelector("#dataset-list li.selected");

    if (!selected) {
      showToast("⚠️ Pilih dataset terlebih dahulu");
      return;
    }

    const datasetName = selected.innerText.trim();
    document.getElementById("dataset-card-name").innerText = datasetName;
    document.getElementById("dataset-card").style.display = "flex";

    const modelSelect = document.getElementById("model-select");
    modelSelect.value = "baru";

    const ratio = selected.dataset.ratio;
    const kfold = selected.dataset.kfold;

    setTimeout(() => {
      if (ratio) {
        const splitSelect = document.getElementById("split-ratio-select");
        if (splitSelect) splitSelect.value = ratio;
      }
    }, 100);

    closeModalDataset();
    showToast("✅ Dataset berhasil dipilih");
  };

  window.closeModalLama = function () {
    const modal = document.getElementById("modal-lama");
    modal.style.display = "none";

    if (selectedModel) {
      const modelName = selectedModel.innerText.trim();
      document.getElementById("model-card-name").innerText = modelName;
      document.getElementById("model-card").style.display = "flex";

      const modelSelect = document.getElementById("model-select");
      modelSelect.value = "lama";

      const algo = selectedModel.dataset.algo;
      if (algo) {
        document.getElementById("algo-select").value = algo;
        currentAlgo = algo;

        // 🔧 Render parameters dengan callback
        renderParameters(currentMode, () => {
          // 🔧 Tambah delay untuk memastikan DOM siap
          setTimeout(() => {
            // Kumpulkan data model dari dataset
            const modelData = {
              ratio: selectedModel.dataset.ratio,
              kfold: selectedModel.dataset.kfold,
              lr: selectedModel.dataset.lr,
              epoch: selectedModel.dataset.epoch,
              batch: selectedModel.dataset.batch,
              maxlen: selectedModel.dataset.maxlen,
              optimizer: selectedModel.dataset.optimizer,
              weightDecay: selectedModel.dataset.weightDecay,
              scheduler: selectedModel.dataset.scheduler,
              warmup: selectedModel.dataset.warmup,
              dropout: selectedModel.dataset.dropout,
              earlyStopping: selectedModel.dataset.earlyStopping,
              gradAccum: selectedModel.dataset.gradAccum,
              vectorSize: selectedModel.dataset.vectorSize,
              windowSize: selectedModel.dataset.windowSize,
              minCount: selectedModel.dataset.minCount,
              modelType: selectedModel.dataset.modelType,
              negative: selectedModel.dataset.negative,
              xMax: selectedModel.dataset.xMax,
              alpha: selectedModel.dataset.alpha,
            };

            // 🔧 Panggil fungsi untuk mengisi parameter
            fillParametersFromModel(modelData);

            // 🔧 Update dropdown rasio
            updateRatioDropdown();

            // 🔧 Set dropdown rasio jika ada
            if (modelData.ratio) {
              const splitSelect = document.getElementById("split-ratio-select");
              if (splitSelect) splitSelect.value = modelData.ratio;
            }

            showToast(`✅ Model "${modelName}" berhasil dimuat!`, "success");
          }, 150);
        });
      }
    }

    document
      .querySelectorAll("#model-list li")
      .forEach((el) => el.classList.remove("selected"));
    selectedModel = null;
  };

  window.closeManualBook = function () {
    document.getElementById("modal-manual").style.display = "none";
  };

  document.addEventListener("click", function (e) {
    if (e.target.id === "btn-mulai-cari") {
      startTraining("cari-rasio");
    } else if (e.target.id === "btn-mulai-training") {
      startTraining("training-final");
    }
  });

  function createTrainingCard(mode, params) {
    const template = document.getElementById("training-card-template");
    const cardContent = template.content.cloneNode(true);
    const card = cardContent.querySelector(".training-card");

    trainingCounter++;
    card.dataset.trainingId = `training-${trainingCounter}`;
    card.dataset.mode = mode;
    card.dataset.ratioKey = params.splitRatio;

    // Set training number di judul
    const trainingNumberSpan = card.querySelector(".training-number");
    if (trainingNumberSpan) {
      trainingNumberSpan.innerText = trainingCounter;
    }

    // 🔧 PERBAIKAN: Set judul berdasarkan mode
    const title = card.querySelector(".training-title");
    if (title) {
      if (mode === "cari-rasio") {
        title.innerHTML = `#<span class="training-number">${trainingCounter}</span> Best Ratio Search`;
      } else {
        // Mode training-final
        const trainingName =
          document.getElementById("training-name")?.value || "Training";
        title.innerHTML = `🎯 ${trainingName} - Final Training`;
      }
    }

    // Set rasio display di hasil section
    const ratioDisplay = card.querySelector(".result-ratio-display");
    if (ratioDisplay) {
      ratioDisplay.innerText = params.splitRatio || "80:20";
    }

    // Set info parameter
    const paramsInfo = card.querySelector(".training-params-info");
    if (paramsInfo) {
      const splitRatio = params.splitRatio || "80:20";
      const lrDisplay = params.lr || "-";
      const epochDisplay = params.epoch || "-";
      const batchDisplay = params.batchSize || "-";
      const maxLenDisplay = params.maxLength || "-";
      const optimizerDisplay = params.optimizer || "-";

      paramsInfo.innerHTML = `
      <strong>Split:</strong> ${splitRatio} | 
      <strong>LR:</strong> ${lrDisplay} | 
      <strong>Epoch:</strong> ${epochDisplay} | 
      <strong>Batch:</strong> ${batchDisplay} | 
      <strong>MaxLen:</strong> ${maxLenDisplay} | 
      <strong>Optimizer:</strong> ${optimizerDisplay}
    `;
    }

    // 🔧 SEMBUNYIKAN tombol "Gunakan Rasio Terbaik" untuk mode training-final
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    if (btnGunakanTerbaik && mode === "training-final") {
      btnGunakanTerbaik.style.display = "none";
    }

    // Simpan parameter ke dataset card
    card.dataset.params = JSON.stringify(params);

    return card;
  }

  function startTraining(mode) {
    const splitSelect = document.getElementById("split-ratio-select");
    const splitRatio = splitSelect?.value;

    if (!splitRatio) {
      showToast("⚠️ Pilih rasio data split terlebih dahulu");
      return;
    }

    if (!currentAlgo) {
      showToast("⚠️ Pilih algoritma terlebih dahulu");
      return;
    }

    const requiredFields = ["lr", "epoch", "batch-size", "max-length"];
    for (let field of requiredFields) {
      const element = document.getElementById(field);
      if (element && !element.value) {
        showToast(`⚠️ ${field.replace("-", " ")} harus dipilih`);
        return;
      }
    }

    const datasetSelected =
      document.getElementById("dataset-card").style.display === "flex";
    const modelSelected =
      document.getElementById("model-card").style.display === "flex";

    if (!datasetSelected && !modelSelected) {
      showToast("⚠️ Pilih dataset atau model terlebih dahulu");
      return;
    }

    if (
      document.getElementById("new-model-name-card").style.display === "flex" &&
      !modelNameSaved
    ) {
      showToast("⚠️ Simpan nama model terlebih dahulu");
      return;
    }

    // 🔧 Untuk mode training-final, validasi nama training
    if (mode === "training-final") {
      const trainingName = document
        .getElementById("training-name")
        ?.value.trim();
      if (!trainingName) {
        showToast("⚠️ Masukkan nama training terlebih dahulu");
        return;
      }
    }

    const params = {
      splitRatio: splitRatio,
      lr: document.getElementById("lr")?.value || "",
      epoch: parseInt(document.getElementById("epoch")?.value) || 3,
      batchSize: document.getElementById("batch-size")?.value || "",
      maxLength: document.getElementById("max-length")?.value || "",
      optimizer: document.getElementById("optimizer")?.value || "",
      weightDecay: document.getElementById("weight-decay")?.value || "",
      scheduler: document.getElementById("scheduler")?.value || "",
      warmup: document.getElementById("warmup")?.value || "",
      dropout: document.getElementById("dropout")?.value || "",
      earlyStopping: document.getElementById("early-stopping")?.value || "",
      gradAccum: document.getElementById("grad-accum")?.value || "",
      vectorSize: document.getElementById("vector-size")?.value || "",
      windowSize: document.getElementById("window-size")?.value || "",
      minCount: document.getElementById("min-count")?.value || "",
      modelType: document.getElementById("model-type")?.value || "",
      negative: document.getElementById("negative")?.value || "",
      xMax: document.getElementById("x-max")?.value || "",
      alpha: document.getElementById("alpha")?.value || "",
      algo: currentAlgo,
      mode: mode,
    };

    // 🔧 Buat training card untuk SEMUA mode
    const card = createTrainingCard(mode, params);
    const container = document.getElementById("training-cards-container");

    // 🔧 PENTING: Tampilkan container saat mode training-final
    if (mode === "training-final") {
      container.style.display = "flex";
    }

    container.appendChild(card);

    card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    simulateTrainingInCard(card, mode, params);
  }

  function simulateTrainingInCard(card, mode, params) {
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const progressWrap = card.querySelector(".progress-wrap");
    const tableBody = card.querySelector(".results-table tbody");

    let progress = 0;
    const totalEpochs = params.epoch;
    let currentEpoch = 0;
    const epochResults = []; // TAMBAHKAN: Array untuk menyimpan hasil

    tableBody.innerHTML = "";

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 3;

      const epochProgress = Math.floor((progress / 100) * totalEpochs);

      if (epochProgress > currentEpoch && epochProgress <= totalEpochs) {
        currentEpoch = epochProgress;
        const result = addEpochResult(tableBody, currentEpoch, params);
        epochResults.push(result); // TAMBAHKAN: Simpan hasil
      }

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        finishTrainingInCard(card, mode, params, epochResults); // KIRIM epochResults
      }

      progressBar.style.width = progress + "%";
      progressLabel.innerText = progress + "%";
    }, 400);
  }

  // Fungsi simulasi training untuk mode Training Final (tanpa card)
  function simulateTrainingFinal(mode, params) {
    const totalEpochs = params.epoch;
    const epochResults = [];

    // Simulasi progress (bisa ditampilkan di toast atau progress bar temporary)
    let currentEpoch = 0;

    const interval = setInterval(() => {
      currentEpoch++;

      if (currentEpoch <= totalEpochs) {
        // Generate hasil untuk epoch ini
        const result = generateEpochResult(currentEpoch, params);
        epochResults.push(result);
        showToast(
          `🔄 Training Final: Epoch ${currentEpoch}/${totalEpochs} selesai`,
          "info",
        );
      }

      if (currentEpoch >= totalEpochs) {
        clearInterval(interval);

        // Training selesai - simpan ke history
        const trainingName =
          document.getElementById("training-name")?.value ||
          `Training_${new Date().toLocaleDateString("id-ID").replace(/\//g, "-")}`;
        const trainingDesc =
          document.getElementById("training-desc")?.value || "";
        const splitRatio =
          params.splitRatio ||
          document.getElementById("split-ratio-select")?.value ||
          "80:20";

        const historyEntry = {
          tanggal: new Date().toISOString(),
          nama_model: trainingName,
          rasio: splitRatio,
          keterangan: trainingDesc,
          parameter: {
            algo: params.algo || currentAlgo,
            lr: params.lr,
            epoch: params.epoch,
            batchSize: params.batchSize,
            maxLength: params.maxLength,
            optimizer: params.optimizer,
            weightDecay: params.weightDecay,
            scheduler: params.scheduler,
            warmup: params.warmup,
            dropout: params.dropout,
            earlyStopping: params.earlyStopping,
            gradAccum: params.gradAccum,
            vectorSize: params.vectorSize,
            windowSize: params.windowSize,
            minCount: params.minCount,
            modelType: params.modelType,
            negative: params.negative,
            xMax: params.xMax,
            alpha: params.alpha,
          },
          hasil: epochResults,
        };

        saveTrainingHistory(historyEntry);
        renderHistoryTable();

        // Hitung average untuk ditampilkan di toast
        const avgF1 =
          epochResults.reduce((sum, r) => sum + r.f1, 0) / epochResults.length;

        showToast(
          `✅ Training Final selesai! Avg F1: ${avgF1.toFixed(2)}%`,
          "success",
        );

        // Reset input form (opsional)
        document.getElementById("training-name").value = "";
        document.getElementById("training-desc").value = "";
      }
    }, 800); // Delay per epoch
  }

  // Helper: Generate hasil per epoch
  function generateEpochResult(epoch, params) {
    const baseAcc = 75 + epoch * 2 + Math.random() * 3;
    const basePrec = 74 + epoch * 2 + Math.random() * 3;
    const baseRec = 73 + epoch * 2 + Math.random() * 3;
    const baseF1 = 74 + epoch * 2 + Math.random() * 3;

    const accuracy = Math.min(99, baseAcc + Math.random() * 2);
    const precision = Math.min(99, basePrec + Math.random() * 2);
    const recall = Math.min(99, baseRec + Math.random() * 2);
    const f1 = Math.min(99, baseF1 + Math.random() * 2);
    const loss = Math.max(0.1, 1.5 - epoch * 0.25 + Math.random() * 0.2);
    const mcc = 0.5 + Math.random() * 0.3;

    return {
      epoch,
      accuracy,
      precision,
      recall,
      f1,
      loss,
      mcc,
    };
  }

  function addEpochResult(tableBody, epoch, params) {
    const emptyRow = tableBody.querySelector(".empty-row");
    if (emptyRow) emptyRow.remove();

    const baseAcc = 75 + epoch * 2 + Math.random() * 3;
    const basePrec = 74 + epoch * 2 + Math.random() * 3;
    const baseRec = 73 + epoch * 2 + Math.random() * 3;
    const baseF1 = 74 + epoch * 2 + Math.random() * 3;

    const accuracy = Math.min(99, baseAcc + Math.random() * 2).toFixed(2);
    const precision = Math.min(99, basePrec + Math.random() * 2).toFixed(2);
    const recall = Math.min(99, baseRec + Math.random() * 2).toFixed(2);
    const f1 = Math.min(99, baseF1 + Math.random() * 2).toFixed(2);
    const loss = Math.max(
      0.1,
      1.5 - epoch * 0.25 + Math.random() * 0.2,
    ).toFixed(4);
    const mcc = (Math.random() * 0.3 + 0.5).toFixed(4);

    const row = document.createElement("tr");
    row.innerHTML = `
    <td>${epoch}</td>
    <td>${accuracy}%</td>
    <td>${precision}%</td>
    <td>${recall}%</td>
    <td>${f1}%</td>
    <td>${loss}</td>
    <td>${mcc}</td>
  `;
    tableBody.appendChild(row);

    // TAMBAHKAN: Return hasil sebagai object
    return {
      epoch,
      accuracy: parseFloat(accuracy),
      precision: parseFloat(precision),
      recall: parseFloat(recall),
      f1: parseFloat(f1),
      loss: parseFloat(loss),
      mcc: parseFloat(mcc),
    };
  }

  // TAMBAHKAN: Fungsi untuk menghitung dan menampilkan baris Average
  function calculateAndDisplayAverage(card, epochResults) {
    const avgRow = card.querySelector(".average-row");
    if (!avgRow || epochResults.length === 0) return null;

    const count = epochResults.length;

    // Hitung total
    const sum = epochResults.reduce(
      (acc, r) => {
        acc.accuracy += r.accuracy;
        acc.precision += r.precision;
        acc.recall += r.recall;
        acc.f1 += r.f1;
        acc.loss += r.loss;
        acc.mcc += r.mcc;
        return acc;
      },
      { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0, mcc: 0 },
    );

    // Hitung rata-rata
    const avg = {
      accuracy: sum.accuracy / count,
      precision: sum.precision / count,
      recall: sum.recall / count,
      f1: sum.f1 / count,
      loss: sum.loss / count,
      mcc: sum.mcc / count,
    };

    // Tampilkan baris average
    avgRow.style.display = "table-footer-group";
    card.querySelector(".avg-accuracy").innerText =
      avg.accuracy.toFixed(2) + "%";
    card.querySelector(".avg-precision").innerText =
      avg.precision.toFixed(2) + "%";
    card.querySelector(".avg-recall").innerText = avg.recall.toFixed(2) + "%";
    card.querySelector(".avg-f1").innerText = avg.f1.toFixed(2) + "%";
    card.querySelector(".avg-loss").innerText = avg.loss.toFixed(4);
    card.querySelector(".avg-mcc").innerText = avg.mcc.toFixed(4);

    return avg;
  }

  function finishTrainingInCard(card, mode, params, epochResults) {
    const progressWrap = card.querySelector(".progress-wrap");
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    const btnSimpan = card.querySelector(".btn-simpan-card");
    const bestParamsDisplay = card.querySelector(".best-params-display");

    progressWrap.classList.add("done");
    progressBar.style.width = "100%";
    progressLabel.innerText = "Selesai";

    // Tampilkan tombol simpan
    if (btnSimpan) {
      btnSimpan.style.display = "inline-block";
    }

    // Hitung dan tampilkan average
    const avgData = calculateAndDisplayAverage(card, epochResults);

    // Simpan ke comparison data (untuk tabel perbandingan rasio)
    if (avgData && params.splitRatio) {
      ratioComparisonData[params.splitRatio] = avgData;
      updateComparisonTable();
    }

    // 🔧 TAMBAHAN: Simpan ke history jika mode training-final
    if (mode === "training-final") {
      const trainingName =
        document.getElementById("training-name")?.value ||
        `Training_${new Date().toLocaleDateString("id-ID").replace(/\//g, "-")}`;
      const trainingDesc =
        document.getElementById("training-desc")?.value || "";
      const splitRatio =
        params.splitRatio ||
        document.getElementById("split-ratio-select")?.value ||
        "80:20";

      // 🔧 Ambil model name dari input "Nama Model Baru"
      let modelNameFromInput = "";
      const newModelNameCard = document.getElementById("new-model-name-card");

      if (newModelNameCard && newModelNameCard.style.display === "flex") {
        // Coba ambil dari elemen yang sudah disimpan (format card)
        const nameElement = newModelNameCard.querySelector(".file-card-name");
        if (nameElement) {
          modelNameFromInput = nameElement.innerText.trim();
        } else {
          // Fallback ke input field
          const inputElement = document.getElementById("new-model-name");
          modelNameFromInput = inputElement?.value?.trim() || "";
        }
      }

      // Jika masih kosong, coba ambil dari model lama yang dipilih
      if (!modelNameFromInput) {
        modelNameFromInput =
          document.getElementById("model-card-name")?.innerText?.trim() || "";
      }

      // Fallback final
      if (!modelNameFromInput || modelNameFromInput === "—") {
        modelNameFromInput = "Untitled Model";
      }

      const historyEntry = {
        tanggal: new Date().toISOString(),
        training_name: trainingName, // 🔧 Training name dari form
        model_name: modelNameFromInput, // 🔧 Model name dari input "Nama Model Baru"
        rasio: splitRatio,
        keterangan: trainingDesc,
        parameter: {
          algo: params.algo || currentAlgo,
          lr: params.lr,
          epoch: params.epoch,
          batchSize: params.batchSize,
          maxLength: params.maxLength,
          optimizer: params.optimizer,
          weightDecay: params.weightDecay,
          scheduler: params.scheduler,
          warmup: params.warmup,
          dropout: params.dropout,
          earlyStopping: params.earlyStopping,
          gradAccum: params.gradAccum,
          vectorSize: params.vectorSize,
          windowSize: params.windowSize,
          minCount: params.minCount,
          modelType: params.modelType,
          negative: params.negative,
          xMax: params.xMax,
          alpha: params.alpha,
        },
        hasil: epochResults.map((r) => ({
          epoch: r.epoch,
          accuracy: r.accuracy,
          precision: r.precision,
          recall: r.recall,
          f1: r.f1,
          loss: r.loss,
          mcc: r.mcc,
        })),
      };

      saveTrainingHistory(historyEntry);
      renderHistoryTable();
      showToast("✅ Final training saved to history!", "success");
    }

    // Fungsi untuk update tabel perbandingan
    function updateComparisonTable() {
      const section = document.getElementById("ratio-comparison-section");
      const tbody = document.getElementById("comparison-body");

      if (!section || !tbody) return;

      const entries = Object.entries(ratioComparisonData);

      if (entries.length === 0) {
        tbody.innerHTML =
          '<tr class="empty-row"><td colspan="7" style="text-align:center; color:#999; padding: 30px;">📭 Belum ada data perbandingan. Lakukan training untuk melihat hasil.</td></tr>';
        section.style.display = "none";
        return;
      }

      section.style.display = "block";

      // Cari F1 tertinggi
      let bestF1 = 0;
      let bestRatio = "";
      entries.forEach(([ratio, data]) => {
        if (data.f1 > bestF1) {
          bestF1 = data.f1;
          bestRatio = ratio;
        }
      });

      // Urutkan berdasarkan F1-Score (tertinggi ke terendah)
      const sortedEntries = entries.sort((a, b) => b[1].f1 - a[1].f1);

      tbody.innerHTML = sortedEntries
        .map(([ratio, data]) => {
          const isBest = ratio === bestRatio;
          return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.2); font-weight: 600;" : ""}">
          <td style="padding: 12px 15px; text-align: center;">
            <strong>${ratio}</strong>
            ${isBest ? " 🏆" : ""}
          </td>
          <td style="padding: 12px 15px; text-align: center;">${data.accuracy.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${data.precision.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${data.recall.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${data.f1.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${data.loss.toFixed(4)}</td>
          <td style="padding: 12px 15px; text-align: center;">${data.mcc.toFixed(4)}</td>
        </tr>
      `;
        })
        .join("");
    }

    if (mode === "cari-rasio") {
      // Tampilkan parameter terbaik
      const bestParamsContent = bestParamsDisplay?.querySelector(
        ".best-params-content",
      );
      const rows = card.querySelectorAll(".results-table tbody tr");
      let bestF1 = 0;
      let bestRow = null;

      rows.forEach((row) => {
        const f1Cell = row.cells[4];
        if (f1Cell) {
          const f1Val = parseFloat(f1Cell.innerText);
          if (f1Val > bestF1) {
            bestF1 = f1Val;
            bestRow = row;
          }
        }
      });

      if (bestRow) {
        bestRow.classList.add("best-row");
      }

      if (bestParamsContent) {
        bestParamsContent.innerHTML = `
        <p><strong>📊 Split Ratio:</strong> ${params.splitRatio}</p>
        <p><strong>📈 Learning Rate:</strong> ${params.lr}</p>
        <p><strong>🔄 Epoch:</strong> ${params.epoch}</p>
        <p><strong>📦 Batch Size:</strong> ${params.batchSize}</p>
        <p><strong>📏 Max Length:</strong> ${params.maxLength}</p>
        <p><strong>🏆 Best F1-Score:</strong> ${bestF1.toFixed(2)}%</p>
      `;
      }

      if (bestParamsDisplay) {
        bestParamsDisplay.style.display = "block";
      }

      if (btnGunakanTerbaik) {
        btnGunakanTerbaik.style.display = "inline-block";
      }

      // Simpan parameter terbaik untuk card ini
      card.dataset.bestParams = JSON.stringify(params);

      // Update global best params jika F1 lebih tinggi
      if (
        !globalBestParams ||
        (avgData && avgData.f1 > (globalBestParams.avgF1 || 0))
      ) {
        globalBestParams = {
          ...params,
          avgF1: avgData.f1,
          avgAccuracy: avgData.accuracy,
        };

        // Update global best params display
        const globalBestContent = document.querySelector(
          "#best-params-display .best-params-content",
        );
        if (globalBestContent) {
          globalBestContent.innerHTML = `
          <p><strong>📊 Split Ratio:</strong> ${params.splitRatio}</p>
          <p><strong>📈 Learning Rate:</strong> ${params.lr}</p>
          <p><strong>🔄 Epoch:</strong> ${params.epoch}</p>
          <p><strong>📦 Batch Size:</strong> ${params.batchSize}</p>
          <p><strong>📏 Max Length:</strong> ${params.maxLength}</p>
          <p><strong>🏆 Best F1-Score:</strong> ${avgData.f1.toFixed(2)}%</p>
        `;
        }
        document.getElementById("best-params-display").style.display = "block";
      }
    }

    // Tampilkan/hide comparison section berdasarkan mode
    const comparisonSection = document.getElementById(
      "ratio-comparison-section",
    );
    if (comparisonSection) {
      comparisonSection.style.display =
        currentMode === "cari-rasio" ? "block" : "none";
    }
  }

  function gunakanRasioTerbaik(card) {
    const paramsStr = card.dataset.bestParams || card.dataset.params;
    if (!paramsStr) {
      showToast("⚠️ No parameters saved");
      return;
    }

    const params = JSON.parse(paramsStr);

    // Simpan ke global best params
    globalBestParams = params;

    // Switch algoritma jika berbeda
    if (currentAlgo !== params.algo) {
      document.getElementById("algo-select").value = params.algo;
      currentAlgo = params.algo;
    }

    // Switch ke mode Training Final
    const modeRadios = document.querySelectorAll('input[name="training-mode"]');
    modeRadios.forEach((radio) => {
      if (radio.value === "training-final") {
        radio.checked = true;
      }
    });

    // Trigger mode change secara manual
    currentMode = "training-final";
    document.getElementById("param-card-cari-rasio").style.display = "none";
    document.getElementById("param-card-training-final").style.display =
      "block";

    // Nonaktifkan ratio section
    const ratioSection = document.querySelector(".ratio-section");
    if (ratioSection) {
      ratioSection.style.opacity = "0.9";
      ratioSection.style.pointerEvents = "none";
    }

    // Sembunyikan comparison section
    const comparisonSection = document.getElementById(
      "ratio-comparison-section",
    );
    if (comparisonSection) {
      comparisonSection.style.display = "none";
    }

    // Sembunyikan best params display
    const bestParamsDisplay = document.getElementById("best-params-display");
    if (bestParamsDisplay) {
      bestParamsDisplay.style.display = "none";
    }

    // 🔧 RESET training counter ke 0 untuk Training Final
    trainingCounter = 0;

    // 🔧 HAPUS card lama (hasil pencarian rasio), tapi JANGAN sembunyikan container
    const trainingCardsContainer = document.getElementById(
      "training-cards-container",
    );
    if (trainingCardsContainer) {
      trainingCardsContainer.innerHTML = ""; // Hapus semua card lama
      trainingCardsContainer.style.display = "flex"; // Tetap tampilkan container
    }

    // Render parameters untuk training final, lalu isi parameter
    renderParameters("training-final", () => {
      // Update dropdown rasio terlebih dahulu
      updateRatioDropdown();

      // Panggil fungsi fillParametersFromGlobalBest
      fillParametersFromGlobalBest();

      // Render history table
      renderHistoryTable();

      // Update global best params display (hanya untuk info, tidak ditampilkan)
      const globalBestContent = document.querySelector(
        "#best-params-display .best-params-content",
      );
      if (globalBestContent) {
        globalBestContent.innerHTML = `
        <p><strong>📊 Split Ratio:</strong> ${params.splitRatio}</p>
        <p><strong>📈 Learning Rate:</strong> ${params.lr}</p>
        <p><strong>🔄 Epoch:</strong> ${params.epoch}</p>
        <p><strong>📦 Batch Size:</strong> ${params.batchSize}</p>
        <p><strong>📏 Max Length:</strong> ${params.maxLength}</p>
        <p><strong>⚙️ Optimizer:</strong> ${params.optimizer || "-"}</p>
      `;
      }
      // Jangan tampilkan best params display
      // document.getElementById('best-params-display').style.display = 'block';

      showToast(`✅ Ratio ${params.splitRatio} applied to Final Training mode`);

      // Scroll ke parameter card
      document.getElementById("param-card-training-final").scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function saveModelFromCard(card) {
    const paramsStr = card.dataset.params;
    const params = paramsStr ? JSON.parse(paramsStr) : {};

    let modelName = "";
    const newModelNameCard = document.getElementById("new-model-name-card");

    if (newModelNameCard.style.display === "flex") {
      const nameElement = newModelNameCard.querySelector(".file-card-name");
      if (nameElement) {
        modelName = nameElement.innerText;
      } else {
        const inputElement = document.getElementById("new-model-name");
        modelName = inputElement?.value;
      }
    }

    if (!modelName) {
      modelName = document.getElementById("model-card-name")?.innerText;
    }

    if (!modelName || modelName === "—") {
      modelName = `Model_${Date.now()}`;
    }

    const tableBody = card.querySelector(".results-table tbody");
    const lastRow = tableBody.querySelector("tr:last-child");
    let accuracy = 0,
      precision = 0,
      recall = 0,
      f1 = 0;

    if (lastRow) {
      accuracy = parseFloat(lastRow.cells[1]?.innerText) || 0;
      precision = parseFloat(lastRow.cells[2]?.innerText) || 0;
      recall = parseFloat(lastRow.cells[3]?.innerText) || 0;
      f1 = parseFloat(lastRow.cells[4]?.innerText) || 0;
    }

    const modelData = {
      nama_model: modelName,
      algoritma: params.algo || currentAlgo,
      mode: card.dataset.mode,
      split_ratio: params.splitRatio,
      k_fold: params.kFold || null,
      learning_rate: params.lr,
      epoch: params.epoch,
      batch_size: params.batchSize,
      max_length: params.maxLength,
      optimizer: params.optimizer || null,
      weight_decay: params.weightDecay || null,
      scheduler: params.scheduler || null,
      dropout: params.dropout || null,
      early_stopping: params.earlyStopping || null,
      gradient_accumulation: params.gradAccum || null,
      accuracy: accuracy,
      precision: precision,
      recall: recall,
      f1_score: f1,
      created_at: new Date().toISOString(),
    };

    if (supabaseClient) {
      supabaseClient
        .from("models")
        .insert([modelData])
        .then(({ error }) => {
          if (error) {
            console.error("Error saving:", error);
            showToast("✅ Model berhasil tersimpan secara lokal!");
            saveToLocalStorage(modelData);
          } else {
            showToast("✅ Model berhasil tersimpan ke database!");
          }
        });
    } else {
      showToast("✅ Model berhasil tersimpan!");
      saveToLocalStorage(modelData);
    }

    console.log("Model saved:", modelData);
  }

  function saveModel() {
    showToast("✅ Gunakan tombol Simpan pada card training");
  }

  function saveToLocalStorage(modelData) {
    try {
      const saved = JSON.parse(localStorage.getItem("saved_models") || "[]");
      saved.push(modelData);
      localStorage.setItem("saved_models", JSON.stringify(saved));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }

  function showToast(message, type = "info") {
    const toast = document.getElementById("toast-notif");
    toast.innerText = message;
    toast.classList.add("show");
    if (type === "error") toast.style.background = "#c62828";
    else if (type === "success") toast.style.background = "#2e7d32";
    else toast.style.background = "#2c1f0e";
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  // ==================== TRAINING HISTORY MANAGER ====================
  const HISTORY_KEY = "training_history";

  // Load history dari localStorage
  function loadTrainingHistory() {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  // Save history ke localStorage
  function saveTrainingHistory(historyData) {
    const history = loadTrainingHistory();
    history.push(historyData);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  // Render tabel riwayat
  // Render tabel riwayat
  function renderHistoryTable() {
    const tbody = document.getElementById("history-body");
    if (!tbody) return;

    const history = loadTrainingHistory();

    if (history.length === 0) {
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="4" style="text-align:center; color:#999; padding: 20px;">No training history yet</td></tr>';
      return;
    }

    // Urutkan dari terbaru
    const sorted = [...history].reverse();

    tbody.innerHTML = sorted
      .map((item, index) => {
        const originalIndex = history.length - 1 - index;
        const date = new Date(item.tanggal).toLocaleString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        // 🔧 Gunakan training_name, fallback ke nama_model untuk data lama (backward compatibility)
        const displayName =
          item.training_name || item.nama_model || "Untitled Training";

        // 🔧 Limit panjang nama untuk tampilan
        const shortName =
          displayName.length > 25
            ? displayName.substring(0, 22) + "..."
            : displayName;

        return `
      <tr>
        <td>${date}</td>
        <td title="${displayName}"><strong>${shortName}</strong></td>
        <td>${item.rasio || "-"}</td>
        <td>
          <button class="btn-lihat" data-index="${originalIndex}" onclick="showHistoryDetailModal(${originalIndex})">👁️ View</button>
        </td>
      </tr>
    `;
      })
      .join("");
  }

  // Tampilkan modal detail
  // Tampilkan modal detail
  window.showHistoryDetailModal = function (index) {
    const history = loadTrainingHistory();
    const data = history[index];
    if (!data) {
      showToast("⚠️ History data not found", "error");
      return;
    }

    // 🔧 Isi info - Training Name
    const trainingNameEl = document.getElementById("detail-training-name");
    if (trainingNameEl) {
      trainingNameEl.innerText = data.training_name || data.nama_model || "-";
    }

    // 🔧 Isi info - Model Name
    const modelNameEl = document.getElementById("detail-model-name");
    if (modelNameEl) {
      modelNameEl.innerText = data.model_name || "-";
    }

    // 🔧 Isi info - Split Ratio
    const ratioEl = document.getElementById("detail-ratio");
    if (ratioEl) {
      ratioEl.innerText = data.rasio || "-";
    }

    // 🔧 Isi info - Date
    const dateEl = document.getElementById("detail-date");
    if (dateEl) {
      dateEl.innerText = new Date(data.tanggal).toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    // 🔧 Isi info - Algorithm
    const algoEl = document.getElementById("detail-algo");
    if (algoEl) {
      algoEl.innerText = data.parameter?.algo || "-";
    }

    // 🔧 Isi info - Description
    const descEl = document.getElementById("detail-desc");
    if (descEl) {
      descEl.innerText = data.keterangan || "No description";
    }

    // 🔧 Isi parameter
    const paramsDiv = document.getElementById("detail-params");
    if (paramsDiv) {
      if (data.parameter) {
        const p = data.parameter;

        // Format learning rate dengan baik
        const lrDisplay = p.lr || "-";
        const epochDisplay = p.epoch || "-";
        const batchDisplay = p.batchSize || "-";
        const maxLenDisplay = p.maxLength || "-";
        const optimizerDisplay = p.optimizer || "-";
        const weightDecayDisplay = p.weightDecay || "-";
        const schedulerDisplay = p.scheduler || "-";
        const warmupDisplay = p.warmup || "-";
        const dropoutDisplay = p.dropout || "-";
        const earlyStopDisplay =
          p.earlyStopping === "0" ? "Disabled" : p.earlyStopping || "-";
        const gradAccumDisplay = p.gradAccum || "-";

        // Parameter tambahan untuk Word2Vec & GloVe
        const vectorSizeDisplay = p.vectorSize || "-";
        const windowSizeDisplay = p.windowSize || "-";
        const minCountDisplay = p.minCount || "-";
        const modelTypeDisplay = p.modelType || "-";
        const negativeDisplay = p.negative || "-";
        const xMaxDisplay = p.xMax || "-";
        const alphaDisplay = p.alpha || "-";

        // 🔧 Tentukan algoritma untuk menampilkan parameter yang relevan
        const algo = p.algo || "";

        let additionalParamsHtml = "";
        if (algo === "word2vec") {
          additionalParamsHtml = `
          <span><strong>Vector Size:</strong> ${vectorSizeDisplay}</span>
          <span><strong>Window Size:</strong> ${windowSizeDisplay}</span>
          <span><strong>Min Count:</strong> ${minCountDisplay}</span>
          <span><strong>Model Type:</strong> ${modelTypeDisplay}</span>
          <span><strong>Negative:</strong> ${negativeDisplay}</span>
        `;
        } else if (algo === "glove") {
          additionalParamsHtml = `
          <span><strong>Vector Size:</strong> ${vectorSizeDisplay}</span>
          <span><strong>Window Size:</strong> ${windowSizeDisplay}</span>
          <span><strong>Min Count:</strong> ${minCountDisplay}</span>
          <span><strong>X Max:</strong> ${xMaxDisplay}</span>
          <span><strong>Alpha:</strong> ${alphaDisplay}</span>
        `;
        } else {
          // Untuk mBERT, XLM-R, IndoBERT
          additionalParamsHtml = `
          <span><strong>Warmup:</strong> ${warmupDisplay}</span>
          <span><strong>Grad Accum:</strong> ${gradAccumDisplay}</span>
        `;
        }

        paramsDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <span><strong>LR:</strong> ${lrDisplay}</span>
          <span><strong>Epoch:</strong> ${epochDisplay}</span>
          <span><strong>Batch Size:</strong> ${batchDisplay}</span>
          <span><strong>Max Length:</strong> ${maxLenDisplay}</span>
          <span><strong>Optimizer:</strong> ${optimizerDisplay}</span>
          <span><strong>Weight Decay:</strong> ${weightDecayDisplay}</span>
          <span><strong>Scheduler:</strong> ${schedulerDisplay}</span>
          <span><strong>Dropout:</strong> ${dropoutDisplay}</span>
          <span><strong>Early Stopping:</strong> ${earlyStopDisplay}</span>
          ${additionalParamsHtml}
        </div>
      `;
      } else {
        paramsDiv.innerHTML =
          '<p style="color:#999;">Parameter not available</p>';
      }
    }

    // 🔧 Isi tabel hasil
    const tbody = document.getElementById("history-results-body");
    const avgFoot = document.getElementById("history-average-row");

    if (!tbody || !avgFoot) return;

    if (data.hasil && data.hasil.length > 0) {
      const results = data.hasil;

      // 🔧 Cari epoch dengan F1 tertinggi
      let bestF1 = -1;
      let bestEpoch = -1;
      results.forEach((r) => {
        if (r.f1 > bestF1) {
          bestF1 = r.f1;
          bestEpoch = r.epoch;
        }
      });

      // 🔧 Render rows
      tbody.innerHTML = results
        .map((r) => {
          const isBest = r.epoch === bestEpoch;
          return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.3); font-weight: 600;" : ""}">
          <td>${isBest ? "🏆 " : ""}${r.epoch}</td>
          <td>${r.accuracy.toFixed(2)}%</td>
          <td>${r.precision.toFixed(2)}%</td>
          <td>${r.recall.toFixed(2)}%</td>
          <td>${r.f1.toFixed(2)}%</td>
          <td>${r.loss.toFixed(4)}</td>
          <td>${r.mcc.toFixed(4)}</td>
        </tr>
      `;
        })
        .join("");

      // 🔧 Hitung average
      const count = results.length;
      const sum = results.reduce(
        (acc, r) => {
          acc.accuracy += r.accuracy;
          acc.precision += r.precision;
          acc.recall += r.recall;
          acc.f1 += r.f1;
          acc.loss += r.loss;
          acc.mcc += r.mcc;
          return acc;
        },
        { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0, mcc: 0 },
      );

      avgFoot.innerHTML = `
      <tr>
        <td><strong>Average</strong></td>
        <td>${(sum.accuracy / count).toFixed(2)}%</td>
        <td>${(sum.precision / count).toFixed(2)}%</td>
        <td>${(sum.recall / count).toFixed(2)}%</td>
        <td>${(sum.f1 / count).toFixed(2)}%</td>
        <td>${(sum.loss / count).toFixed(4)}</td>
        <td>${(sum.mcc / count).toFixed(4)}</td>
      </tr>
    `;
    } else {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:#999;">Result data not available</td></tr>';
      avgFoot.innerHTML = "";
    }

    // 🔧 Tampilkan modal
    const modal = document.getElementById("history-detail-modal");
    if (modal) {
      modal.style.display = "flex";
    }
  };

  // Tutup modal
  window.closeHistoryDetailModal = function () {
    document.getElementById("history-detail-modal").style.display = "none";
  };

  // Inisialisasi history table saat DOM loaded
  document.addEventListener("DOMContentLoaded", function () {
    renderHistoryTable();
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.style.display = "none";
      }
    });
  });
})();
