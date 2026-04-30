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
<<<<<<< HEAD
=======
  let selectedDatasetId = null;
>>>>>>> 5389e9f (Initial commit)
  let selectedModel = null;
  let currentAlgo = "";
  let currentMode = "cari-rasio";
  let modelNameSaved = false;
  let trainingCounter = 0;
<<<<<<< HEAD
  const TRAINING_STAGE_LABELS = [
    "Validasi input",
    "Kirim request ke backend",
    "Training model di server",
    "Render hasil epoch",
    "Finalisasi",
  ];
=======

  const API_BASE = "http://127.0.0.1:8000";
  const STORAGE_SELECTED_DATASET_ID = "processing_selected_dataset_id";
  const STORAGE_SELECTED_DATASET_NAME = "processing_selected_dataset_name";
>>>>>>> 5389e9f (Initial commit)

  // Variable untuk menyimpan parameter terbaik global
  let globalBestParams = null;
  let ratioComparisonData = {}; // Untuk menyimpan data perbandingan rasio
  let epochResultsData = []; // Untuk menyimpan hasil per epoch
<<<<<<< HEAD
  const EPOCH_RESULTS_CACHE_KEY = "model_epoch_results_cache";
=======
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
      showToast("Masukkan nilai Train yang valid (1-99)", "error");
=======
      showToast("Sign Inkan nilai Train yang valid (1-99)", "error");
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
      showToast("Rasio ini sudah ada di tabel", "error");
=======
      showToast("This ratio already exists in table", "error");
>>>>>>> 5389e9f (Initial commit)
      return;
    }

    trainInput.classList.remove("error");
    testInput.classList.remove("error");

    if (editingIndex >= 0) {
      ratioData[editingIndex] = { train: trainVal, test: testVal };
<<<<<<< HEAD
      showToast(`Rasio ${trainVal}:${testVal} berhasil diperbarui`);
      editingIndex = -1;
      document.getElementById("btn-add-ratio").innerHTML = "➕ Tambah";
    } else {
      ratioData.push({ train: trainVal, test: testVal });
      showToast(`Rasio ${trainVal}:${testVal} berhasil ditambahkan`);
=======
      showToast(`Ratio ${trainVal}:${testVal} updated successfully`);
      editingIndex = -1;
      document.getElementById("btn-add-ratio").innerHTML = "➕ Add";
    } else {
      ratioData.push({ train: trainVal, test: testVal });
      showToast(`Ratio ${trainVal}:${testVal} added successfully`);
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
          <button class="btn-edit" data-index="${index}">✏️ Ubah</button>
          <button class="btn-delete" data-index="${index}">🗑️ Hapus</button>
=======
          <div class="ratio-action-wrap">
            <button class="btn-edit" data-index="${index}">Edit</button>
            <button class="btn-delete" data-index="${index}">Delete</button>
          </div>
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
    document.getElementById("btn-add-ratio").innerHTML = "💾 Simpan";
=======
    document.getElementById("btn-add-ratio").innerHTML = "💾 Save";
>>>>>>> 5389e9f (Initial commit)
    trainInput.focus();
  }

  function confirmDeleteRatio(index) {
    deletePendingIndex = index;
    const item = ratioData[index];

    const modalP = confirmModal.querySelector("p");
<<<<<<< HEAD
    modalP.innerHTML = `Apakah Anda yakin ingin menghapus rasio <strong>${item.train}:${item.test}</strong>?`;
=======
    modalP.innerHTML = `Are you sure you want to delete ratio <strong>${item.train}:${item.test}</strong>?`;
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
      showToast(`Rasio ${deleted.train}:${deleted.test} dihapus`);
=======
      showToast(`Ratio ${deleted.train}:${deleted.test} deleted`);
>>>>>>> 5389e9f (Initial commit)

      if (editingIndex === index) {
        document.getElementById("train-input").value = "";
        document.getElementById("test-input").value = "";
        document.getElementById("test-input").dataset.auto = "true";
        editingIndex = -1;
<<<<<<< HEAD
        document.getElementById("btn-add-ratio").innerHTML = "➕ Tambah";
=======
        document.getElementById("btn-add-ratio").innerHTML = "➕ Add";
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
      '<option value="" disabled selected>-- Pilih Rasio --</option>';
=======
      '<option value="" disabled selected>-- Select Ratio --</option>';
>>>>>>> 5389e9f (Initial commit)

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
<<<<<<< HEAD
        <h4>⚠️ Konfirmasi Hapus</h4>
        <p>Apakah Anda yakin ingin menghapus rasio ini?</p>
        <div class="modal-confirm-actions">
          <button class="btn-confirm-cancel" id="btn-confirm-cancel">Batal</button>
          <button class="btn-confirm-delete" id="btn-confirm-delete">Hapus</button>
=======
        <h4>⚠️ Delete Confirmation</h4>
        <p>Are you sure you want to delete this ratio?</p>
        <div class="modal-confirm-actions">
          <button class="btn-confirm-cancel" id="btn-confirm-cancel">Cancel</button>
          <button class="btn-confirm-delete" id="btn-confirm-delete">Delete</button>
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
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
=======
    const btnPilihDataset = document.getElementById("btn-pilih-dataset");
    const modeRadios = document.querySelectorAll('input[name="training-mode"]');
    const btnSimpanNama = document.getElementById("btn-simpan-nama");

    initRatioManager();
    loadPreprocessedDatasets();

    algoSelect.addEventListener("change", onAlgoChange);
    modelSelect.addEventListener("change", onModelSelectChange);
    if (btnPilihDataset) {
      btnPilihDataset.addEventListener("click", () => {
        document.getElementById("modal-dataset").style.display = "flex";
      });
    }
    modeRadios.forEach((radio) =>
      radio.addEventListener("change", onModeChange),
    );
>>>>>>> 5389e9f (Initial commit)

    if (btnSimpanNama) {
      btnSimpanNama.addEventListener("click", simpanNamaModel);
    }

<<<<<<< HEAD
=======
    applyModeSpecificVisibility();

    // Sinkronkan algoritma default dari Home (Dashboard) bila tersedia.
    const savedAlgo = String(localStorage.getItem("selectedAlgorithm") || "")
      .trim()
      .toLowerCase();
    const allowedAlgo = ["indobert", "mbert"];
    if (savedAlgo && allowedAlgo.includes(savedAlgo)) {
      const hasOption = Array.from(algoSelect.options || []).some(
        (opt) => String(opt.value || "").toLowerCase() === savedAlgo,
      );
      if (hasOption) {
        algoSelect.value = savedAlgo;
      }
    }
    algoSelect.dispatchEvent(new Event("change"));

>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        // Klik item model langsung menutup modal + memuat parameter terpilih.
        window.closeModalLama();
=======
        applyOldModelSelection(li);
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
            showToast("🗑️ Hasil training dihapus");
          }
        }

        // Tombol "Gunakan Rasio Terbaik" di dalam card
=======
            showToast("🗑️ Training result deleted");
          }
        }

        // Tombol "Use Best Model" di dalam card
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
=======
  async function loadPreprocessedDatasets() {
    const list = document.getElementById("dataset-list");
    if (!list || !supabaseClient) return;

    list.innerHTML = `<li style="opacity:.7;">Loading...</li>`;

    const { data, error } = await supabaseClient
      .from("datasets")
      .select("id,name,file_name,is_preprocessed,created_at")
      .eq("is_preprocessed", true)
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      list.innerHTML = `<li style="color:#c62828;">Failed to load datasets</li>`;
      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `<li style="opacity:.7;">No preprocessed dataset</li>`;
      return;
    }

    list.innerHTML = data
      .map((ds) => {
        const label = ds.name || ds.file_name || `dataset_${ds.id}`;
        return `<li data-dataset-id="${ds.id}">${label}</li>`;
      })
      .join("");

    // Auto-select dataset yang dibawa dari halaman Preprocessing.
    applyPreferredDatasetSelection(data);
  }

  function applyPreferredDatasetSelection(datasets) {
    const preferredId = parseInt(localStorage.getItem(STORAGE_SELECTED_DATASET_ID) || "", 10);
    const preferredName = localStorage.getItem(STORAGE_SELECTED_DATASET_NAME) || "";
    if (!preferredId) return;

    const found = (datasets || []).find((d) => Number(d.id) === preferredId);
    if (found) {
      selectedDatasetId = preferredId;
      const datasetName = found.name || found.file_name || `dataset_${preferredId}`;
      const datasetCardName = document.getElementById("dataset-card-name");
      const datasetCard = document.getElementById("dataset-card");
      if (datasetCardName) datasetCardName.innerText = datasetName;
      if (datasetCard) datasetCard.style.display = "flex";

      const selectedLi = document.querySelector(
        `#dataset-list li[data-dataset-id="${preferredId}"]`,
      );
      if (selectedLi) {
        document
          .querySelectorAll("#dataset-list li")
          .forEach((el) => el.classList.remove("selected"));
        selectedLi.classList.add("selected");
      }

      showToast(`✅ Dataset otomatis dipilih: ${datasetName}`);
      return;
    }

    // fallback jika ID not found di list (mis. baru dihapus)
    if (preferredName) {
      const datasetCardName = document.getElementById("dataset-card-name");
      const datasetCard = document.getElementById("dataset-card");
      if (datasetCardName) datasetCardName.innerText = preferredName;
      if (datasetCard) datasetCard.style.display = "flex";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function loadTrainedModels() {
    const modelList = document.getElementById("model-list");
    if (!modelList) return;

    if (!supabaseClient) {
      modelList.innerHTML = `<li style="opacity:.7;">Supabase client unavailable</li>`;
      return;
    }

    const algoFromSelect = document.getElementById("algo-select")?.value || "";
    const normalizedAlgo = String(currentAlgo || algoFromSelect || "")
      .trim()
      .toLowerCase();
    if (!normalizedAlgo) {
      modelList.innerHTML = `<li style="opacity:.7;">Select algorithm first</li>`;
      return;
    }

    modelList.innerHTML = `<li style="opacity:.7;">Loading trained models...</li>`;

    const { data, error } = await supabaseClient
      .from("models")
      .select(
        "id,nama_model,algoritma,mode,dataset_id,split_ratio,learning_rate,epoch,batch_size,max_length,optimizer,weight_decay,scheduler,dropout,early_stopping,gradient_accumulation,created_at",
      )
      .eq("mode", "training-final")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      modelList.innerHTML = `<li style="color:#c62828;">Failed to load trained models</li>`;
      return;
    }

    const rows = (data || []).filter((row) => {
      const algo = String(row.algoritma || "")
        .trim()
        .toLowerCase();
      const name = String(row.nama_model || "").trim();
      return algo === normalizedAlgo && !!name;
    });

    const byName = new Map();
    rows.forEach((row) => {
      const key = String(row.nama_model || "").trim();
      if (!byName.has(key)) byName.set(key, row);
    });
    const uniqueRows = Array.from(byName.values());

    if (uniqueRows.length === 0) {
      modelList.innerHTML = `<li style="opacity:.7;">No trained model for ${escapeHtml(normalizedAlgo)}</li>`;
      return;
    }

    modelList.innerHTML = uniqueRows
      .map((row) => {
        const modelName = String(row.nama_model || "").trim();
        return `<li
              data-model-id="${row.id ?? ""}"
              data-dataset-id="${row.dataset_id ?? ""}"
              data-algo="${escapeHtml(normalizedAlgo)}"
              data-lr="${escapeHtml(row.learning_rate ?? "")}"
              data-epoch="${escapeHtml(row.epoch ?? "")}"
              data-batch="${escapeHtml(row.batch_size ?? "")}"
              data-maxlen="${escapeHtml(row.max_length ?? "")}"
              data-ratio="${escapeHtml(row.split_ratio ?? "")}"
              data-optimizer="${escapeHtml(row.optimizer ?? "")}"
              data-weight-decay="${escapeHtml(row.weight_decay ?? "")}"
              data-scheduler="${escapeHtml(row.scheduler ?? "")}"
              data-dropout="${escapeHtml(row.dropout ?? "")}"
              data-early-stopping="${escapeHtml(row.early_stopping ?? "")}"
              data-grad-accum="${escapeHtml(row.gradient_accumulation ?? "")}"
            >${escapeHtml(modelName)}</li>`;
      })
      .join("");
  }

  function applyOldModelSelection(li, rerenderParams = true) {
    if (!li) return;
    const modelName = li.innerText.trim();
    document.getElementById("model-card-name").innerText = modelName || "—";
    document.getElementById("model-card").style.display = "flex";

    const modelDatasetId = parseInt(li.dataset.datasetId || "0", 10) || null;
    if (modelDatasetId) {
      selectedDatasetId = modelDatasetId;
      localStorage.setItem(STORAGE_SELECTED_DATASET_ID, String(modelDatasetId));
    }

    const modelSelect = document.getElementById("model-select");
    if (modelSelect) modelSelect.value = "lama";

    const algo = li.dataset.algo;
    if (algo) {
      const algoSelect = document.getElementById("algo-select");
      if (algoSelect) algoSelect.value = algo;
      currentAlgo = algo;
    }

    if (!rerenderParams) return;
    renderParameters(currentMode, () => {
      setTimeout(() => {
        const modelData = {
          ratio: li.dataset.ratio,
          kfold: li.dataset.kfold,
          lr: li.dataset.lr,
          epoch: li.dataset.epoch,
          batch: li.dataset.batch,
          maxlen: li.dataset.maxlen,
          optimizer: li.dataset.optimizer,
          weightDecay: li.dataset.weightDecay,
          scheduler: li.dataset.scheduler,
          warmup: li.dataset.warmup,
          dropout: li.dataset.dropout,
          earlyStopping: li.dataset.earlyStopping,
          gradAccum: li.dataset.gradAccum,
          vectorSize: li.dataset.vectorSize,
          windowSize: li.dataset.windowSize,
          minCount: li.dataset.minCount,
          modelType: li.dataset.modelType,
          negative: li.dataset.negative,
          xMax: li.dataset.xMax,
          alpha: li.dataset.alpha,
        };
        fillParametersFromModel(modelData);
        updateRatioDropdown();
        if (modelData.ratio) {
          const splitSelect = document.getElementById("split-ratio-select");
          if (splitSelect) splitSelect.value = modelData.ratio;
        }
      }, 120);
    });
  }

>>>>>>> 5389e9f (Initial commit)
  function simpanNamaModel() {
    const namaModelInput = document.getElementById("new-model-name");
    const namaModel = namaModelInput.value.trim();

    if (!namaModel) {
<<<<<<< HEAD
      showToast("⚠️ Masukkan nama model terlebih dahulu");
=======
      showToast("⚠️ Sign Inkan nama model terlebih dahulu");
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <input type="text" id="new-model-name" placeholder="Masukkan nama model baru" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${namaModel}">
=======
        <input type="text" id="new-model-name" placeholder="Sign Inkan nama model baru" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${namaModel}">
>>>>>>> 5389e9f (Initial commit)
        <button class="btn-small" id="btn-simpan-nama" style="padding:8px 16px; margin-left:10px; background:#2c1f0e; color:white; border:none; border-radius:6px; cursor:pointer;">Simpan</button>
      `;
        document
          .getElementById("btn-simpan-nama")
          .addEventListener("click", simpanNamaModel);
        modelNameSaved = false;
      });

<<<<<<< HEAD
    showToast("✅ Nama model berhasil disimpan");
=======
    showToast("✅ Model name saved successfully");
>>>>>>> 5389e9f (Initial commit)
  }

  function onAlgoChange(e) {
    currentAlgo = e.target.value;
<<<<<<< HEAD
=======
    loadTrainedModels();
>>>>>>> 5389e9f (Initial commit)

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
<<<<<<< HEAD
=======
    applyModeSpecificVisibility();
>>>>>>> 5389e9f (Initial commit)

    if (currentMode === "cari-rasio") {
      paramCardCari.style.display = "block";
      paramCardFinal.style.display = "none";

      if (ratioSection) {
<<<<<<< HEAD
=======
        ratioSection.style.display = "block";
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
=======
      selectedModel = null;
      const modelCard = document.getElementById("model-card");
      const modelCardName = document.getElementById("model-card-name");
      const modelSelect = document.getElementById("model-select");
      if (modelCard) modelCard.style.display = "none";
      if (modelCardName) modelCardName.innerText = "—";
      if (modelSelect) modelSelect.value = "";
>>>>>>> 5389e9f (Initial commit)

      // 🔧 RESET training counter ke 0 untuk Training Final
      trainingCounter = 0;

      if (ratioSection) {
<<<<<<< HEAD
        ratioSection.style.opacity = "0.9";
        ratioSection.style.pointerEvents = "none";
=======
        ratioSection.style.display = "none";
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        // Hapus semua card lama (hasil pencarian rasio)
=======
        // Delete semua card lama (hasil pencarian rasio)
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
  function onModelSelectChange(e) {
    const value = e.target.value;
    const datasetCard = document.getElementById("dataset-card");
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");

    if (value === "baru") {
      loadDatasetsForModal();
      document.getElementById("modal-dataset").style.display = "flex";
      datasetCard.style.display = "none";
=======
  function applyModeSpecificVisibility() {
    const modelSelect = document.getElementById("model-select");
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");
    const btnPilihDataset = document.getElementById("btn-pilih-dataset");
    const finalRatioBadge = document.getElementById("final-best-ratio-badge");
    const finalRatioText = document.getElementById("final-best-ratio-text");

    if (!modelSelect || !modelCard || !newModelNameCard) return;

    if (currentMode === "cari-rasio") {
      modelSelect.style.display = "none";
      modelSelect.value = "";
      modelCard.style.display = "none";
      newModelNameCard.style.display = "none";
      modelNameSaved = false;
      if (btnPilihDataset) btnPilihDataset.style.display = "inline-block";
      if (finalRatioBadge) finalRatioBadge.style.display = "none";
    } else {
      modelSelect.style.display = "inline-block";
      if (btnPilihDataset) btnPilihDataset.style.display = "none";
      if (finalRatioBadge) {
        const bestRatio =
          (globalBestParams && globalBestParams.splitRatio) ||
          document.getElementById("split-ratio-select")?.value ||
          "-";
        if (finalRatioText) finalRatioText.innerText = bestRatio;
        finalRatioBadge.style.display = "inline-flex";
      }
    }
  }

  function onModelSelectChange(e) {
    if (currentMode !== "training-final") return;

    const value = e.target.value;
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");
    const datasetCard = document.getElementById("dataset-card");

    if (value === "baru") {
      // Dataset dikunci di mode final: tidak perlu pilih ulang dataset.
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
      if (!currentAlgo) {
        showToast("⚠️ Pilih algoritma terlebih dahulu");
        e.target.value = "";
        return;
      }
      loadModelsForModal(currentAlgo);
      document.getElementById("modal-lama").style.display = "flex";
      datasetCard.style.display = "none";
=======
      loadTrainedModels();
      document.getElementById("modal-lama").style.display = "flex";
      if (datasetCard) datasetCard.style.display = "none";
>>>>>>> 5389e9f (Initial commit)
      modelCard.style.display = "flex";
      newModelNameCard.style.display = "none";
    }
  }

<<<<<<< HEAD
  async function loadModelsForModal(algo) {
    const modelList = document.getElementById("model-list");
    if (!modelList) return;

    modelList
      .querySelectorAll("li")
      .forEach((li) => li.classList.remove("selected"));
    selectedModel = null;
    modelList.innerHTML = '<li style="opacity:0.7;">Memuat model...</li>';

    const fallbackStaticModels = () => {
      const staticEntries = [
        {
          name: "IndoBERT-Final-v1",
          attrs: {
            "data-algo": "indobert",
            "data-lr": "0.00002",
            "data-epoch": "3",
            "data-batch": "16",
            "data-maxlen": "32",
            "data-ratio": "80",
            "data-kfold": "5",
            "data-optimizer": "AdamW",
            "data-weight-decay": "0.01",
            "data-scheduler": "linear",
            "data-warmup": "0.1",
            "data-dropout": "0.1",
            "data-early-stopping": "2",
            "data-grad-accum": "1",
          },
        },
        {
          name: "mBERT-Kawanua-Base",
          attrs: {
            "data-algo": "mbert",
            "data-lr": "0.00003",
            "data-epoch": "4",
            "data-batch": "32",
            "data-maxlen": "64",
            "data-ratio": "70",
            "data-kfold": "",
            "data-optimizer": "AdamW",
            "data-weight-decay": "0.01",
            "data-scheduler": "linear",
            "data-warmup": "0.1",
            "data-dropout": "0.1",
            "data-early-stopping": "3",
            "data-grad-accum": "2",
          },
        },
        {
          name: "XLM-R-Large-v2",
          attrs: {
            "data-algo": "xlm-r",
            "data-lr": "0.00001",
            "data-epoch": "3",
            "data-batch": "8",
            "data-maxlen": "128",
            "data-ratio": "80",
            "data-kfold": "5",
            "data-optimizer": "AdamW",
            "data-weight-decay": "0.01",
            "data-scheduler": "linear",
            "data-warmup": "0.1",
            "data-dropout": "0.1",
            "data-early-stopping": "2",
            "data-grad-accum": "1",
          },
        },
        {
          name: "Word2Vec-SkipGram-v1",
          attrs: {
            "data-algo": "word2vec",
            "data-lr": "0.025",
            "data-epoch": "50",
            "data-vector-size": "100",
            "data-window-size": "5",
            "data-min-count": "1",
            "data-model-type": "skip-gram",
            "data-negative": "5",
            "data-ratio": "80",
          },
        },
        {
          name: "GloVe-Enhanced-v1",
          attrs: {
            "data-algo": "glove",
            "data-lr": "0.05",
            "data-epoch": "50",
            "data-vector-size": "100",
            "data-window-size": "5",
            "data-min-count": "1",
            "data-x-max": "100",
            "data-alpha": "0.75",
            "data-ratio": "80",
          },
        },
      ];

      const filtered = staticEntries.filter(
        (entry) => (entry.attrs["data-algo"] || "").toLowerCase() === algo,
      );
      if (filtered.length === 0) {
        modelList.innerHTML =
          '<li style="opacity:0.8;">Belum ada model tersimpan untuk algoritma ini</li>';
        return;
      }

      modelList.innerHTML = filtered
        .map((entry) => {
          const attrs = Object.entries(entry.attrs)
            .map(([key, val]) => `${key}="${val ?? ""}"`)
            .join(" ");
          return `<li ${attrs}>${entry.name}</li>`;
        })
        .join("");
    };

    if (!supabaseClient) {
      fallbackStaticModels();
      return;
    }

    const { data, error } = await supabaseClient
      .from("models")
      .select(
        "id,nama_model,algoritma,mode,dataset_id,split_ratio,k_fold,learning_rate,epoch,batch_size,max_length,optimizer,weight_decay,scheduler,dropout,early_stopping,gradient_accumulation,created_at",
      )
      .eq("algoritma", algo)
      .order("id", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Gagal memuat model lama:", error);
      fallbackStaticModels();
      return;
    }

    if (!data || data.length === 0) {
      modelList.innerHTML =
        '<li style="opacity:0.8;">Belum ada model tersimpan untuk algoritma ini</li>';
      return;
    }

    // Normalisasi nama model agar "model | ID: xxx | ..." tetap dianggap model yang sama.
    const normalizeModelName = (name) =>
      String(name || "")
        .split("|")[0]
        .trim()
        .toLowerCase();

    // Kumpulkan semua ID per model (nama+algo+dataset) agar riwayat rasio bisa digabung saat load.
    const idsByModelKey = new Map();
    const ratioIdsByModelKey = new Map();
    for (const row of data) {
      const modelKey = `${(row.algoritma || "").toLowerCase()}::${normalizeModelName(row.nama_model)}::${row.dataset_id ?? ""}`;
      if (!idsByModelKey.has(modelKey)) {
        idsByModelKey.set(modelKey, []);
      }
      idsByModelKey.get(modelKey).push(Number(row.id));
      if (String(row.mode || "").toLowerCase() === "cari-rasio") {
        if (!ratioIdsByModelKey.has(modelKey)) {
          ratioIdsByModelKey.set(modelKey, []);
        }
        ratioIdsByModelKey.get(modelKey).push(Number(row.id));
      }
    }

    // Pilih 1 baris representatif per model key berdasarkan data terbaru.
    // Tidak ada prioritas mode training-final: model non-final tetap harus muncul.
    const byModelKey = new Map();
    for (const row of data) {
      const key = `${(row.algoritma || "").toLowerCase()}::${normalizeModelName(row.nama_model)}::${row.dataset_id ?? ""}`;
      if (!byModelKey.has(key)) {
        byModelKey.set(key, []);
      }
      byModelKey.get(key).push(row);
    }
    const uniqueByModel = Array.from(byModelKey.values())
      .map((rows) => rows[0])
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    modelList.innerHTML = uniqueByModel
      .map((model) => {
        const name = model.nama_model || `Model #${model.id}`;
        const createdAt = model.created_at
          ? new Date(model.created_at).toLocaleDateString("id-ID")
          : "-";
        const modelKey = `${(model.algoritma || "").toLowerCase()}::${normalizeModelName(model.nama_model)}::${model.dataset_id ?? ""}`;
        const groupedIds = idsByModelKey.get(modelKey) || [Number(model.id)];
        const groupedRatioIds = ratioIdsByModelKey.get(modelKey) || [];
        return `
        <li
          data-id="${model.id}"
          data-model-ids='${JSON.stringify(groupedIds)}'
          data-ratio-model-ids='${JSON.stringify(groupedRatioIds)}'
          data-model-name="${name}"
          data-algo="${(model.algoritma || "").toLowerCase()}"
          data-dataset-id="${model.dataset_id ?? ""}"
          data-lr="${model.learning_rate ?? ""}"
          data-epoch="${model.epoch ?? ""}"
          data-batch="${model.batch_size ?? ""}"
          data-maxlen="${model.max_length ?? ""}"
          data-ratio="${model.split_ratio ?? ""}"
          data-kfold="${model.k_fold ?? ""}"
          data-optimizer="${model.optimizer ?? ""}"
          data-weight-decay="${model.weight_decay ?? ""}"
          data-scheduler="${model.scheduler ?? ""}"
          data-warmup=""
          data-dropout="${model.dropout ?? ""}"
          data-early-stopping="${model.early_stopping ?? ""}"
          data-grad-accum="${model.gradient_accumulation ?? ""}"
        >
          <strong>${name}</strong><br>
          <small>ID: ${model.id} | ${createdAt}</small>
        </li>
      `;
      })
      .join("");
  }

  async function loadDatasetsForModal() {
    const datasetList = document.getElementById("dataset-list");
    if (!datasetList) return;

    if (!supabaseClient) {
      datasetList.innerHTML =
        '<li style="color:#c62828;">Supabase client tidak tersedia</li>';
      return;
    }

    datasetList.innerHTML = '<li style="opacity:0.7;">Memuat dataset...</li>';

    const { data, error } = await supabaseClient
      .from("datasets")
      .select("id,name,file_name,total_data,is_preprocessed,created_at")
      .eq("is_preprocessed", true)
      .order("id", { ascending: false });

    if (error) {
      console.error("Gagal load datasets:", error);
      datasetList.innerHTML =
        '<li style="color:#c62828;">Gagal memuat dataset</li>';
      return;
    }

    if (!data || data.length === 0) {
      datasetList.innerHTML =
        '<li style="opacity:0.8;">Belum ada dataset yang sudah dipreprocess</li>';
      return;
    }

    datasetList.innerHTML = data
      .map((ds) => {
        const displayName = ds.name || ds.file_name || `Dataset #${ds.id}`;
        const total = ds.total_data ?? 0;
        const dateLabel = ds.created_at
          ? new Date(ds.created_at).toLocaleDateString("id-ID")
          : "-";
        return `
          <li data-id="${ds.id}" title="${displayName}">
            <strong>${displayName}</strong><br>
            <small>ID: ${ds.id} | Total: ${total} | ${dateLabel}</small>
          </li>
        `;
      })
      .join("");
  }

=======
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        '<p style="color:#999; text-align:center; padding:20px;">Pilih algoritma terlebih dahulu</p>';
=======
        '<p style="color:#999; text-align:center; padding:20px;">Select algorithm first</p>';
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        console.log("❌ split-ratio-select tidak ditemukan");
=======
        console.log("❌ split-ratio-select not found");
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        console.log(`⚠️ ${mapping.id} value kosong:`, value);
      } else {
        console.log(`❌ ${mapping.id} tidak ditemukan`);
=======
        console.log(`⚠️ ${mapping.id} value is empty:`, value);
      } else {
        console.log(`❌ ${mapping.id} not found`);
>>>>>>> 5389e9f (Initial commit)
      }
    });
  }

  function generateSplitValidationParams() {
    return `
    <div class="param-row">
      <div class="param-group" style="grid-column: span 2;">
<<<<<<< HEAD
        <label>Rasio Data Split</label>
        <select id="split-ratio-select" class="split-select">
          <option value="" disabled selected>-- Pilih Rasio --</option>
=======
        ${renderLabelWithTooltip("Split Data Ratio", "split_ratio")}
        <select id="split-ratio-select" class="split-select">
          <option value="" disabled selected>-- Select Ratio --</option>
>>>>>>> 5389e9f (Initial commit)
        </select>
      </div>
    </div>
  `;
  }

<<<<<<< HEAD
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
=======
  function renderLabelWithTooltip(label, key) {
    const content = PARAM_TOOLTIPS[key] || PARAM_TOOLTIPS.default;
    return `
      <label class="label-with-help">
        <span>${label}</span>
        <span class="param-help-icon">i
          <span class="param-help-tooltip">${content}</span>
        </span>
      </label>
    `;
  }

  const PARAM_TOOLTIPS = {
    default:
      "<strong>Function:</strong> Controls the training process.<br><strong>Impact:</strong> Values affect model speed and quality.<br><strong>Risk:</strong> Unbalanced values can reduce model performance.",
    split_ratio:
      "<strong>Function:</strong> Splits data into train and test sets.<br><strong>Impact:</strong> Larger train portions usually improve learning.<br><strong>Risk:</strong> Very small test portions reduce evaluation reliability.",
    lr:
      "<strong>Function:</strong> Sets the update step size for model weights.<br><strong>Impact:</strong> Smaller values are more stable, larger values are faster.<br><strong>Risk:</strong> Too large may not converge, too small makes training very slow.",
    epoch:
      "<strong>Function:</strong> Number of passes over train data.<br><strong>Impact:</strong> More epochs may improve performance.<br><strong>Risk:</strong> Too high may overfit, too low may undertrain.",
    batch_size:
      "<strong>Function:</strong> Number of samples processed per step.<br><strong>Impact:</strong> Larger batches are more stable, smaller batches use less memory.<br><strong>Risk:</strong> Too large may cause OOM, too small may be noisy or unstable.",
    max_length:
      "<strong>Function:</strong> Maximum token length per text.<br><strong>Impact:</strong> Higher values capture longer context.<br><strong>Risk:</strong> Too low cuts information, too high is slower and memory-heavy.",
    optimizer:
      "<strong>Function:</strong> Model weight update method.<br><strong>Impact:</strong> Affects stability and convergence speed.<br><strong>Risk:</strong> An unsuitable optimizer can prevent metric improvement.",
    weight_decay:
      "<strong>Function:</strong> Regularization to limit oversized weights.<br><strong>Impact:</strong> Helps model generalization.<br><strong>Risk:</strong> Too high may underfit, too low may overfit.",
    scheduler:
      "<strong>Function:</strong> Controls learning rate changes during training.<br><strong>Impact:</strong> Improves stability in later epochs.<br><strong>Risk:</strong> An unsuitable schedule may slow or disrupt convergence.",
    warmup:
      "<strong>Function:</strong> Initial phase that increases learning rate gradually.<br><strong>Impact:</strong> Reduces sudden updates at early training stages.<br><strong>Risk:</strong> Too high slows training, too low may remain unstable initially.",
    dropout:
      "<strong>Function:</strong> Randomly disables neurons during training.<br><strong>Impact:</strong> Reduces overfitting.<br><strong>Risk:</strong> Too high makes learning difficult, too low increases overfitting risk.",
    early_stopping:
      "<strong>Function:</strong> Stops training when validation performance no longer improves.<br><strong>Impact:</strong> Saves time and reduces overfitting risk.<br><strong>Risk:</strong> Too low may stop too early, too high may stop too late.",
    grad_accum:
      "<strong>Function:</strong> Accumulates gradient steps before each update.<br><strong>Impact:</strong> Simulates larger batches without major memory increase.<br><strong>Risk:</strong> Too high can make updates feel slow.",
    vector_size:
      "<strong>Function:</strong> Vector dimension for kata embeddings (Word2Vec/GloVe).<br><strong>Impact:</strong> Higher dimensions can capture richer features.<br><strong>Risk:</strong> Too high may overfit/slow down, too low may lose information.",
    window_size:
      "<strong>Function:</strong> Context window size observed by the model.<br><strong>Impact:</strong> Larger windows capture broader context.<br><strong>Risk:</strong> Too large may add noise, too small may miss context.",
    min_count:
      "<strong>Function:</strong> Minimum kata frequency to be included in training.<br><strong>Impact:</strong> Filters very rare/noisy kata.<br><strong>Risk:</strong> Too high removes important kata, too low retains noise.",
    model_type:
      "<strong>Function:</strong> Chooses Word2Vec architecture (CBOW/Skip-gram).<br><strong>Impact:</strong> Skip-gram is usually better for rare kata, CBOW is faster.<br><strong>Risk:</strong> Wrong selection may reduce embedding quality.",
    negative:
      "<strong>Function:</strong> Number of negative samples for embedding training.<br><strong>Impact:</strong> Helps the model distinguish correct/incorrect context.<br><strong>Risk:</strong> Too high is computationally heavy, too low is less effective.",
    x_max:
      "<strong>Function:</strong> Frequency weighting cap in GloVe.<br><strong>Impact:</strong> Controls the influence of very frequent kata pairs.<br><strong>Risk:</strong> Too low/high may cause unbalanced weighting.",
    alpha:
      "<strong>Function:</strong> Frequency weighting exponent in GloVe.<br><strong>Impact:</strong> Determines sensitivity to kata frequency.<br><strong>Risk:</strong> Extreme values may destabilize embeddings.",
  };

  // ==================== INDOBERT PARAMETERS (DROPDOWN) ====================
  function generateIndoBERTParams() {
    return `
    <div class="layer-card">
      <div class="layer-header">
        <h4>1. Input Layer</h4>
        <p>Parameter input dibedakan dari layer lain untuk menyesuaikan token teks yang masuk ke IndoBERT.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Batch Size", "batch_size")}
          <input type="text" id="batch-size" list="batch-size-options" placeholder="Select or type manually" value="">
          <datalist id="batch-size-options">
            <option value="8">8</option>
            <option value="16">16 (Recommended)</option>
            <option value="32">32</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Max Length", "max_length")}
          <input type="text" id="max-length" list="max-length-options" placeholder="Select or type manually" value="">
          <datalist id="max-length-options">
            <option value="8">8</option>
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64 (Recommended)</option>
          </datalist>
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          <label>Input Representation</label>
          <input type="text" value="WordPiece Tokens + [CLS]/[SEP]" disabled>
          <small>Representasi input mengikuti tokenizer bawaan IndoBERT.</small>
        </div>
        <div class="param-group">
          <label>Attention Mask</label>
          <input type="text" value="Automatic" disabled>
          <small>Otomatis dibentuk saat fine-tuning.</small>
        </div>
      </div>
    </div>

    <div class="layer-card">
      <div class="layer-header">
        <h4>2. Hidden Layer</h4>
        <p>Hyperparameter fine-tuning encoder IndoBERT dan classifier head.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Learning Rate", "lr")}
          <input type="text" id="lr" list="lr-options" placeholder="Select or type manually" value="">
          <datalist id="lr-options">
            <option value="1e-5">1e-5</option>
            <option value="2e-5">2e-5 (Recommended)</option>
            <option value="3e-5">3e-5</option>
            <option value="5e-5">5e-5</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Epoch", "epoch")}
          <input type="number" id="epoch" placeholder="Contoh: 3" value="" min="1" max="100">
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Optimizer", "optimizer")}
          <input type="text" id="optimizer" list="optimizer-options" placeholder="Select or type manually" value="">
          <datalist id="optimizer-options">
            <option value="AdamW">AdamW (Recommended)</option>
            <option value="Adam">Adam</option>
            <option value="SGD">SGD</option>
            <option value="RMSProp">RMSProp</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Weight Decay", "weight_decay")}
          <input type="text" id="weight-decay" list="weight-decay-options" placeholder="Select or type manually" value="">
          <datalist id="weight-decay-options">
            <option value="0.0">0.0</option>
            <option value="0.01">0.01 (Recommended)</option>
            <option value="0.05">0.05</option>
          </datalist>
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Scheduler", "scheduler")}
          <input type="text" id="scheduler" list="scheduler-options" placeholder="Select or type manually" value="">
          <datalist id="scheduler-options">
            <option value="linear">Linear (Recommended)</option>
            <option value="cosine">Cosine</option>
            <option value="step">Step</option>
            <option value="exponential">Exponential</option>
            <option value="constant">Constant</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Warmup Ratio", "warmup")}
          <input type="text" id="warmup" list="warmup-options" placeholder="Select or type manually" value="">
          <datalist id="warmup-options">
            <option value="0.0">0.0</option>
            <option value="0.1">0.1 (Recommended)</option>
            <option value="0.2">0.2</option>
            <option value="0.3">0.3</option>
          </datalist>
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Dropout", "dropout")}
          <input type="text" id="dropout" list="dropout-options" placeholder="Select or type manually" value="">
          <datalist id="dropout-options">
            <option value="0.1">0.1 (Recommended)</option>
            <option value="0.2">0.2</option>
            <option value="0.3">0.3</option>
          </datalist>
          <small>Dropout dan weight decay bekerja pada classifier head saat fine-tuning.</small>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Gradient Accumulation", "grad_accum")}
          <input type="text" id="grad-accum" list="grad-accum-options" placeholder="Select or type manually" value="">
          <datalist id="grad-accum-options">
            <option value="1">1 (Recommended)</option>
            <option value="2">2</option>
            <option value="4">4</option>
          </datalist>
        </div>
      </div>
    </div>

    <div class="layer-card">
      <div class="layer-header">
        <h4>3. Output Layer</h4>
        <p>Konfigurasi keluaran untuk klasifikasi fine-tuning dengan Softmax.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          <label>Output Activation</label>
          <input type="text" value="Softmax" disabled>
          <small>Hasil akhir menggunakan Softmax untuk probabilitas kelas.</small>
        </div>
        <div class="param-group">
          <label>Loss Function</label>
          <input type="text" value="Cross Entropy" disabled>
          <small>Loss utama untuk klasifikasi multi-class.</small>
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Early Stopping", "early_stopping")}
          <input type="text" id="early-stopping" list="early-stopping-options" placeholder="Select or type manually" value="">
          <datalist id="early-stopping-options">
            <option value="0">Nonaktif</option>
            <option value="2">Aktif (patience 2) (Recommended)</option>
            <option value="3">Aktif (patience 3)</option>
          </datalist>
        </div>
        <div class="param-group">
          <label>Prediction Target</label>
          <input type="text" value="Label Class" disabled>
          <small>Neuron output mewakili jumlah label pada dataset.</small>
        </div>
>>>>>>> 5389e9f (Initial commit)
      </div>
    </div>
  `;
  }

  // ==================== mBERT PARAMETERS  ====================
  // ==================== mBERT PARAMETERS (DATALIST) ====================
  function generateMBERTParams() {
    return `
<<<<<<< HEAD
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
=======
    <div class="layer-card">
      <div class="layer-header">
        <h4>1. Input Layer</h4>
        <p>Parameter input dibedakan dari layer lain untuk menyesuaikan token teks yang masuk ke mBERT.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Batch Size", "batch_size")}
          <input type="text" id="batch-size" list="batch-size-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="batch-size-options-mbert">
            <option value="8">8</option>
            <option value="16">16 (Recommended)</option>
            <option value="32">32</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Max Length", "max_length")}
          <input type="text" id="max-length" list="max-length-options-mbert" placeholder="Select or type manually" value="">
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
          <label>Input Representation</label>
          <input type="text" value="WordPiece Tokens + [CLS]/[SEP]" disabled>
          <small>Representasi input mengikuti tokenizer bawaan mBERT.</small>
        </div>
        <div class="param-group">
          <label>Attention Mask</label>
          <input type="text" value="Automatic" disabled>
          <small>Otomatis dibentuk saat fine-tuning.</small>
        </div>
      </div>
    </div>

    <div class="layer-card">
      <div class="layer-header">
        <h4>2. Hidden Layer</h4>
        <p>Hyperparameter fine-tuning encoder mBERT dan classifier head.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Learning Rate", "lr")}
          <input type="text" id="lr" list="lr-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="lr-options-mbert">
            <option value="1e-5">1e-5</option>
            <option value="2e-5">2e-5 (Recommended)</option>
            <option value="3e-5">3e-5</option>
            <option value="5e-5">5e-5</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Epoch", "epoch")}
          <input type="number" id="epoch" placeholder="Contoh: 4 (Range: 2–5)" value="" min="1" max="100">
        </div>
      </div>

      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Optimizer", "optimizer")}
          <input type="text" id="optimizer" list="optimizer-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="optimizer-options-mbert">
            <option value="AdamW">AdamW (Recommended)</option>
            <option value="Adam">Adam</option>
            <option value="SGD">SGD</option>
            <option value="RMSProp">RMSProp</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Weight Decay", "weight_decay")}
          <input type="text" id="weight-decay" list="weight-decay-options-mbert" placeholder="Select or type manually" value="">
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
          ${renderLabelWithTooltip("Scheduler", "scheduler")}
          <input type="text" id="scheduler" list="scheduler-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="scheduler-options-mbert">
            <option value="linear">Linear (Recommended)</option>
            <option value="cosine">Cosine</option>
            <option value="step">Step</option>
            <option value="exponential">Exponential</option>
            <option value="constant">Constant</option>
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Warmup Ratio", "warmup")}
          <input type="text" id="warmup" list="warmup-options-mbert" placeholder="Select or type manually" value="">
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
          ${renderLabelWithTooltip("Dropout", "dropout")}
          <input type="text" id="dropout" list="dropout-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="dropout-options-mbert">
            <option value="0.0">0.0</option>
            <option value="0.1">0.1 (Recommended)</option>
            <option value="0.2">0.2</option>
            <option value="0.3">0.3</option>
            <option value="0.5">0.5</option>
          </datalist>
          <small>Dropout dan weight decay bekerja pada classifier head saat fine-tuning.</small>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Gradient Accumulation", "grad_accum")}
          <input type="text" id="grad-accum" list="grad-accum-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="grad-accum-options-mbert">
            <option value="1">1 (Recommended)</option>
            <option value="2">2</option>
            <option value="4">4</option>
          </datalist>
        </div>
      </div>
    </div>

    <div class="layer-card">
      <div class="layer-header">
        <h4>3. Output Layer</h4>
        <p>Konfigurasi keluaran untuk klasifikasi fine-tuning dengan Softmax.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          <label>Output Activation</label>
          <input type="text" value="Softmax" disabled>
          <small>Hasil akhir menggunakan Softmax untuk probabilitas kelas.</small>
        </div>
        <div class="param-group">
          <label>Loss Function</label>
          <input type="text" value="Cross Entropy" disabled>
          <small>Loss utama untuk klasifikasi multi-class.</small>
        </div>
      </div>

      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Early Stopping", "early_stopping")}
          <input type="text" id="early-stopping" list="early-stopping-options-mbert" placeholder="Select or type manually" value="">
          <datalist id="early-stopping-options-mbert">
            <option value="0">Nonaktif</option>
            <option value="2">2</option>
            <option value="3">3 (Recommended)</option>
            <option value="5">5</option>
          </datalist>
        </div>
        <div class="param-group">
          <label>Prediction Target</label>
          <input type="text" value="Label Class" disabled>
          <small>Neuron output mewakili jumlah label pada dataset.</small>
        </div>
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Learning Rate", "lr")}
        <input type="text" id="lr" list="lr-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="lr-options-xlmr">
          <option value="1e-5">1e-5 (Recommended)</option>
          <option value="1.5e-5">1.5e-5</option>
          <option value="2e-5">2e-5</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Epoch</label>
=======
        ${renderLabelWithTooltip("Epoch", "epoch")}
>>>>>>> 5389e9f (Initial commit)
        <input type="number" id="epoch" placeholder="Contoh: 3 (Range: 3–5)" value="" min="1" max="100">
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Batch Size</label>
        <input type="text" id="batch-size" list="batch-size-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Batch Size", "batch_size")}
        <input type="text" id="batch-size" list="batch-size-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="batch-size-options-xlmr">
          <option value="8">8 (Recommended)</option>
          <option value="16">16</option>
          <option value="32">32</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Max Length</label>
        <input type="text" id="max-length" list="max-length-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Max Length", "max_length")}
        <input type="text" id="max-length" list="max-length-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Optimizer</label>
        <input type="text" id="optimizer" list="optimizer-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Optimizer", "optimizer")}
        <input type="text" id="optimizer" list="optimizer-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="optimizer-options-xlmr">
          <option value="AdamW">AdamW (Recommended)</option>
          <option value="Adam">Adam</option>
          <option value="SGD">SGD</option>
          <option value="RMSProp">RMSProp</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Weight Decay</label>
        <input type="text" id="weight-decay" list="weight-decay-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Weight Decay", "weight_decay")}
        <input type="text" id="weight-decay" list="weight-decay-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="weight-decay-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.01">0.01 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Scheduler</label>
        <input type="text" id="scheduler" list="scheduler-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Scheduler", "scheduler")}
        <input type="text" id="scheduler" list="scheduler-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="scheduler-options-xlmr">
          <option value="linear">Linear (Recommended)</option>
          <option value="cosine">Cosine</option>
          <option value="step">Step</option>
          <option value="exponential">Exponential</option>
          <option value="constant">Constant</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Warmup Steps</label>
        <input type="text" id="warmup" list="warmup-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Warmup Steps", "warmup")}
        <input type="text" id="warmup" list="warmup-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="warmup-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Dropout</label>
        <input type="text" id="dropout" list="dropout-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Dropout", "dropout")}
        <input type="text" id="dropout" list="dropout-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="dropout-options-xlmr">
          <option value="0.0">0.0</option>
          <option value="0.1">0.1 (Recommended)</option>
          <option value="0.2">0.2</option>
          <option value="0.3">0.3</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Early Stopping</label>
        <input type="text" id="early-stopping" list="early-stopping-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Early Stopping", "early_stopping")}
        <input type="text" id="early-stopping" list="early-stopping-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Gradient Accumulation</label>
        <input type="text" id="grad-accum" list="grad-accum-options-xlmr" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Gradient Accumulation", "grad_accum")}
        <input type="text" id="grad-accum" list="grad-accum-options-xlmr" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Vector Size</label>
        <input type="text" id="vector-size" list="vector-size-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Vector Size", "vector_size")}
        <input type="text" id="vector-size" list="vector-size-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="vector-size-options-w2v">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Window Size</label>
        <input type="text" id="window-size" list="window-size-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Window Size", "window_size")}
        <input type="text" id="window-size" list="window-size-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Min Count</label>
        <input type="text" id="min-count" list="min-count-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Min Count", "min_count")}
        <input type="text" id="min-count" list="min-count-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="min-count-options-w2v">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Learning Rate", "lr")}
        <input type="text" id="lr" list="lr-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="lr-options-w2v">
          <option value="0.01">0.01</option>
          <option value="0.025">0.025 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        <label>Model Type</label>
        <input type="text" id="model-type" list="model-type-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Epoch", "epoch")}
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Model Type", "model_type")}
        <input type="text" id="model-type" list="model-type-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="model-type-options-w2v">
          <option value="skip-gram">Skip-gram (Recommended)</option>
          <option value="cbow">CBOW</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Negative Sampling</label>
        <input type="text" id="negative" list="negative-options-w2v" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Negative Sampling", "negative")}
        <input type="text" id="negative" list="negative-options-w2v" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Vector Size</label>
        <input type="text" id="vector-size" list="vector-size-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Vector Size", "vector_size")}
        <input type="text" id="vector-size" list="vector-size-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="vector-size-options-glove">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Window Size</label>
        <input type="text" id="window-size" list="window-size-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Window Size", "window_size")}
        <input type="text" id="window-size" list="window-size-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
        <label>Min Count</label>
        <input type="text" id="min-count" list="min-count-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Min Count", "min_count")}
        <input type="text" id="min-count" list="min-count-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="min-count-options-glove">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
<<<<<<< HEAD
        <label>Learning Rate</label>
        <input type="text" id="lr" list="lr-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Learning Rate", "lr")}
        <input type="text" id="lr" list="lr-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="lr-options-glove">
          <option value="0.01">0.01</option>
          <option value="0.05">0.05 (Recommended)</option>
          <option value="0.1">0.1</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Epoch</label>
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        <label>X_max</label>
        <input type="text" id="x-max" list="x-max-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Epoch", "epoch")}
        <input type="number" id="epoch" placeholder="Contoh: 50" value="" min="1">
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("X_max", "x_max")}
        <input type="text" id="x-max" list="x-max-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
        <datalist id="x-max-options-glove">
          <option value="50">50</option>
          <option value="100">100 (Recommended)</option>
          <option value="200">200</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
<<<<<<< HEAD
        <label>Alpha</label>
        <input type="text" id="alpha" list="alpha-options-glove" placeholder="Pilih atau ketik manual" value="">
=======
        ${renderLabelWithTooltip("Alpha", "alpha")}
        <input type="text" id="alpha" list="alpha-options-glove" placeholder="Select or type manually" value="">
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
      showToast("⚠️ Pilih dataset terlebih dahulu");
=======
      showToast("⚠️ Select dataset first");
>>>>>>> 5389e9f (Initial commit)
      return;
    }

    const datasetName = selected.innerText.trim();
<<<<<<< HEAD
    const datasetIdRaw = selected.dataset.id || selected.dataset.datasetId;
    const datasetId = datasetIdRaw ? parseInt(datasetIdRaw, 10) : null;
    selectedDataset = { name: datasetName, id: datasetId };
    document.getElementById("dataset-card-name").innerText = datasetName;
    document.getElementById("dataset-card").style.display = "flex";

    const modelSelect = document.getElementById("model-select");
    modelSelect.value = "baru";

=======
    selectedDatasetId = parseInt(selected.dataset.datasetId || "0", 10) || null;
    if (selectedDatasetId) {
      localStorage.setItem(STORAGE_SELECTED_DATASET_ID, String(selectedDatasetId));
      localStorage.setItem(STORAGE_SELECTED_DATASET_NAME, datasetName);
    }
    document.getElementById("dataset-card-name").innerText = datasetName;
    document.getElementById("dataset-card").style.display = "flex";

>>>>>>> 5389e9f (Initial commit)
    const ratio = selected.dataset.ratio;
    const kfold = selected.dataset.kfold;

    setTimeout(() => {
      if (ratio) {
        const splitSelect = document.getElementById("split-ratio-select");
        if (splitSelect) splitSelect.value = ratio;
      }
    }, 100);

    closeModalDataset();
<<<<<<< HEAD
    showToast("✅ Dataset berhasil dipilih");
=======
    showToast("✅ Dataset selected successfully");
>>>>>>> 5389e9f (Initial commit)
  };

  window.closeModalDataset = function () {
    const modal = document.getElementById("modal-dataset");
<<<<<<< HEAD
    if (modal) modal.style.display = "none";
=======
    if (modal) {
      modal.style.display = "none";
    }
>>>>>>> 5389e9f (Initial commit)
  };

  window.closeModalLama = function () {
    const modal = document.getElementById("modal-lama");
    modal.style.display = "none";

<<<<<<< HEAD
    applySelectedOldModel();
=======
    if (!selectedModel) {
      selectedModel = document.querySelector("#model-list li.selected");
    }

    if (selectedModel) {
      const modelName = selectedModel.innerText.trim();
      applyOldModelSelection(selectedModel);
      showToast(`✅ Model "${modelName}" loaded successfully!`, "success");
    }
>>>>>>> 5389e9f (Initial commit)

    document
      .querySelectorAll("#model-list li")
      .forEach((el) => el.classList.remove("selected"));
    selectedModel = null;
  };

<<<<<<< HEAD
  function applySelectedOldModel() {
    if (!selectedModel) return;
    // Snapshot elemen yang dipilih agar aman meski selectedModel di-reset setelah modal ditutup.
    const pickedModel = selectedModel;
    const modelName =
      pickedModel.dataset.modelName ||
      pickedModel.querySelector("strong")?.innerText?.trim() ||
      pickedModel.innerText.trim();
    document.getElementById("model-card-name").innerText = modelName;
    document.getElementById("model-card").style.display = "flex";

    const modelSelect = document.getElementById("model-select");
    modelSelect.value = "lama";

    const algo = pickedModel.dataset.algo;
    if (!algo) return;

    const datasetId = Number(pickedModel.dataset.datasetId || 0);
    if (datasetId > 0) {
      selectedDataset = {
        id: datasetId,
        name: `Dataset #${datasetId}`,
      };
      const datasetCard = document.getElementById("dataset-card");
      const datasetCardName = document.getElementById("dataset-card-name");
      if (datasetCard && datasetCardName) {
        datasetCardName.innerText = selectedDataset.name;
        datasetCard.style.display = "flex";
      }
    }

    document.getElementById("algo-select").value = algo;
    currentAlgo = algo;

    renderParameters(currentMode, () => {
      setTimeout(() => {
        const modelData = {
          ratio: pickedModel.dataset.ratio,
          kfold: pickedModel.dataset.kfold,
          lr: pickedModel.dataset.lr,
          epoch: pickedModel.dataset.epoch,
          batch: pickedModel.dataset.batch,
          maxlen: pickedModel.dataset.maxlen,
          optimizer: pickedModel.dataset.optimizer,
          weightDecay: pickedModel.dataset.weightDecay,
          scheduler: pickedModel.dataset.scheduler,
          warmup: pickedModel.dataset.warmup,
          dropout: pickedModel.dataset.dropout,
          earlyStopping: pickedModel.dataset.earlyStopping,
          gradAccum: pickedModel.dataset.gradAccum,
          vectorSize: pickedModel.dataset.vectorSize,
          windowSize: pickedModel.dataset.windowSize,
          minCount: pickedModel.dataset.minCount,
          modelType: pickedModel.dataset.modelType,
          negative: pickedModel.dataset.negative,
          xMax: pickedModel.dataset.xMax,
          alpha: pickedModel.dataset.alpha,
        };

        fillParametersFromModel(modelData);
        updateRatioDropdown();

        if (modelData.ratio) {
          const splitSelect = document.getElementById("split-ratio-select");
          if (splitSelect) splitSelect.value = modelData.ratio;
        }

        let modelIds = [];
        try {
          modelIds = JSON.parse(pickedModel.dataset.ratioModelIds || "[]");
        } catch (_) {
          modelIds = [];
        }
        // Fallback ke semua model id jika belum ada data cari-rasio.
        if (!Array.isArray(modelIds) || modelIds.length === 0) {
          try {
            modelIds = JSON.parse(pickedModel.dataset.modelIds || "[]");
          } catch (_) {
            modelIds = [];
          }
        }
        if (!Array.isArray(modelIds) || modelIds.length === 0) {
          const singleId = Number(pickedModel.dataset.id || 0);
          if (singleId > 0) modelIds = [singleId];
        }

        if (modelIds.length > 0) {
          loadRatioMetricsForModelIds(modelIds).catch((err) => {
            console.error("Gagal memuat metrics per rasio:", err);
          });
        }

        showToast(`✅ Model "${modelName}" berhasil dimuat!`, "success");
      }, 150);
    });
  }

  async function loadRatioMetricsForModelIds(modelIds) {
    if (!supabaseClient) return;
    const ids = (Array.isArray(modelIds) ? modelIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;

    let data = [];
    let fetchOk = false;
    try {
      const resp = await fetch(
        `http://127.0.0.1:8000/processing/model-ratio-results?modelIds=${encodeURIComponent(ids.join(","))}`,
      );
      if (resp.ok) {
        const body = await resp.json();
        if (Array.isArray(body?.data)) {
          data = body.data;
          fetchOk = true;
        }
      }
    } catch (_) {}

    if (!fetchOk && supabaseClient) {
      const { data: sbData, error } = await supabaseClient
        .from("model_ratio_results")
        .select(
          "model_id,split_ratio,learning_rate,batch_size,max_length,optimizer,weight_decay,scheduler,warmup,dropout,early_stopping,gradient_accumulation,epoch,accuracy,precision,recall,f1_score,loss,mcc",
        )
        .in("model_id", ids)
        .order("epoch", { ascending: true });
      if (!error && Array.isArray(sbData)) {
        data = sbData;
        fetchOk = true;
      }
    }

    const cachedRows = ids.length > 0 ? getEpochRowsFromCache(ids) : [];
    if (cachedRows.length > 0) {
      // Jika backend hanya kirim ringkasan 1-row/model, cache lokal biasanya lebih kaya (multi-epoch).
      const serverRowsCount = Array.isArray(data) ? data.length : 0;
      if (!fetchOk || serverRowsCount === 0 || cachedRows.length > serverRowsCount) {
        data = cachedRows;
        fetchOk = true;
      }
    }

    if (!fetchOk || !Array.isArray(data) || data.length === 0) {
      // Fallback: beberapa data lama hanya tersimpan agregat di tabel models.
      await loadModelSummaryMetrics(modelIds);
      return;
    }

    const grouped = {};
    data.forEach((row) => {
      const ratio = row.split_ratio || "-";
      if (!grouped[ratio]) grouped[ratio] = [];
      grouped[ratio].push(row);
    });

    // Hindari campur run berbeda pada rasio yang sama:
    // untuk tiap rasio, pakai hanya model_id terbaru (terbesar).
    Object.keys(grouped).forEach((ratio) => {
      const rows = grouped[ratio] || [];
      const latestModelId = rows.reduce(
        (maxId, r) => Math.max(maxId, Number(r.model_id || 0)),
        0,
      );
      grouped[ratio] = rows
        .filter((r) => Number(r.model_id || 0) === latestModelId)
        .sort((a, b) => Number(a.epoch || 0) - Number(b.epoch || 0));
    });

    ratioComparisonData = {};
    let bestRatio = null;
    let bestF1 = -Infinity;
    let bestRowForParams = null;

    Object.entries(grouped).forEach(([ratio, rows]) => {
      const count = rows.length || 1;
      const avg = rows.reduce(
        (acc, r) => {
          acc.accuracy += Number(r.accuracy || 0);
          acc.precision += Number(r.precision || 0);
          acc.recall += Number(r.recall || 0);
          acc.f1 += Number(r.f1_score || 0);
          acc.loss += Number(r.loss || 0);
          acc.mcc += Number(r.mcc || 0);
          return acc;
        },
        { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0, mcc: 0 },
      );

      ratioComparisonData[ratio] = {
        accuracy: avg.accuracy / count,
        precision: avg.precision / count,
        recall: avg.recall / count,
        f1: avg.f1 / count,
        loss: avg.loss / count,
        mcc: avg.mcc / count,
      };

      if (ratioComparisonData[ratio].f1 > bestF1) {
        bestF1 = ratioComparisonData[ratio].f1;
        bestRatio = ratio;
        bestRowForParams = rows[rows.length - 1];
      }
    });

    // Render ulang tabel hasil epoch per rasio (bukan hanya comparison table).
    const cardsContainer = document.getElementById("training-cards-container");
    if (cardsContainer) {
      cardsContainer.innerHTML = "";
      cardsContainer.style.display = "flex";

      const sortedRatios = Object.entries(ratioComparisonData).sort(
        (a, b) => b[1].f1 - a[1].f1,
      );

      sortedRatios.forEach(([ratioKey]) => {
        const rows = grouped[ratioKey] || [];
        if (!rows.length) return;

        const seed = rows[rows.length - 1];
        const cardParams = {
          splitRatio: ratioKey,
          lr: seed.learning_rate ?? "",
          epoch: Number(seed.epoch ?? rows.length ?? 0),
          batchSize: seed.batch_size ?? "",
          maxLength: seed.max_length ?? "",
          optimizer: seed.optimizer ?? "",
          weightDecay: seed.weight_decay ?? "",
          scheduler: seed.scheduler ?? "",
          warmup: seed.warmup ?? "",
          dropout: seed.dropout ?? "",
          earlyStopping: seed.early_stopping ?? "",
          gradAccum: seed.gradient_accumulation ?? "",
          algo: currentAlgo,
          mode: "cari-rasio",
        };

        const card = createTrainingCard("cari-rasio", cardParams);
        const tableBody = card.querySelector(".results-table tbody");
        rows.forEach((r) => {
          renderEpochResultRow(tableBody, {
            epoch: Number(r.epoch || 0),
            accuracy: Number(r.accuracy || 0),
            precision: Number(r.precision || 0),
            recall: Number(r.recall || 0),
            f1: Number(r.f1_score || 0),
            loss: Number(r.loss || 0),
            mcc: Number(r.mcc || 0),
          });
        });

        const avgData = calculateAndDisplayAverage(
          card,
          rows.map((r) => ({
            epoch: Number(r.epoch || 0),
            accuracy: Number(r.accuracy || 0),
            precision: Number(r.precision || 0),
            recall: Number(r.recall || 0),
            f1: Number(r.f1_score || 0),
            loss: Number(r.loss || 0),
            mcc: Number(r.mcc || 0),
          })),
        );
        if (avgData) {
          ratioComparisonData[ratioKey] = avgData;
        }

        updateTrainingProgress(card, {
          percent: 100,
          statusText: "Riwayat model dimuat",
          stageIndex: TRAINING_STAGE_LABELS.length - 1,
          state: "done",
        });

        const btnSimpan = card.querySelector(".btn-simpan-card");
        if (btnSimpan) btnSimpan.style.display = "none";

        cardsContainer.appendChild(card);
      });
    }

    const section = document.getElementById("ratio-comparison-section");
    const tbody = document.getElementById("comparison-body");
    if (section && tbody) {
      const sortedEntries = Object.entries(ratioComparisonData).sort(
        (a, b) => b[1].f1 - a[1].f1,
      );
      tbody.innerHTML = sortedEntries
        .map(([ratio, m]) => {
          const isBest = ratio === bestRatio;
          return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.2); font-weight: 600;" : ""}">
          <td style="padding: 12px 15px; text-align: center;"><strong>${ratio}</strong>${isBest ? " 🏆" : ""}</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.accuracy || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.precision || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.recall || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.f1 || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.loss || 0).toFixed(4)}</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.mcc || 0).toFixed(4)}</td>
        </tr>
      `;
        })
        .join("");
      section.style.display = currentMode === "cari-rasio" ? "block" : "none";
    }

    if (bestRowForParams && bestRatio) {
      globalBestParams = {
        ...globalBestParams,
        splitRatio: bestRatio,
        lr: bestRowForParams.learning_rate ?? "",
        batchSize: bestRowForParams.batch_size ?? "",
        maxLength: bestRowForParams.max_length ?? "",
        optimizer: bestRowForParams.optimizer ?? "",
        weightDecay: bestRowForParams.weight_decay ?? "",
        scheduler: bestRowForParams.scheduler ?? "",
        warmup: bestRowForParams.warmup ?? "",
        dropout: bestRowForParams.dropout ?? "",
        earlyStopping: bestRowForParams.early_stopping ?? "",
        gradAccum: bestRowForParams.gradient_accumulation ?? "",
        avgF1: bestF1,
      };
      // Sinkronkan field parameter (termasuk warmup) dari rasio terbaik yang tersimpan.
      fillParametersFromModel({
        ratio: bestRatio,
        lr: bestRowForParams.learning_rate ?? "",
        epoch: bestRowForParams.epoch ?? "",
        batch: bestRowForParams.batch_size ?? "",
        maxlen: bestRowForParams.max_length ?? "",
        optimizer: bestRowForParams.optimizer ?? "",
        weightDecay: bestRowForParams.weight_decay ?? "",
        scheduler: bestRowForParams.scheduler ?? "",
        warmup: bestRowForParams.warmup ?? "",
        dropout: bestRowForParams.dropout ?? "",
        earlyStopping: bestRowForParams.early_stopping ?? "",
        gradAccum: bestRowForParams.gradient_accumulation ?? "",
      });
    }
  }

  async function loadModelSummaryMetrics(modelIds) {
    if (!supabaseClient) return;
    const ids = (Array.isArray(modelIds) ? modelIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;

    const { data, error } = await supabaseClient
      .from("models")
      .select(
        "id,mode,split_ratio,epoch,learning_rate,batch_size,max_length,optimizer,weight_decay,scheduler,dropout,early_stopping,gradient_accumulation,accuracy,precision,recall,f1_score",
      )
      .in("id", ids)
      .order("id", { ascending: false });

    if (error || !Array.isArray(data) || data.length === 0) {
      return;
    }

    // Prioritaskan hasil cari-rasio, fallback ke semua mode jika kosong.
    const ratioRows = data.filter(
      (r) => String(r.mode || "").toLowerCase() === "cari-rasio",
    );
    const source = ratioRows.length > 0 ? ratioRows : data;
    const grouped = {};
    source.forEach((row) => {
      const ratio = row.split_ratio || "-";
      if (!grouped[ratio]) grouped[ratio] = row; // ambil terbaru (source sudah desc by id)
    });

    ratioComparisonData = {};
    let bestRatio = null;
    let bestF1 = -Infinity;
    let bestSeed = null;

    Object.entries(grouped).forEach(([ratio, row]) => {
      const f1 = Number(row.f1_score || 0);
      ratioComparisonData[ratio] = {
        accuracy: Number(row.accuracy || 0),
        precision: Number(row.precision || 0),
        recall: Number(row.recall || 0),
        f1,
        // loss/mcc tidak tersedia di tabel models ringkasan
        loss: 0,
        mcc: 0,
      };
      if (f1 > bestF1) {
        bestF1 = f1;
        bestRatio = ratio;
        bestSeed = row;
      }
    });

    const cardsContainer = document.getElementById("training-cards-container");
    if (cardsContainer) {
      cardsContainer.innerHTML = "";
      cardsContainer.style.display = "flex";

      Object.entries(grouped)
        .sort(
          (a, b) =>
            Number((grouped[b[0]] || {}).f1_score || 0) -
            Number((grouped[a[0]] || {}).f1_score || 0),
        )
        .forEach(([ratio, row]) => {
          const cardParams = {
            splitRatio: ratio,
            lr: row.learning_rate ?? "",
            epoch: Number(row.epoch ?? 1),
            batchSize: row.batch_size ?? "",
            maxLength: row.max_length ?? "",
            optimizer: row.optimizer ?? "",
            weightDecay: row.weight_decay ?? "",
            scheduler: row.scheduler ?? "",
            dropout: row.dropout ?? "",
            earlyStopping: row.early_stopping ?? "",
            gradAccum: row.gradient_accumulation ?? "",
            algo: currentAlgo,
            mode: "cari-rasio",
          };

          const card = createTrainingCard("cari-rasio", cardParams);
          const tableBody = card.querySelector(".results-table tbody");
          renderEpochResultRow(tableBody, {
            epoch: Number(row.epoch || 1),
            accuracy: Number(row.accuracy || 0),
            precision: Number(row.precision || 0),
            recall: Number(row.recall || 0),
            f1: Number(row.f1_score || 0),
            loss: 0,
            mcc: 0,
          });
          calculateAndDisplayAverage(card, [
            {
              epoch: Number(row.epoch || 1),
              accuracy: Number(row.accuracy || 0),
              precision: Number(row.precision || 0),
              recall: Number(row.recall || 0),
              f1: Number(row.f1_score || 0),
              loss: 0,
              mcc: 0,
            },
          ]);
          updateTrainingProgress(card, {
            percent: 100,
            statusText: "Riwayat model dimuat (ringkasan)",
            stageIndex: TRAINING_STAGE_LABELS.length - 1,
            state: "done",
          });
          const btnSimpan = card.querySelector(".btn-simpan-card");
          if (btnSimpan) btnSimpan.style.display = "none";
          cardsContainer.appendChild(card);
        });
    }

    const section = document.getElementById("ratio-comparison-section");
    const tbody = document.getElementById("comparison-body");
    if (section && tbody) {
      const sortedEntries = Object.entries(ratioComparisonData).sort(
        (a, b) => b[1].f1 - a[1].f1,
      );
      tbody.innerHTML = sortedEntries
        .map(([ratio, m]) => {
          const isBest = ratio === bestRatio;
          return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.2); font-weight: 600;" : ""}">
          <td style="padding: 12px 15px; text-align: center;"><strong>${ratio}</strong>${isBest ? " 🏆" : ""}</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.accuracy || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.precision || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.recall || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${Number(m.f1 || 0).toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">-</td>
          <td style="padding: 12px 15px; text-align: center;">-</td>
        </tr>
      `;
        })
        .join("");
      section.style.display = currentMode === "cari-rasio" ? "block" : "none";
    }

    if (bestSeed && bestRatio) {
      fillParametersFromModel({
        ratio: bestRatio,
        lr: bestSeed.learning_rate ?? "",
        epoch: bestSeed.epoch ?? "",
        batch: bestSeed.batch_size ?? "",
        maxlen: bestSeed.max_length ?? "",
        optimizer: bestSeed.optimizer ?? "",
        weightDecay: bestSeed.weight_decay ?? "",
        scheduler: bestSeed.scheduler ?? "",
        dropout: bestSeed.dropout ?? "",
        earlyStopping: bestSeed.early_stopping ?? "",
        gradAccum: bestSeed.gradient_accumulation ?? "",
      });
    }
  }

  window.closeManualBook = function () {
    document.getElementById("modal-manual").style.display = "none";
  };

=======
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
    // 🔧 SEMBUNYIKAN tombol "Gunakan Rasio Terbaik" untuk mode training-final
=======
    // 🔧 SEMBUNYIKAN tombol "Use Best Model" untuk mode training-final
>>>>>>> 5389e9f (Initial commit)
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    if (btnGunakanTerbaik && mode === "training-final") {
      btnGunakanTerbaik.style.display = "none";
    }

    // Simpan parameter ke dataset card
    card.dataset.params = JSON.stringify(params);
<<<<<<< HEAD
    ensureProgressDetails(card);
    updateTrainingProgress(card, {
      percent: 0,
      statusText: "Menunggu dijalankan",
      stageIndex: -1,
      state: "idle",
    });
=======
>>>>>>> 5389e9f (Initial commit)

    return card;
  }

<<<<<<< HEAD
  function ensureProgressDetails(card) {
    if (card.querySelector(".progress-meta")) return;

    const progressWrap = card.querySelector(".progress-wrap");
    if (!progressWrap) return;

    const meta = document.createElement("div");
    meta.className = "progress-meta";

    const status = document.createElement("p");
    status.className = "progress-status-text";
    status.innerText = "Status: Menunggu dijalankan";

    const stageList = document.createElement("ul");
    stageList.className = "progress-stage-list";
    stageList.innerHTML = TRAINING_STAGE_LABELS.map(
      (label, idx) =>
        `<li class="progress-stage-item" data-stage="${idx}">
          <span class="stage-dot">${idx + 1}</span>
          <span class="stage-label">${label}</span>
        </li>`,
    ).join("");

    meta.appendChild(status);
    meta.appendChild(stageList);
    progressWrap.insertAdjacentElement("afterend", meta);
  }

  function updateTrainingProgress(
    card,
    { percent = 0, statusText = "", stageIndex = -1, state = "running" } = {},
  ) {
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const progressWrap = card.querySelector(".progress-wrap");
    const statusEl = card.querySelector(".progress-status-text");
    const stageItems = card.querySelectorAll(".progress-stage-item");

    if (!progressBar || !progressLabel || !progressWrap) return;

    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    progressBar.style.width = `${safePercent}%`;
    progressLabel.innerText = `${Math.round(safePercent)}%`;

    progressWrap.classList.remove("done", "error");
    if (state === "done") progressWrap.classList.add("done");
    if (state === "error") progressWrap.classList.add("error");

    if (statusEl) {
      const fallback =
        state === "done"
          ? "Selesai"
          : state === "error"
            ? "Gagal"
            : "Berjalan";
      statusEl.innerText = `Status: ${statusText || fallback}`;
    }

    stageItems.forEach((item, idx) => {
      item.classList.remove("active", "done", "error");

      if (state === "done") {
        item.classList.add("done");
        return;
      }

      if (idx < stageIndex) {
        item.classList.add("done");
      } else if (idx === stageIndex) {
        item.classList.add(state === "error" ? "error" : "active");
      }
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getCurrentModelName() {
    let modelName = "";
    const newModelNameCard = document.getElementById("new-model-name-card");

    if (newModelNameCard && newModelNameCard.style.display === "flex") {
      const nameElement = newModelNameCard.querySelector(".file-card-name");
      if (nameElement) {
        modelName = nameElement.innerText.trim();
      } else {
        const inputElement = document.getElementById("new-model-name");
        modelName = inputElement?.value?.trim() || "";
      }
    }

    if (!modelName) {
      modelName =
        document.getElementById("model-card-name")?.innerText?.trim() || "";
    }

    return modelName && modelName !== "—" ? modelName : "Untitled Model";
  }

  function startTraining(mode) {
=======
  function startTraining(mode) {
    const modelSelectValue = document.getElementById("model-select")?.value || "";
    const isOldModelFlow = mode === "training-final" && modelSelectValue === "lama";
    const isNewModelFlow = mode === "training-final" && modelSelectValue === "baru";

    if (isNewModelFlow && !globalBestParams) {
      showToast("⚠️ Untuk Create New Model, jalankan Find the Best Ratio terlebih dahulu");
      return;
    }

>>>>>>> 5389e9f (Initial commit)
    const splitSelect = document.getElementById("split-ratio-select");
    const splitRatio = splitSelect?.value;

    if (!splitRatio) {
<<<<<<< HEAD
      showToast("⚠️ Pilih rasio data split terlebih dahulu");
=======
      showToast("⚠️ Select split data ratio first");
>>>>>>> 5389e9f (Initial commit)
      return;
    }

    if (!currentAlgo) {
<<<<<<< HEAD
      showToast("⚠️ Pilih algoritma terlebih dahulu");
=======
      showToast("⚠️ Select algorithm first");
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD

    if (!datasetSelected && !modelSelected) {
      showToast("⚠️ Pilih dataset atau model terlebih dahulu");
      return;
    }

    if (!selectedDataset?.id) {
      showToast(
        "⚠️ Dataset untuk model lama belum terdeteksi. Pilih dataset terlebih dahulu.",
      );
      return;
    }

    if (
      document.getElementById("new-model-name-card").style.display === "flex" &&
      !modelNameSaved
    ) {
      showToast("⚠️ Simpan nama model terlebih dahulu");
=======
    const modelNameCardShown =
      document.getElementById("new-model-name-card").style.display === "flex";

    if (mode !== "training-final" && !datasetSelected) {
      showToast("⚠️ Select dataset first");
>>>>>>> 5389e9f (Initial commit)
      return;
    }

    // 🔧 Untuk mode training-final, validasi nama training
    if (mode === "training-final") {
      const trainingName = document
        .getElementById("training-name")
        ?.value.trim();
      if (!trainingName) {
<<<<<<< HEAD
        showToast("⚠️ Masukkan nama training terlebih dahulu");
=======
        showToast("⚠️ Sign Inkan nama training terlebih dahulu");
        return;
      }

      if (!modelSelected && !modelNameCardShown) {
        showToast("⚠️ Select an old model or create a new model first");
        return;
      }

      if (isOldModelFlow) {
        const oldModelName =
          document.getElementById("model-card-name")?.innerText?.trim() || "";
        if (!oldModelName || oldModelName === "—") {
          showToast("⚠️ Pilih model lama dari daftar terlebih dahulu");
          return;
        }
      }

      if (modelNameCardShown && !modelNameSaved) {
        showToast("⚠️ Simpan nama model terlebih dahulu");
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
    const trainingName = document.getElementById("training-name")?.value?.trim();
    const trainingDesc = document.getElementById("training-desc")?.value?.trim();
    const modelName = getCurrentModelName();

=======
>>>>>>> 5389e9f (Initial commit)
    // 🔧 Buat training card untuk SEMUA mode
    const card = createTrainingCard(mode, params);
    const container = document.getElementById("training-cards-container");

    // 🔧 PENTING: Tampilkan container saat mode training-final
    if (mode === "training-final") {
      container.style.display = "flex";
    }

    container.appendChild(card);

    card.scrollIntoView({ behavior: "smooth", block: "nearest" });

<<<<<<< HEAD
    runTrainingInCard(card, mode, params, {
      trainingName,
      trainingDesc,
      modelName,
    });
  }

  function renderEpochResultRow(tableBody, result) {
    const emptyRow = tableBody.querySelector(".empty-row");
    if (emptyRow) emptyRow.remove();

    const row = document.createElement("tr");
    row.innerHTML = `
    <td>${result.epoch}</td>
    <td>${Number(result.accuracy).toFixed(2)}%</td>
    <td>${Number(result.precision).toFixed(2)}%</td>
    <td>${Number(result.recall).toFixed(2)}%</td>
    <td>${Number(result.f1).toFixed(2)}%</td>
    <td>${Number(result.loss).toFixed(4)}</td>
    <td>${Number(result.mcc).toFixed(4)}</td>
  `;
    tableBody.appendChild(row);
  }

  function loadEpochResultsCache() {
    try {
      const raw = localStorage.getItem(EPOCH_RESULTS_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveEpochResultsToCache(modelId, params, epochResults) {
    const id = Number(modelId || 0);
    if (!Number.isFinite(id) || id <= 0 || !Array.isArray(epochResults)) return;

    const cleanResults = epochResults
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        epoch: Number(r.epoch || 0),
        accuracy: Number(r.accuracy || 0),
        precision: Number(r.precision || 0),
        recall: Number(r.recall || 0),
        f1: Number(r.f1 || 0),
        loss: Number(r.loss || 0),
        mcc: Number(r.mcc || 0),
      }))
      .filter((r) => r.epoch > 0);
    if (cleanResults.length === 0) return;

    const cache = loadEpochResultsCache();
    cache[String(id)] = {
      model_id: id,
      split_ratio: params?.splitRatio || "-",
      learning_rate: params?.lr || "",
      batch_size: params?.batchSize || "",
      max_length: params?.maxLength || "",
      optimizer: params?.optimizer || "",
      weight_decay: params?.weightDecay || "",
      scheduler: params?.scheduler || "",
      warmup: params?.warmup || "",
      dropout: params?.dropout || "",
      early_stopping: params?.earlyStopping || "",
      gradient_accumulation: params?.gradAccum || "",
      results: cleanResults,
      saved_at: Date.now(),
    };
    localStorage.setItem(EPOCH_RESULTS_CACHE_KEY, JSON.stringify(cache));
  }

  function getEpochRowsFromCache(modelIds) {
    const ids = (Array.isArray(modelIds) ? modelIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return [];

    const cache = loadEpochResultsCache();
    const rows = [];
    ids.forEach((id) => {
      const entry = cache[String(id)];
      if (!entry || !Array.isArray(entry.results)) return;
      entry.results.forEach((r) => {
        rows.push({
          model_id: id,
          split_ratio: entry.split_ratio || "-",
          learning_rate: entry.learning_rate || "",
          batch_size: entry.batch_size || "",
          max_length: entry.max_length || "",
          optimizer: entry.optimizer || "",
          weight_decay: entry.weight_decay || "",
          scheduler: entry.scheduler || "",
          warmup: entry.warmup || "",
          dropout: entry.dropout || "",
          early_stopping: entry.early_stopping || "",
          gradient_accumulation: entry.gradient_accumulation || "",
          epoch: Number(r.epoch || 0),
          accuracy: Number(r.accuracy || 0),
          precision: Number(r.precision || 0),
          recall: Number(r.recall || 0),
          f1_score: Number(r.f1 || 0),
          loss: Number(r.loss || 0),
          mcc: Number(r.mcc || 0),
        });
      });
    });

    return rows.sort((a, b) => {
      const modelDiff = Number(a.model_id || 0) - Number(b.model_id || 0);
      if (modelDiff !== 0) return modelDiff;
      return Number(a.epoch || 0) - Number(b.epoch || 0);
    });
  }

  async function runTrainingInCard(card, mode, params, meta = {}) {
    const tableBody = card.querySelector(".results-table tbody");
    let currentStage = 0;

    tableBody.innerHTML = "";
    updateTrainingProgress(card, {
      percent: 8,
      statusText: "Validasi parameter training",
      stageIndex: currentStage,
      state: "running",
    });

    try {
      const requestBody = {
        trainingName: meta.trainingName || null,
        trainingDesc: meta.trainingDesc || null,
        modelName: meta.modelName || null,
        datasetId: selectedDataset?.id || null,
        saveToDb: true,
        params,
      };

      let payload = null;

      if (params.algo === "indobert" || params.algo === "mbert") {
        const isMBERT = params.algo === "mbert";
        const endpointPrefix = isMBERT
          ? "http://127.0.0.1:8000/processing/train-mbert"
          : "http://127.0.0.1:8000/processing/train-indobert";
        const algoLabel = isMBERT ? "mBERT" : "IndoBERT";

        currentStage = 1;
        updateTrainingProgress(card, {
          percent: 22,
          statusText: `Membuat job training ${algoLabel}`,
          stageIndex: currentStage,
          state: "running",
        });

        const startResponse = await fetch(`${endpointPrefix}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!startResponse.ok) {
          let errorMsg = `Gagal memulai job ${algoLabel}`;
          try {
            const errorJson = await startResponse.json();
            errorMsg = errorJson.detail || errorMsg;
          } catch (_) {}
          throw new Error(errorMsg);
        }

        const startPayload = await startResponse.json();
        const jobId = startPayload.jobId;
        if (!jobId) throw new Error(`Job ${algoLabel} tidak valid`);

        currentStage = 2;
        // Dataset besar + fine-tuning mBERT bisa jauh lebih lama dari 24 menit.
        // Gunakan timeout berbasis durasi yang lebih longgar.
        const startedAt = Date.now();
        const maxWaitMs = 6 * 60 * 60 * 1000; // 6 jam
        while (Date.now() - startedAt < maxWaitMs) {
          await sleep(2000);
          const statusResponse = await fetch(`${endpointPrefix}/status/${jobId}`);
          if (!statusResponse.ok) {
            throw new Error(`Gagal membaca status training ${algoLabel}`);
          }

          const statusPayload = await statusResponse.json();
          const currentEpoch = Number(statusPayload.currentEpoch || 0);
          const totalEpoch = Number(
            statusPayload.totalEpoch || params.epoch || 1,
          );
          const epochProgress =
            totalEpoch > 0
              ? Math.min(1, Math.max(0, currentEpoch / totalEpoch))
              : 0;
          const percent = 28 + epochProgress * 52;

          updateTrainingProgress(card, {
            percent,
            statusText:
              statusPayload.message ||
              `Training ${algoLabel} epoch ${currentEpoch}/${totalEpoch}`,
            stageIndex: currentStage,
            state: statusPayload.state === "error" ? "error" : "running",
          });

          if (statusPayload.state === "done") {
            payload = statusPayload.result;
            break;
          }

          if (statusPayload.state === "error") {
            throw new Error(
              statusPayload.message || `Training ${algoLabel} gagal`,
            );
          }
        }

        if (!payload) {
          throw new Error(
            `Training ${algoLabel} timeout (lebih dari 6 jam). Coba ulangi lagi atau kecilkan beban training.`,
          );
        }
      } else {
        const trainingEndpoint = "http://127.0.0.1:8000/processing/train";

        currentStage = 1;
        updateTrainingProgress(card, {
          percent: 22,
          statusText: "Mengirim request ke backend",
          stageIndex: currentStage,
          state: "running",
        });

        const response = await fetch(trainingEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          let errorMsg = "Training gagal diproses server";
          try {
            const errorJson = await response.json();
            errorMsg = errorJson.detail || errorMsg;
          } catch (_) {}
          throw new Error(errorMsg);
        }

        currentStage = 2;
        updateTrainingProgress(card, {
          percent: 62,
          statusText: "Training model sedang berjalan di server",
          stageIndex: currentStage,
          state: "running",
        });
        payload = await response.json();
      }

      const epochResults = Array.isArray(payload.results) ? payload.results : [];
      saveEpochResultsToCache(payload?.modelId, params, epochResults);

      currentStage = 3;
      updateTrainingProgress(card, {
        percent: 82,
        statusText: "Menampilkan hasil epoch",
        stageIndex: currentStage,
        state: "running",
      });
      epochResults.forEach((result) => renderEpochResultRow(tableBody, result));

      currentStage = 4;
      updateTrainingProgress(card, {
        percent: 94,
        statusText: "Finalisasi hasil training",
        stageIndex: currentStage,
        state: "running",
      });

      finishTrainingInCard(card, mode, params, epochResults);
    } catch (error) {
      updateTrainingProgress(card, {
        percent: 100,
        statusText: `Gagal: ${error.message}`,
        stageIndex: currentStage,
        state: "error",
      });
      showToast(`❌ ${error.message}`, "error");
    }
=======
    simulateTrainingInCard(card, mode, params);
  }

  function resetProgressLog(card, initialMessage = "Waiting for process...") {
    const logList = card.querySelector(".progress-log-list");
    if (!logList) return;
    logList.innerHTML = "";
    appendProgressLog(card, initialMessage, "info");
  }

  function appendProgressLog(card, message, level = "info") {
    const logList = card.querySelector(".progress-log-list");
    if (!logList) return;
    const item = document.createElement("li");
    item.className = `progress-log-item log-${level}`;
    const now = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    item.innerText = `[${now}] ${message}`;
    logList.appendChild(item);
    logList.scrollTop = logList.scrollHeight;
    while (logList.children.length > 14) {
      logList.removeChild(logList.firstChild);
    }
  }

  function setLoadingVisual(card, isVisible, text = "Training is in progress...") {
    const loadingWrap = card.querySelector(".loading-visual");
    const loadingText = card.querySelector(".loading-text");
    if (!loadingWrap) return;
    loadingWrap.style.display = isVisible ? "flex" : "none";
    if (loadingText) loadingText.innerText = text;
  }

  function createProgressAnimator(progressBar, progressLabel) {
    let displayed = 0;
    let target = 0;
    let timer = null;
    let running = false;

    function render() {
      const safe = Math.max(0, Math.min(100, displayed));
      progressBar.style.width = safe.toFixed(1) + "%";
      progressLabel.innerText = `${Math.round(safe)}%`;
    }

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (!running) return;
        if (displayed < target) {
          displayed = Math.min(target, displayed + 0.6);
        } else if (displayed < 98) {
          // tetap bergerak pelan walau belum ada epoch baru.
          displayed = Math.min(98, displayed + 0.08);
        }
        render();
      }, 100);
    }

    function stop() {
      running = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    return {
      begin(initial = 0) {
        displayed = initial;
        target = initial;
        running = true;
        render();
        start();
      },
      setTarget(nextTarget) {
        target = Math.max(target, Math.min(99, nextTarget));
      },
      finish() {
        target = 100;
        displayed = 100;
        render();
        stop();
      },
      fail() {
        stop();
      },
    };
  }

  function simulateTrainingInCard(card, mode, params) {
    // ✅ Real training via backend
    const algo = params.algo || currentAlgo;
    if (algo === "indobert") {
      runBackendIndoBertTraining(card, mode, params);
      return;
    }
    if (algo === "mbert") {
      runBackendMBertTraining(card, mode, params);
      return;
    }

    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const progressWrap = card.querySelector(".progress-wrap");
    const tableBody = card.querySelector(".results-table tbody");

    let progress = 0;
    const totalEpochs = params.epoch;
    let currentEpoch = 0;
    const epochResults = []; // TAMBAHKAN: Array untuk menyimpan hasil

    tableBody.innerHTML = "";
    resetProgressLog(card, "Training dimulai");
    appendProgressLog(card, `Mode: simulasi ${params.algo || currentAlgo}`, "warning");
    setLoadingVisual(card, true, "Simulasi training berjalan...");

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 3;

      const epochProgress = Math.floor((progress / 100) * totalEpochs);

      if (epochProgress > currentEpoch && epochProgress <= totalEpochs) {
        currentEpoch = epochProgress;
        const result = addEpochResult(tableBody, currentEpoch, params);
        epochResults.push(result); // TAMBAHKAN: Simpan hasil
        appendProgressLog(
          card,
          `Epoch ${currentEpoch}/${totalEpochs} selesai (F1 ${result.f1.toFixed(2)}%)`,
          "info",
        );
      }

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setLoadingVisual(card, false);
        appendProgressLog(card, "All epochs completed, summarizing results...", "success");
        finishTrainingInCard(card, mode, params, epochResults); // KIRIM epochResults
      }

      progressBar.style.width = progress + "%";
      progressLabel.innerText = progress + "%";
    }, 400);
  }

  async function runBackendIndoBertTraining(card, mode, params) {
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const progressWrap = card.querySelector(".progress-wrap");
    const tableBody = card.querySelector(".results-table tbody");

    if (!selectedDatasetId) {
      showToast("⚠️ Select preprocessed dataset first", "error");
      return;
    }

    // Tentukan model name (untuk backend save)
    let modelName = "";
    const selectedModelType = document.getElementById("model-select")?.value || "";
    if (mode === "training-final" && selectedModelType === "lama") {
      modelName = document.getElementById("model-card-name")?.innerText?.trim() || "";
      if (!modelName || modelName === "—") {
        showToast("⚠️ Pilih model lama terlebih dahulu", "error");
        return;
      }
    } else {
      const newModelNameCard = document.getElementById("new-model-name-card");
      if (newModelNameCard && newModelNameCard.style.display === "flex") {
        const nameElement = newModelNameCard.querySelector(".file-card-name");
        if (nameElement) modelName = nameElement.innerText.trim();
        if (!modelName) {
          const inputElement = document.getElementById("new-model-name");
          modelName = inputElement?.value?.trim() || "";
        }
      }
      if (!modelName) {
        modelName = document.getElementById("model-card-name")?.innerText?.trim() || "";
      }
      if (!modelName || modelName === "—") {
        modelName =
          document.getElementById("training-name")?.value?.trim() || `IndoBERT_${Date.now()}`;
      }
    }

    // Reset UI
    tableBody.innerHTML = "";
    progressWrap.classList.remove("done");
    const setProgressPct = (value) => {
      const safe = Math.max(0, Math.min(100, Number(value) || 0));
      progressBar.style.width = `${safe.toFixed(1)}%`;
      progressLabel.innerText = `${Math.round(safe)}%`;
    };
    setProgressPct(0);
    resetProgressLog(card, "Menyiapkan training job IndoBERT...");
    setLoadingVisual(card, true, "Mengirim job ke backend...");

    try {
      const payload = {
        dataset_id: selectedDatasetId,
        model_name: modelName,
        mode: mode,
        split_ratio: params.splitRatio || "80:20",
        lr: parseFloat(params.lr || "0.00002"),
        epoch: parseInt(params.epoch || 3, 10),
        batch_size: parseInt(params.batchSize || 16, 10),
        max_length: parseInt(params.maxLength || 64, 10),
        weight_decay: parseFloat(params.weightDecay || "0.01"),
        warmup_ratio: parseFloat(params.warmup || "0.1"),
        dropout: parseFloat(params.dropout || "0.1"),
        grad_accum: parseInt(params.gradAccum || 1, 10),
        early_stopping_patience: parseInt(params.earlyStopping || 0, 10),
      };

      // Start async job
      const res = await fetch(`${API_BASE}/processing/train/indobert/async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const startResult = await res.json();
      if (!res.ok) {
        throw new Error(startResult?.detail || "Training failed");
      }

      const jobId = startResult.job_id;
      const totalEpochs = payload.epoch || startResult.total_epochs || 1;
      setLoadingVisual(card, true, `Job ${jobId.slice(0, 6)} is being processed...`);
      appendProgressLog(
        card,
        `Job dibuat: ${jobId.slice(0, 8)} | device akan dipilih otomatis`,
        "info",
      );

      // Poll status
      const epochResults = [];
      let renderedEpochs = 0;
      let lastStatus = "";
      setProgressPct(2);

      const poll = async () => {
        const stRes = await fetch(`${API_BASE}/processing/train/status/${jobId}`);
        const st = await stRes.json();
        if (!stRes.ok) throw new Error(st?.detail || "Failed to fetch status");

        if (st.status !== lastStatus) {
          lastStatus = st.status;
          if (st.status === "queued") appendProgressLog(card, "Job masih dalam antrean...", "warning");
          if (st.status === "running") appendProgressLog(card, "Training is running on backend", "info");
        }

        // Progress sinkron dengan status backend (epoch aktual)
        const cur = Number(st.current_epoch || 0);
        if (st.status === "queued") {
          setProgressPct(2);
        }
        if (st.status === "running") {
          const progressByEpoch = (cur / Math.max(1, totalEpochs)) * 100;
          setProgressPct(progressByEpoch);
        }

        // render new epochs
        const metrics = st.metrics || [];
        for (let i = renderedEpochs; i < metrics.length; i++) {
          const m = metrics[i];
          const row = document.createElement("tr");

          const accuracy = (m.accuracy * 100) || 0;
          const precision = (m.precision_macro * 100) || 0;
          const recall = (m.recall_macro * 100) || 0;
          const f1 = (m.f1_macro * 100) || 0;
          const loss = m.val_loss ?? m.train_loss ?? 0;
          const mcc = Number(m.mcc ?? 0);

          row.innerHTML = `
            <td>${m.epoch}</td>
            <td>${accuracy.toFixed(2)}%</td>
            <td>${precision.toFixed(2)}%</td>
            <td>${recall.toFixed(2)}%</td>
            <td>${f1.toFixed(2)}%</td>
            <td>${parseFloat(loss).toFixed(4)}</td>
            <td>${mcc.toFixed(4)}</td>
          `;
          tableBody.appendChild(row);
          epochResults.push({
            epoch: m.epoch,
            accuracy,
            precision,
            recall,
            f1,
            loss: parseFloat(loss),
            mcc,
            confusion_matrix: m.confusion_matrix || null,
            confusion_labels: m.confusion_labels || null,
          });
          appendProgressLog(
            card,
            `Epoch ${m.epoch}/${totalEpochs} | Acc ${accuracy.toFixed(2)}% | F1 ${f1.toFixed(2)}% | MCC ${mcc.toFixed(4)} | Loss ${parseFloat(loss).toFixed(4)}`,
            "info",
          );
          renderedEpochs++;
        }

        if (st.status === "done") {
          setProgressPct(100);
          progressWrap.classList.add("done");
          setLoadingVisual(card, false);
          if (
            Number(payload.early_stopping_patience || 0) > 0 &&
            epochResults.length < totalEpochs
          ) {
            appendProgressLog(
              card,
              `Early stopping aktif: training berhenti di epoch ${epochResults.length}/${totalEpochs}`,
              "warning",
            );
          }
          appendProgressLog(
            card,
            `Training selesai (${st.result?.device || "device"})`,
            "success",
          );

          finishTrainingInCard(card, mode, params, epochResults);
          showToast(
            `✅ IndoBERT training selesai (${st.result?.device || "device"})`,
            "success",
          );
          return;
        }

        if (st.status === "error") {
          progressLabel.innerText = "Failed";
          setLoadingVisual(card, false);
          appendProgressLog(card, `Training failed: ${st.error || "-"}`, "error");
          showToast(st.error || "Training failed", "error");
          return;
        }

        setTimeout(poll, 1000);
      };

      setTimeout(poll, 700);
    } catch (err) {
      console.error(err);
      progressBar.style.width = "100%";
      progressLabel.innerText = "Failed";
      setLoadingVisual(card, false);
      appendProgressLog(card, `Error: ${err.message || "training gagal"}`, "error");
      showToast(err.message || "Training failed", "error");
    }
  }

  async function runBackendMBertTraining(card, mode, params) {
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
    const progressWrap = card.querySelector(".progress-wrap");
    const tableBody = card.querySelector(".results-table tbody");

    if (!selectedDatasetId) {
      showToast("⚠️ Select preprocessed dataset first", "error");
      return;
    }

    // Tentukan model name (untuk backend save)
    let modelName = "";
    const selectedModelType = document.getElementById("model-select")?.value || "";
    if (mode === "training-final" && selectedModelType === "lama") {
      modelName = document.getElementById("model-card-name")?.innerText?.trim() || "";
      if (!modelName || modelName === "—") {
        showToast("⚠️ Pilih model lama terlebih dahulu", "error");
        return;
      }
    } else {
      const newModelNameCard = document.getElementById("new-model-name-card");
      if (newModelNameCard && newModelNameCard.style.display === "flex") {
        const nameElement = newModelNameCard.querySelector(".file-card-name");
        if (nameElement) modelName = nameElement.innerText.trim();
        if (!modelName) {
          const inputElement = document.getElementById("new-model-name");
          modelName = inputElement?.value?.trim() || "";
        }
      }
      if (!modelName) {
        modelName = document.getElementById("model-card-name")?.innerText?.trim() || "";
      }
      if (!modelName || modelName === "—") {
        modelName =
          document.getElementById("training-name")?.value?.trim() || `mBERT_${Date.now()}`;
      }
    }

    // Reset UI
    tableBody.innerHTML = "";
    progressWrap.classList.remove("done");
    const setProgressPct = (value) => {
      const safe = Math.max(0, Math.min(100, Number(value) || 0));
      progressBar.style.width = `${safe.toFixed(1)}%`;
      progressLabel.innerText = `${Math.round(safe)}%`;
    };
    setProgressPct(0);
    resetProgressLog(card, "Menyiapkan training job mBERT...");
    setLoadingVisual(card, true, "Mengirim job ke backend...");

    try {
      const payload = {
        dataset_id: selectedDatasetId,
        model_name: modelName,
        mode: mode,
        split_ratio: params.splitRatio || "80:20",
        lr: parseFloat(params.lr || "0.00002"),
        epoch: parseInt(params.epoch || 3, 10),
        batch_size: parseInt(params.batchSize || 16, 10),
        max_length: parseInt(params.maxLength || 64, 10),
        weight_decay: parseFloat(params.weightDecay || "0.01"),
        warmup_ratio: parseFloat(params.warmup || "0.1"),
        dropout: parseFloat(params.dropout || "0.1"),
        grad_accum: parseInt(params.gradAccum || 1, 10),
        early_stopping_patience: parseInt(params.earlyStopping || 0, 10),
      };

      // Start async job
      const res = await fetch(`${API_BASE}/processing/train/mbert/async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const startResult = await res.json();
      if (!res.ok) {
        throw new Error(startResult?.detail || "Training failed");
      }

      const jobId = startResult.job_id;
      const totalEpochs = payload.epoch || startResult.total_epochs || 1;
      setLoadingVisual(card, true, `Job ${jobId.slice(0, 6)} is being processed...`);
      appendProgressLog(
        card,
        `Job dibuat: ${jobId.slice(0, 8)} | device akan dipilih otomatis`,
        "info",
      );

      // Poll status
      const epochResults = [];
      let renderedEpochs = 0;
      let lastStatus = "";
      setProgressPct(2);

      const poll = async () => {
        const stRes = await fetch(`${API_BASE}/processing/train/status/${jobId}`);
        const st = await stRes.json();
        if (!stRes.ok) throw new Error(st?.detail || "Failed to fetch status");

        if (st.status !== lastStatus) {
          lastStatus = st.status;
          if (st.status === "queued")
            appendProgressLog(card, "Job masih dalam antrean...", "warning");
          if (st.status === "running")
            appendProgressLog(card, "Training is running on backend", "info");
        }

        // Progress sinkron dengan status backend (epoch aktual)
        const cur = Number(st.current_epoch || 0);
        if (st.status === "queued") {
          setProgressPct(2);
        }
        if (st.status === "running") {
          const progressByEpoch = (cur / Math.max(1, totalEpochs)) * 100;
          setProgressPct(progressByEpoch);
        }

        // render new epochs
        const metrics = st.metrics || [];
        for (let i = renderedEpochs; i < metrics.length; i++) {
          const m = metrics[i];
          const row = document.createElement("tr");

          const accuracy = (m.accuracy * 100) || 0;
          const precision = (m.precision_macro * 100) || 0;
          const recall = (m.recall_macro * 100) || 0;
          const f1 = (m.f1_macro * 100) || 0;
          const loss = m.val_loss ?? m.train_loss ?? 0;
          const mcc = Number(m.mcc ?? 0);

          row.innerHTML = `
            <td>${m.epoch}</td>
            <td>${accuracy.toFixed(2)}%</td>
            <td>${precision.toFixed(2)}%</td>
            <td>${recall.toFixed(2)}%</td>
            <td>${f1.toFixed(2)}%</td>
            <td>${parseFloat(loss).toFixed(4)}</td>
            <td>${mcc.toFixed(4)}</td>
          `;
          tableBody.appendChild(row);
          epochResults.push({
            epoch: m.epoch,
            accuracy,
            precision,
            recall,
            f1,
            loss: parseFloat(loss),
            mcc,
            confusion_matrix: m.confusion_matrix || null,
            confusion_labels: m.confusion_labels || null,
          });
          appendProgressLog(
            card,
            `Epoch ${m.epoch}/${totalEpochs} | Acc ${accuracy.toFixed(2)}% | F1 ${f1.toFixed(
              2,
            )}% | MCC ${mcc.toFixed(4)} | Loss ${parseFloat(loss).toFixed(4)}`,
            "info",
          );
          renderedEpochs++;
        }

        if (st.status === "done") {
          setProgressPct(100);
          progressWrap.classList.add("done");
          setLoadingVisual(card, false);
          if (
            Number(payload.early_stopping_patience || 0) > 0 &&
            epochResults.length < totalEpochs
          ) {
            appendProgressLog(
              card,
              `Early stopping aktif: training berhenti di epoch ${epochResults.length}/${totalEpochs}`,
              "warning",
            );
          }
          appendProgressLog(card, `Training selesai (${st.result?.device || "device"})`, "success");
          finishTrainingInCard(card, mode, params, epochResults);
          showToast(`✅ mBERT training selesai (${st.result?.device || "device"})`, "success");
          return;
        }

        if (st.status === "error") {
          progressLabel.innerText = "Failed";
          setLoadingVisual(card, false);
          appendProgressLog(card, `Training failed: ${st.error || "-"}`, "error");
          showToast(st.error || "Training failed", "error");
          return;
        }

        setTimeout(poll, 1000);
      };

      setTimeout(poll, 700);
    } catch (err) {
      console.error(err);
      progressBar.style.width = "100%";
      progressLabel.innerText = "Failed";
      setLoadingVisual(card, false);
      appendProgressLog(card, `Error: ${err.message || "training gagal"}`, "error");
      showToast(err.message || "Training failed", "error");
    }
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
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
=======
    const progressWrap = card.querySelector(".progress-wrap");
    const progressBar = card.querySelector(".progress-bar");
    const progressLabel = card.querySelector(".progress-label");
>>>>>>> 5389e9f (Initial commit)
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    const btnSimpan = card.querySelector(".btn-simpan-card");
    const bestParamsDisplay = card.querySelector(".best-params-display");

<<<<<<< HEAD
    updateTrainingProgress(card, {
      percent: 100,
      statusText: "Selesai",
      stageIndex: TRAINING_STAGE_LABELS.length - 1,
      state: "done",
    });
=======
    progressWrap.classList.add("done");
    progressBar.style.width = "100%";
    progressLabel.innerText = "Completed";
    appendProgressLog(
      card,
      `Ringkasan selesai. Total epoch tercatat: ${epochResults.length}`,
      "success",
    );
>>>>>>> 5389e9f (Initial commit)

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
<<<<<<< HEAD
=======
          confusion_matrix: r.confusion_matrix || null,
          confusion_labels: r.confusion_labels || null,
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
          '<tr class="empty-row"><td colspan="7" style="text-align:center; color:#999; padding: 30px;">📭 Belum ada data perbandingan. Lakukan training untuk melihat hasil.</td></tr>';
=======
          '<tr class="empty-row"><td colspan="7" style="text-align:center; color:#999; padding: 30px;">📭 No comparison data yet. Run training to see results.</td></tr>';
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
=======

      showToast(
        "✅ Find Best Ratio selesai. Klik 'Use Best Model' pada card yang ingin dipakai untuk lanjut ke Final Training.",
        "success",
      );
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
=======
    applyModeSpecificVisibility();

    const modelSelect = document.getElementById("model-select");
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");
    if (modelSelect) modelSelect.value = "";
    if (modelCard) modelCard.style.display = "none";
    if (newModelNameCard) newModelNameCard.style.display = "none";
    modelNameSaved = false;
>>>>>>> 5389e9f (Initial commit)

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
<<<<<<< HEAD
      trainingCardsContainer.innerHTML = ""; // Hapus semua card lama
=======
      trainingCardsContainer.innerHTML = ""; // Delete semua card lama
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
      showToast(`✅ Ratio ${params.splitRatio} applied to Final Training mode`);
=======
      showToast(
        `✅ Best model dari ratio ${params.splitRatio} diterapkan. Sign In ke tahap Final Training.`,
        "success",
      );
>>>>>>> 5389e9f (Initial commit)

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
<<<<<<< HEAD
=======
      dataset_id: selectedDatasetId,
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
            showToast("✅ Model berhasil tersimpan secara lokal!");
            saveToLocalStorage(modelData);
          } else {
            showToast("✅ Model berhasil tersimpan ke database!");
          }
        });
    } else {
      showToast("✅ Model berhasil tersimpan!");
=======
            showToast("✅ Model saved locally!");
            saveToLocalStorage(modelData);
          } else {
            showToast("✅ Model saved to database!");
          }
        });
    } else {
      showToast("✅ Model saved!");
>>>>>>> 5389e9f (Initial commit)
      saveToLocalStorage(modelData);
    }

    console.log("Model saved:", modelData);
  }

  function saveModel() {
<<<<<<< HEAD
    showToast("✅ Gunakan tombol Simpan pada card training");
=======
    showToast("✅ Use Save button on training card");
>>>>>>> 5389e9f (Initial commit)
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

<<<<<<< HEAD
      // 🔧 Cari epoch dengan F1 tertinggi
      let bestF1 = -1;
      let bestEpoch = -1;
      results.forEach((r) => {
        if (r.f1 > bestF1) {
          bestF1 = r.f1;
=======
      // 🔧 Cari epoch dengan Accuracy tertinggi (untuk confusion matrix)
      let bestAcc = -Infinity;
      let bestEpoch = -1;
      results.forEach((r) => {
        const acc = Number(r.accuracy ?? -Infinity);
        if (acc > bestAcc) {
          bestAcc = acc;
>>>>>>> 5389e9f (Initial commit)
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
<<<<<<< HEAD
=======

      // Confusion Matrix (ambil epoch dengan Accuracy tertinggi)
      const confusionSection = document.getElementById("history-confusion-section");
      const confusionMeta = document.getElementById("history-confusion-meta");
      const confusionTable = document.getElementById("history-confusion-table");
      const confusionEmpty = document.getElementById("history-confusion-empty");

      if (confusionSection && confusionTable && confusionMeta && confusionEmpty) {
        const bestResult = results.find((r) => r.epoch === bestEpoch);
        const cm = bestResult?.confusion_matrix;
        const labels = bestResult?.confusion_labels;

        if (
          cm &&
          labels &&
          Array.isArray(cm) &&
          Array.isArray(labels) &&
          cm.length === labels.length
        ) {
          const size = labels.length;
          confusionSection.style.display = "block";
          confusionEmpty.style.display = "none";
          confusionMeta.innerText = `Best epoch: ${bestEpoch} | Accuracy: ${Number(bestAcc).toFixed(2)}%`;

          const header =
            `<tr><th></th>` +
            labels.map((l) => `<th>${l}</th>`).join("") +
            `</tr>`;

          const body = cm
            .slice(0, size)
            .map((row, i) => {
              const cells = labels
                .slice(0, size)
                .map((_, j) => {
                  const v = row?.[j] ?? 0;
                  const cls = i === j ? "diag" : "";
                  return `<td class="${cls}">${v}</td>`;
                })
                .join("");
              return `<tr><th>${labels[i]}</th>${cells}</tr>`;
            })
            .join("");

          confusionTable.innerHTML = header + body;
        } else {
          confusionSection.style.display = "none";
          confusionEmpty.style.display = "block";
          confusionTable.innerHTML = "";
        }
      }
>>>>>>> 5389e9f (Initial commit)
    } else {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:#999;">Result data not available</td></tr>';
      avgFoot.innerHTML = "";
<<<<<<< HEAD
=======

      const confusionSection = document.getElementById(
        "history-confusion-section",
      );
      if (confusionSection) confusionSection.style.display = "none";
>>>>>>> 5389e9f (Initial commit)
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
