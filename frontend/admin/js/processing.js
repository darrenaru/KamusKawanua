(function () {
  "use strict";

  const SUPABASE_URL = "https://cdrabgiuvfisxntfzskd.supabase.co";
  const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcmFiZ2l1dmZpc3hudGZ6c2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTE3MDYsImV4cCI6MjA5NDA4NzcwNn0.7mOQSIwKZqH-SJtAIQFvmM-iFwjlUrmoknc6mZiny6Y";

  let supabaseClient = null;
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  let selectedDataset = null;
  let selectedDatasetId = null;
  let selectedModel = null;
  let currentAlgo = "";
  let currentMode = "cari-rasio";
  let modelNameSaved = false;
  let trainingCounter = 0;

  const API_BASE = "http://127.0.0.1:8000";
  const STORAGE_SELECTED_DATASET_ID = "processing_selected_dataset_id";
  const STORAGE_SELECTED_DATASET_NAME = "processing_selected_dataset_name";
  const STORAGE_RATIO_SEARCH_BY_CONTEXT = "processing_ratio_search_by_context";

  // Variable untuk menyimpan parameter terbaik global
  let globalBestParams = null;
  let ratioComparisonData = {}; // Untuk menyimpan data perbandingan rasio
  let epochResultsData = []; // Untuk menyimpan hasil per epoch
  const MBERT_MULTI_SEEDS = [42, 123, 2024, 7];

  function isFinalTrainingMode(mode) {
    const m = String(mode || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    return m === "training-final" || m === "final-training" || m === "final";
  }

  function refreshAdminPageAOS() {
    requestAnimationFrame(() => {
      if (typeof window.refreshPageAOS === "function") {
        window.refreshPageAOS();
      } else if (typeof window.AOS !== "undefined" && typeof window.AOS.refresh === "function") {
        try {
          window.AOS.refresh();
        } catch (err) {
          /* ignore */
        }
      }
    });
  }

  function normalizeAlgoKey(value) {
    return String(value || "").trim().toLowerCase().replace(/_/g, "-");
  }

  /** Dashboard / localStorage lama memakai xlmr atau xlm-r; bucket Supabase: xlm-r. */
  function normalizeStoredAlgorithmSelection(raw) {
    const k = normalizeAlgoKey(raw);
    if (k === "xlmr" || k === "xlm-r" || k === "xlm-r-2") return "xlm-r";
    return k;
  }

  function getCurrentRatioContextKey() {
    const algoKey = normalizeAlgoKey(currentAlgo);
    const datasetKey = Number(selectedDatasetId) || 0;
    if (!algoKey || !datasetKey) return "";
    return `${algoKey}::${datasetKey}`;
  }

  function parseContextKey(contextKey) {
    const [algo = "", datasetIdRaw = ""] = String(contextKey || "").split("::");
    const datasetId = Number(datasetIdRaw);
    if (!algo || !Number.isFinite(datasetId) || datasetId <= 0) {
      return { algo: "", datasetId: 0 };
    }
    return { algo: normalizeAlgoKey(algo), datasetId };
  }

  function sanitizeRatioComparisonData(value) {
    if (!value || typeof value !== "object") return {};
    const sanitized = {};
    Object.entries(value).forEach(([ratio, metrics]) => {
      if (!/^\d{1,2}:\d{1,2}$/.test(String(ratio || ""))) return;
      sanitized[ratio] = {
        accuracy: Number(metrics?.accuracy) || 0,
        precision: Number(metrics?.precision) || 0,
        recall: Number(metrics?.recall) || 0,
        f1: Number(metrics?.f1) || 0,
        loss: Number(metrics?.loss) || 0,
      };
    });
    return sanitized;
  }

  function parseRatioParts(ratio) {
    const parts = String(ratio || "").split(":");
    const train = Number(parts[0]);
    const test = Number(parts[1]);
    return {
      train: Number.isFinite(train) ? train : 9999,
      test: Number.isFinite(test) ? test : 9999,
    };
  }

  function ratioBestScore(metrics) {
    const accuracy = Number(metrics?.accuracy) || 0;
    const f1 = Number(metrics?.f1) || 0;
    return (accuracy + f1) / 2;
  }

  function isMbertParams(params = {}) {
    return normalizeAlgoKey(params?.algo || currentAlgo) === "mbert";
  }

  /** IndoBERT / XLM-R: satu nilai seed (tanpa mode multi seperti mBERT). */
  function isIndobertOrXlmParams(params = {}) {
    const k = normalizeAlgoKey(params?.algo || currentAlgo);
    return k === "indobert" || k === "xlm-r";
  }

  function isTransformerAlgoKey(algo) {
    const k = normalizeAlgoKey(algo || "");
    return k === "indobert" || k === "mbert" || k === "xlm-r";
  }

  function resolveParamDisplay(params = {}, camel, snake) {
    if (!params || typeof params !== "object") return undefined;
    const c = params[camel];
    if (c !== undefined && c !== null && c !== "") return c;
    if (snake && params[snake] !== undefined && params[snake] !== null && params[snake] !== "") {
      return params[snake];
    }
    return undefined;
  }

  function resolveMaxLengthDisplay(params = {}) {
    const v = resolveParamDisplay(params, "maxLength", "max_length");
    return v === undefined || v === null || v === "" ? "-" : String(v);
  }

  function normalizeParameterViewForDisplay(params = {}, extra = {}) {
    const merged = { ...(params || {}), ...(extra || {}) };
    if (
      resolveParamDisplay(merged, "maxLength", "max_length") === undefined &&
      extra.max_length != null
    ) {
      merged.maxLength = extra.max_length;
    }
    if (!merged.algo && extra.algo) merged.algo = extra.algo;
    return merged;
  }

  function formatTransformerInputSnippet(params = {}) {
    if (isMbertParams(params) || isIndobertOrXlmParams(params)) {
      const seed = params.seed || "-";
      return `<strong>MaxLen:</strong> ${resolveMaxLengthDisplay(params)} | <strong>Seed:</strong> ${seed}`;
    }
    if (isTransformerAlgoKey(params?.algo || currentAlgo)) {
      return `<strong>MaxLen:</strong> ${resolveMaxLengthDisplay(params)}`;
    }
    return `<strong>MaxLen:</strong> ${resolveMaxLengthDisplay(params)}`;
  }

  function formatTransformerInputLayerLabel(params = {}) {
    if (isMbertParams(params) || isIndobertOrXlmParams(params)) {
      return {
        label: "Max Length / Seed",
        value: `${resolveMaxLengthDisplay(params)} / ${params.seed || "-"}`,
      };
    }
    return { label: "Max Length", value: resolveMaxLengthDisplay(params) };
  }

  function mbertSeedValue(params = {}) {
    return params.seed || "-";
  }

  /**
   * Std dev F1 antar epoch, disimpan skala 0–1 (selaras test_std_deviation / sklearn).
   * F1 epoch di UI biasanya persen (0–100); std persen dibagi 100 sebelum disimpan ke Supabase.
   */
  function computeEpochF1StdDev(epochResults) {
    if (!Array.isArray(epochResults) || epochResults.length < 2) return null;
    const f1Vals = epochResults
      .map((r) => {
        const raw = r.f1 != null && r.f1 !== "" ? r.f1 : r.f1_score;
        const n = Number(raw);
        return Number.isFinite(n) ? n : NaN;
      })
      .filter((n) => Number.isFinite(n));
    if (f1Vals.length < 2) return null;
    const avg = f1Vals.reduce((a, b) => a + b, 0) / f1Vals.length;
    const variance =
      f1Vals.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / f1Vals.length;
    const stdRaw = Math.sqrt(variance);
    const f1OnPercentScale = f1Vals.some((v) => v > 1) || avg > 1;
    return f1OnPercentScale ? stdRaw / 100 : stdRaw;
  }

  function epochF1StdFromCardTable(card) {
    const tableBody = card?.querySelector(".results-table tbody");
    if (!tableBody) return null;
    const rows = Array.from(tableBody.querySelectorAll("tr")).filter((row) => {
      const epochLabel = String(row.cells?.[0]?.innerText || "")
        .trim()
        .toLowerCase();
      return epochLabel && epochLabel !== "average";
    });
    const f1Vals = rows
      .map((row) => parseFloat(row.cells?.[4]?.innerText))
      .filter((n) => Number.isFinite(n));
    if (f1Vals.length < 2) return null;
    return computeEpochF1StdDev(
      f1Vals.map((f1, i) => ({ epoch: i + 1, f1 })),
    );
  }

  function parseSeedSelection(rawValue) {
    const raw = String(rawValue || "").trim().toLowerCase();
    if (!raw) return { mode: "single", seeds: [42] };
    if (["all", "all-seed", "all-seeds", "*"].includes(raw)) {
      return { mode: "all", seeds: [...MBERT_MULTI_SEEDS] };
    }
    const parts = String(rawValue)
      .split(",")
      .map((x) => parseInt(String(x).trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (parts.length > 1) {
      return { mode: "all", seeds: Array.from(new Set(parts)) };
    }
    const single = parseInt(String(rawValue).trim(), 10);
    if (Number.isFinite(single) && single > 0) {
      return { mode: "single", seeds: [single] };
    }
    return { mode: "single", seeds: [42] };
  }

  function loadRatioSearchContextStore() {
    try {
      const raw = localStorage.getItem(STORAGE_RATIO_SEARCH_BY_CONTEXT);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const sanitizedStore = {};
      Object.entries(parsed).forEach(([contextKey, contextState]) => {
        const meta = parseContextKey(contextKey);
        if (!meta.algo || !meta.datasetId) return;
        sanitizedStore[contextKey] = {
          algo: meta.algo,
          datasetId: meta.datasetId,
          globalBestParams:
            contextState?.globalBestParams &&
            typeof contextState.globalBestParams === "object"
              ? contextState.globalBestParams
              : null,
          ratioComparisonData: sanitizeRatioComparisonData(
            contextState?.ratioComparisonData,
          ),
          updatedAt: contextState?.updatedAt || null,
        };
      });
      return sanitizedStore;
    } catch (err) {
      console.warn("Failed to parse ratio search context store", err);
      return {};
    }
  }

  function saveRatioSearchContextStore(store) {
    localStorage.setItem(STORAGE_RATIO_SEARCH_BY_CONTEXT, JSON.stringify(store || {}));
  }

  function renderGlobalBestParamsDisplay() {
    const bestParamsDisplay = document.getElementById("best-params-display");
    const globalBestContent = document.querySelector(
      "#best-params-display .best-params-content",
    );

    if (!bestParamsDisplay || !globalBestContent) return;

    if (!globalBestParams) {
      bestParamsDisplay.style.display = "none";
      globalBestContent.innerHTML = "";
      return;
    }

    globalBestContent.innerHTML = `
      <p><strong>Split Ratio:</strong> ${globalBestParams.splitRatio || "-"}</p>
      <p><strong>Learning Rate:</strong> ${globalBestParams.lr || "-"}</p>
      <p><strong>Epoch:</strong> ${globalBestParams.epoch || "-"}</p>
      <p><strong>Batch Size:</strong> ${globalBestParams.batchSize || "-"}</p>
      <p>${formatTransformerInputSnippet(globalBestParams)}</p>
      <p><strong>Best Score (Accuracy + F1):</strong> ${Number(globalBestParams.avgScore || 0).toFixed(2)}%</p>
    `;
    bestParamsDisplay.style.display = currentMode === "cari-rasio" ? "block" : "none";
  }

  function renderRatioComparisonTable() {
    const section = document.getElementById("ratio-comparison-section");
    const tbody = document.getElementById("comparison-body");
    if (!section || !tbody) return;

    const entries = Object.entries(ratioComparisonData || {});
    if (entries.length === 0) {
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="6" style="text-align:center; color:#999; padding: 30px;">No comparison data is available yet. Run training to view results.</td></tr>';
      section.style.display = "none";
      return;
    }

    let bestScore = -1;
    let bestRatio = "";
    entries.forEach(([ratio, data]) => {
      const score = ratioBestScore(data);
      if (score > bestScore) {
        bestScore = score;
        bestRatio = ratio;
      }
    });

    const sortedEntries = entries.sort((a, b) => {
      const ra = parseRatioParts(a[0]);
      const rb = parseRatioParts(b[0]);
      if (ra.train !== rb.train) return ra.train - rb.train;
      if (ra.test !== rb.test) return ra.test - rb.test;
      return String(a[0]).localeCompare(String(b[0]));
    });

    tbody.innerHTML = sortedEntries
      .map(([ratio, data]) => {
        const metrics = {
          accuracy: Number(data?.accuracy) || 0,
          precision: Number(data?.precision) || 0,
          recall: Number(data?.recall) || 0,
          f1: Number(data?.f1) || 0,
          loss: Number(data?.loss) || 0,
        };
        const isBest = ratio === bestRatio;
        return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.2); font-weight: 600;" : ""}">
          <td style="padding: 12px 15px; text-align: center;">
            <strong>${ratio}</strong>
            ${isBest ? " (Best)" : ""}
          </td>
          <td style="padding: 12px 15px; text-align: center;">${metrics.accuracy.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${metrics.precision.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${metrics.recall.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${metrics.f1.toFixed(2)}%</td>
          <td style="padding: 12px 15px; text-align: center;">${metrics.loss.toFixed(4)}</td>
        </tr>
      `;
      })
      .join("");

    section.style.display = currentMode === "cari-rasio" ? "block" : "none";
  }

  function persistRatioSearchContextState() {
    const contextKey = getCurrentRatioContextKey();
    if (!contextKey) return;
    const meta = parseContextKey(contextKey);
    if (!meta.algo || !meta.datasetId) return;
    const store = loadRatioSearchContextStore();
    store[contextKey] = {
      algo: meta.algo,
      datasetId: meta.datasetId,
      globalBestParams: globalBestParams || null,
      ratioComparisonData: sanitizeRatioComparisonData(ratioComparisonData),
      updatedAt: new Date().toISOString(),
    };
    saveRatioSearchContextStore(store);
  }

  function applyRatioSearchContextState(options = {}) {
    const { rerenderParams = false } = options;
    const contextKey = getCurrentRatioContextKey();
    const store = loadRatioSearchContextStore();
    const contextState = contextKey ? store[contextKey] : null;

    const isMatchingContext =
      normalizeAlgoKey(contextState?.algo) === normalizeAlgoKey(currentAlgo) &&
      Number(contextState?.datasetId) === (Number(selectedDatasetId) || 0);
    globalBestParams =
      isMatchingContext && contextState?.globalBestParams
        ? contextState.globalBestParams
        : null;
    ratioComparisonData =
      isMatchingContext && contextState?.ratioComparisonData
        ? sanitizeRatioComparisonData(contextState.ratioComparisonData)
        : {};

    if (rerenderParams) {
      renderParameters(currentMode, () => {
        updateRatioDropdown();
        if (currentMode === "training-final" && globalBestParams) {
          fillParametersFromGlobalBest();
        }
        renderGlobalBestParamsDisplay();
        renderRatioComparisonTable();
      });
      return;
    }

    renderGlobalBestParamsDisplay();
    renderRatioComparisonTable();
  }
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
      showToast("Enter a valid Train value (1-99)", "error");
      trainInput.classList.add("error");
      return;
    }

    if (isNaN(testVal)) {
      testVal = 100 - trainVal;
      testInput.value = testVal;
    }

    if (testVal < 1 || testVal > 99) {
      showToast("Test value must be between 1-99", "error");
      testInput.classList.add("error");
      return;
    }

    if (trainVal + testVal !== 100) {
      showToast(
        `Train + Test must total 100 (currently ${trainVal + testVal})`,
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
      showToast("This ratio already exists in the table", "error");
      return;
    }

    trainInput.classList.remove("error");
    testInput.classList.remove("error");

    if (editingIndex >= 0) {
      ratioData[editingIndex] = { train: trainVal, test: testVal };
      showToast(`Ratio ${trainVal}:${testVal} was updated successfully`);
      editingIndex = -1;
      document.getElementById("btn-add-ratio").innerHTML = "Add";
    } else {
      ratioData.push({ train: trainVal, test: testVal });
      showToast(`Ratio ${trainVal}:${testVal} was added successfully`);
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
          <div class="ratio-action-wrap">
            <button class="btn-edit" data-index="${index}">Edit</button>
            <button class="btn-delete" data-index="${index}">Delete</button>
          </div>
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
    document.getElementById("btn-add-ratio").innerHTML = "Save";
    trainInput.focus();
  }

  function confirmDeleteRatio(index) {
    deletePendingIndex = index;
    const item = ratioData[index];

    const modalP = confirmModal.querySelector("p");
    modalP.innerHTML = `Are you sure you want to delete ratio <strong>${item.train}:${item.test}</strong>?`;
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

      showToast(`Ratio ${deleted.train}:${deleted.test} deleted`);

      if (editingIndex === index) {
        document.getElementById("train-input").value = "";
        document.getElementById("test-input").value = "";
        document.getElementById("test-input").dataset.auto = "true";
        editingIndex = -1;
        document.getElementById("btn-add-ratio").innerHTML = "Add";
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
      '<option value="" disabled selected>-- Select Ratio --</option>';

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
        <h4>Delete Confirmation</h4>
        <p>Are you sure you want to delete this ratio?</p>
        <div class="modal-confirm-actions">
          <button class="btn-confirm-cancel" id="btn-confirm-cancel">Cancel</button>
          <button class="btn-confirm-delete" id="btn-confirm-delete">Delete</button>
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

  // ----- Excel export (read-only; does not alter training UI state) -----
  async function exportProcessingTableXlsx({
    filename,
    sheetName,
    table,
    tableOpts,
    title,
    extraMatrix,
  }) {
    if (!window.KamusExcel) {
      showToast("Excel module not loaded.", "error");
      return;
    }
    await window.KamusExcel.ensureExcelJs();
    const sheets = [];
    if (extraMatrix && extraMatrix.length) {
      sheets.push({
        name: "Metadata",
        layout: "metadata",
        matrix: extraMatrix,
      });
    }
    sheets.push({
      name: sheetName || "Export",
      title: title || undefined,
      table,
      tableOpts: Object.assign({ skipEmptyRows: true, uppercaseHeader: true }, tableOpts || {}),
    });
    await window.KamusExcel.exportWorkbook(filename, sheets);
  }

  async function exportRatioSplitsXlsx() {
    const tbl = document.getElementById("ratio-table");
    if (!tbl) {
      showToast("Split ratio table not found.", "error");
      return;
    }
    const meta = [
      ["Exported", new Date().toLocaleString()],
      ["Algorithm", currentAlgo || document.getElementById("algo-select")?.value || "-"],
    ];
    await exportProcessingTableXlsx({
      filename: `processing_split_ratios_${Date.now()}`,
      sheetName: "Split_ratios",
      table: tbl,
      tableOpts: { skipColumnsFromEnd: 1 },
      title: "Configured train/test split ratios",
      extraMatrix: meta,
    });
    showToast("Split ratios exported.", "success");
  }

  async function exportRatioComparisonXlsx() {
    const tbl = document.getElementById("comparison-table");
    if (!tbl) {
      showToast("Comparison table not found.", "error");
      return;
    }
    const meta = [
      ["Exported", new Date().toLocaleString()],
      ["Algorithm", currentAlgo || "-"],
      ["Mode", currentMode || "-"],
    ];
    await exportProcessingTableXlsx({
      filename: `processing_ratio_comparison_${Date.now()}`,
      sheetName: "Ratio_compare",
      table: tbl,
      title: "Ratio comparison (Find Best Ratio)",
      extraMatrix: meta,
    });
    showToast("Ratio comparison exported.", "success");
  }

  async function exportTrainingLogTableXlsx() {
    const tbl = document.getElementById("history-table");
    if (!tbl) {
      showToast("Training log table not found.", "error");
      return;
    }
    const meta = [
      ["Exported", new Date().toLocaleString()],
      ["Note", "Browser-stored training history (best-ratio runs, summary row)."],
    ];
    await exportProcessingTableXlsx({
      filename: `processing_training_log_${Date.now()}`,
      sheetName: "Training_log",
      table: tbl,
      tableOpts: { skipColumnsFromEnd: 1 },
      title: "Training log",
      extraMatrix: meta,
    });
    showToast("Training log exported.", "success");
  }

  async function exportTrainingCardEpochs(card) {
    if (!card || !window.KamusExcel) {
      showToast("Excel module not loaded.", "error");
      return;
    }
    const table = card.querySelector(".results-table");
    if (!table) {
      showToast("Results table not found on this card.", "error");
      return;
    }
    const titleEl = card.querySelector(".training-title");
    const ratioEl = card.querySelector(".result-ratio-display");
    const title = titleEl ? titleEl.innerText.trim() : "Training";
    const ratio = ratioEl ? ratioEl.innerText.trim() : "";
    await window.KamusExcel.ensureExcelJs();
    await window.KamusExcel.exportWorkbook(`processing_training_epochs_${Date.now()}`, [
      {
        name: "Metadata",
        layout: "metadata",
        matrix: [
          ["Title", title],
          ["Ratio", ratio || "-"],
          ["Exported (local time)", new Date().toLocaleString()],
          ["Algorithm", currentAlgo || "-"],
        ],
      },
      {
        name: "Epoch_results",
        title: "Per-epoch training results",
        table,
        tableOpts: { skipEmptyRows: true, uppercaseHeader: true },
      },
    ]);
    showToast("Training epochs exported.", "success");
  }

  async function exportHistoryDetailModalXlsx() {
    if (!window.KamusExcel) {
      showToast("Excel module not loaded.", "error");
      return;
    }
    const name =
      document.getElementById("detail-training-name")?.innerText?.trim() ||
      "training_detail";
    const safe = window.KamusExcel.sanitizeFilename(name).slice(0, 60);
    const resultsTable = document.getElementById("history-results-table");
    const confusionTable = document.getElementById("history-confusion-table");
    const confusionSection = document.getElementById("history-confusion-section");
    const hasConfusion =
      confusionSection &&
      confusionSection.style.display !== "none" &&
      confusionTable &&
      confusionTable.querySelector("tr");

    await window.KamusExcel.ensureExcelJs();

    const summaryRows = [
      ["Training name", document.getElementById("detail-training-name")?.innerText || "-"],
      ["Model name", document.getElementById("detail-model-name")?.innerText || "-"],
      ["Split ratio", document.getElementById("detail-ratio")?.innerText || "-"],
      ["Date", document.getElementById("detail-date")?.innerText || "-"],
      ["Algorithm", document.getElementById("detail-algo")?.innerText || "-"],
      ["Description", document.getElementById("detail-desc")?.innerText || "-"],
      ["Exported", new Date().toLocaleString()],
    ];

    const sheets = [
      {
        name: "Metadata",
        layout: "metadata",
        matrix: summaryRows,
      },
      {
        name: "Epoch_results",
        title: "Training results by epoch",
        table: resultsTable,
        tableOpts: { skipEmptyRows: true, uppercaseHeader: true },
      },
    ];

    if (hasConfusion) {
      sheets.push({
        name: "Confusion",
        title: "Confusion matrix (best accuracy epoch)",
        table: confusionTable,
        tableOpts: { uppercaseHeader: true },
      });
    } else {
      sheets.push({
        name: "Confusion",
        layout: "conclusion",
        title: "Confusion matrix",
        matrix: [["Confusion matrix was not available or not shown for this run."]],
      });
    }

    await window.KamusExcel.exportWorkbook(`processing_log_${safe}_${Date.now()}`, sheets);
    showToast("Training detail exported.", "success");
  }

  window.exportHistoryDetailModalXlsx = exportHistoryDetailModalXlsx;

  document.addEventListener("DOMContentLoaded", function () {
    const algoSelect = document.getElementById("algo-select");
    const modelSelect = document.getElementById("model-select");
    const btnPilihDataset = document.getElementById("btn-pilih-dataset");
    const modeRadios = document.querySelectorAll('input[name="training-mode"]');
    const btnSimpanNama = document.getElementById("btn-simpan-nama");

    initRatioManager();
    loadPreprocessedDatasets();

    if (typeof window.kamusInitXlmGeneration === "function") {
      void window.kamusInitXlmGeneration();
    }

    const preferredAlgo = normalizeStoredAlgorithmSelection(
      localStorage.getItem("selectedAlgorithm") || "",
    );
    if (preferredAlgo && Array.from(algoSelect.options || []).some((opt) => opt.value === preferredAlgo)) {
      algoSelect.value = preferredAlgo;
      currentAlgo = preferredAlgo;
      localStorage.setItem("selectedAlgorithm", preferredAlgo);
    } else {
      algoSelect.value = "indobert";
      currentAlgo = "indobert";
      localStorage.setItem("selectedAlgorithm", "indobert");
    }

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

    if (btnSimpanNama) {
      btnSimpanNama.addEventListener("click", simpanNamaModel);
    }

    applyModeSpecificVisibility();
    // Render parameter saat initial load agar box tidak kosong
    // ketika algoritma sudah terpilih dari state sebelumnya/default select.
    if (!currentAlgo && algoSelect && algoSelect.value) {
      currentAlgo = algoSelect.value;
    }
    updateTrainingNamePlaceholder();
    renderParameters(currentMode, () => {
      if (currentMode === "training-final" && globalBestParams) {
        updateRatioDropdown();
        fillParametersFromGlobalBest();
      }
      applyRatioSearchContextState();
      refreshAdminPageAOS();
    });

    if (isXlmAlgoKey(currentAlgo)) {
      void syncLocalSavedXlmModelsToSupabase({ silent: false });
    }

    const datasetList = document.getElementById("dataset-list");
    if (datasetList) {
      datasetList.addEventListener("click", function (e) {
        const li = e.target.closest("li");
        if (!li) return;
        selectDatasetListItem(li);
      });
    }

    const modelList = document.getElementById("model-list");
    if (modelList) {
      modelList.addEventListener("click", function (e) {
        const li = e.target.closest("li");
        if (!li) return;
        document
          .querySelectorAll("#model-list li")
          .forEach((el) => el.classList.remove("selected"));
        li.classList.add("selected");
        selectedModel = li;
        setModelSelectionStatus(`Selected candidate model: ${li.innerText.trim()}. Click Select to apply.`, "warning");
      });
    }

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
            showToast("Training result deleted");
          }
        }

        // Tombol "Use Best Model" di dalam card
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

        if (
          e.target.classList.contains("btn-export-card-epochs") ||
          e.target.closest(".btn-export-card-epochs")
        ) {
          const btn = e.target.closest(".btn-export-card-epochs");
          const card = btn && btn.closest(".training-card");
          if (card) {
            void exportTrainingCardEpochs(card).catch((err) => {
              showToast(err && err.message ? err.message : String(err), "error");
            });
          }
        }
      });
    }

    const _exportCatch = (err) =>
      showToast(err && err.message ? err.message : String(err), "error");

    document.getElementById("btn-export-ratio-splits")?.addEventListener("click", () => {
      void exportRatioSplitsXlsx().catch(_exportCatch);
    });
    document.getElementById("btn-export-ratio-comparison")?.addEventListener("click", () => {
      void exportRatioComparisonXlsx().catch(_exportCatch);
    });
    document.getElementById("btn-export-training-log")?.addEventListener("click", () => {
      void exportTrainingLogTableXlsx().catch(_exportCatch);
    });
    document.getElementById("btn-export-history-detail-xlsx")?.addEventListener("click", () => {
      void exportHistoryDetailModalXlsx().catch(_exportCatch);
    });
  });

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
        return `<li data-dataset-id="${ds.id}" onclick="selectDatasetItem(this)">${label}</li>`;
      })
      .join("");

    // Auto-select dataset yang dibawa dari halaman Pre Processing.
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
        selectDatasetListItem(selectedLi);
      }

      applyRatioSearchContextState({ rerenderParams: true });

      return;
    }

    // fallback jika ID tidak ditemukan di list (mis. baru dihapus)
    if (preferredName) {
      const datasetCardName = document.getElementById("dataset-card-name");
      const datasetCard = document.getElementById("dataset-card");
      if (datasetCardName) datasetCardName.innerText = preferredName;
      if (datasetCard) datasetCard.style.display = "flex";
    }
  }

  function selectDatasetListItem(li) {
    if (!li) return;
    document
      .querySelectorAll("#dataset-list li")
      .forEach((el) => el.classList.remove("selected"));
    li.classList.add("selected");
  }

  window.selectDatasetItem = function (li) {
    selectDatasetListItem(li);
  };

  async function simpanNamaModel() {
    const namaModelInput = document.getElementById("new-model-name");
    const namaModel = namaModelInput.value.trim();

    if (!namaModel) {
      showToast("Please enter a model name first.");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(namaModel)) {
      showToast("Model name can only contain letters, numbers, hyphens, and underscores.");
      return;
    }

    if (namaModel.length > 50) {
      showToast("Model name cannot exceed 50 characters.");
      return;
    }

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("models")
        .select("id")
        .ilike("nama_model", namaModel);
      
      if (!error && data && data.length > 0) {
        showToast("Model name already exists. Please choose a different name.");
        return;
      }
    }

    modelNameSaved = true;

    const nameCard = document.getElementById("new-model-name-card");
    nameCard.innerHTML = `
      <p class="file-card-label">Model Name</p>
      <p class="file-card-name" style="flex:1;">${namaModel}</p>
      <button class="btn-small" id="btn-edit-nama" style="padding:8px 16px; margin-left:10px; background:transparent; color:#2c1f0e; border:1px solid #2c1f0e; border-radius:6px; cursor:pointer;">Edit</button>
    `;

    document
      .getElementById("btn-edit-nama")
      .addEventListener("click", function () {
        nameCard.innerHTML = `
        <p class="file-card-label">New Model Name</p>
        <input type="text" id="new-model-name" placeholder="Enter new model name" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${namaModel}">
        <button class="btn-small" id="btn-simpan-nama" style="padding:8px 16px; margin-left:10px; background:#2c1f0e; color:white; border:none; border-radius:6px; cursor:pointer;">Save</button>
      `;
        document
          .getElementById("btn-simpan-nama")
          .addEventListener("click", simpanNamaModel);
        modelNameSaved = false;
      });

    showToast("Model name was saved successfully.");
  }

  function onAlgoChange(e) {
    currentAlgo = e.target.value;
    localStorage.setItem("selectedAlgorithm", currentAlgo);
    updateTrainingNamePlaceholder();

    if (currentMode === "training-final") {
      const modelSelect = document.getElementById("model-select");
      const modelCard = document.getElementById("model-card");
      const newModelNameCard = document.getElementById("new-model-name-card");
      if (modelSelect) modelSelect.value = "";
      if (modelCard) modelCard.style.display = "none";
      if (newModelNameCard) newModelNameCard.style.display = "none";
      modelNameSaved = false;
    }

    applyRatioSearchContextState({ rerenderParams: true });
    if (isXlmAlgoKey(currentAlgo)) {
      void syncLocalSavedXlmModelsToSupabase({ silent: true });
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
    applyModeSpecificVisibility();

    if (currentMode === "cari-rasio") {
      paramCardCari.style.display = "block";
      paramCardFinal.style.display = "none";

      if (ratioSection) {
        ratioSection.style.display = "block";
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
        ratioSection.style.display = "none";
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
        void renderHistoryTable();
      }
      refreshAdminPageAOS();
    });
    refreshAdminPageAOS();
  }

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
      setModelSelectionStatus(
        `Creating a new ${getAlgorithmLabel(currentAlgo)} model. Save the name, then start training using the best ratio.`,
      );
    } else if (value === "lama") {
      selectedModel = null;
      loadOldModelsForCurrentAlgorithm();
      document.getElementById("modal-lama").style.display = "flex";
      if (datasetCard) datasetCard.style.display = "none";
      modelCard.style.display = "none";
      newModelNameCard.style.display = "none";
      setModelSelectionStatus(
        `Open existing model list for ${getAlgorithmLabel(currentAlgo)}. Select one model and click Select.`,
        "warning",
      );
    }
  }

  function getAlgorithmLabel(algo) {
    const a = String(algo || "").toLowerCase().trim();
    if (a === "indobert") return "IndoBERT";
    if (a === "mbert") return "mBERT";
    if (a === "xlm-r") return "XLM-R";
    if (a === "word2vec") return "Word2Vec";
    if (a === "glove") return "GloVe";
    return a || "selected algorithm";
  }

  function updateTrainingNamePlaceholder() {
    const input = document.getElementById("training-name");
    if (!input) return;
    const a = String(currentAlgo || "").toLowerCase().trim();
    if (!a) {
      input.placeholder = "Example: ModelName-BestRatio-v2";
      return;
    }
    input.placeholder = `Example: ${getAlgorithmLabel(currentAlgo)}-BestRatio-v2`;
  }

  function setModelSelectionStatus(message, tone = "info") {
    const el = document.getElementById("model-selection-status");
    if (!el) return;
    el.classList.remove("success", "warning");
    if (tone === "success") el.classList.add("success");
    if (tone === "warning") el.classList.add("warning");
    el.innerText = message || "No model selected yet.";
  }

  async function loadOldModelsForCurrentAlgorithm() {
    const list = document.getElementById("model-list");
    if (!list) return;

    if (!currentAlgo) {
      list.innerHTML = `<li style="opacity:.7;">Select an algorithm first</li>`;
      setModelSelectionStatus("Select an algorithm first before loading existing models.", "warning");
      return;
    }

    if (!supabaseClient) {
      list.innerHTML = `<li style="color:#c62828;">Supabase is unavailable</li>`;
      setModelSelectionStatus("Supabase is unavailable. Existing models cannot be loaded.", "warning");
      return;
    }

    list.innerHTML = `<li style="opacity:.7;">Loading models...</li>`;

    let query = supabaseClient.from("models").select("*");
    const algoKey = normalizeAlgoKey(currentAlgo);
    if (algoKey === "xlm-r") {
      query = query.in("algoritma", ["xlm-r", "xlm-r-2", "xlmr"]);
    } else {
      query = query.eq("algoritma", algoKey);
    }
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      list.innerHTML = `<li style="color:#c62828;">Failed to load models</li>`;
      return;
    }

    let models = data || [];
    if (algoKey === "xlm-r" && typeof window.kamusFilterXlmModelRows === "function") {
      models = window.kamusFilterXlmModelRows(models);
    }

    if (!models || models.length === 0) {
      list.innerHTML = `<li style="opacity:.7;">No saved ${getAlgorithmLabel(currentAlgo)} model yet</li>`;
      showToast(`No saved ${getAlgorithmLabel(currentAlgo)} model yet. Create a new model first.`);
      setModelSelectionStatus(
        `No saved ${getAlgorithmLabel(currentAlgo)} model yet. Use Create a New Model for training using the best ratio.`,
        "warning",
      );
      return;
    }

    setModelSelectionStatus(
      `${models.length} saved ${getAlgorithmLabel(currentAlgo)} model(s) found. Pick one and click Select.`,
    );

    list.innerHTML = models
      .map((m) => {
        const modelName = m.nama_model || `Model_${m.id}`;
        const warmupForUi =
          m.warmup_ratio != null && m.warmup_ratio !== ""
            ? m.warmup_ratio
            : m.warmup != null && m.warmup !== ""
              ? m.warmup
              : "";
        return `
          <li
            data-algo="${m.algoritma || ""}"
            data-ratio="${m.split_ratio || ""}"
            data-kfold="${m.k_fold || ""}"
            data-lr="${m.learning_rate || ""}"
            data-epoch="${m.epoch || ""}"
            data-batch="${m.batch_size || ""}"
            data-maxlen="${m.max_length || ""}"
            data-optimizer="${m.optimizer || ""}"
            data-weight-decay="${m.weight_decay || ""}"
            data-scheduler="${m.scheduler || ""}"
            data-warmup="${warmupForUi}"
            data-dropout="${m.dropout || ""}"
            data-early-stopping="${m.early_stopping || ""}"
            data-grad-accum="${m.gradient_accumulation || ""}"
            data-vector-size="${m.vector_size || ""}"
            data-window-size="${m.window_size || ""}"
            data-min-count="${m.min_count || ""}"
            data-model-type="${m.model_type || ""}"
            data-negative="${m.negative || ""}"
            data-x-max="${m.x_max || ""}"
            data-alpha="${m.alpha || ""}"
          >
            ${modelName}
          </li>
        `;
      })
      .join("");
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
        '<p style="color:#999; text-align:center; padding:20px;">Select an algorithm first</p>';
      if (callback) setTimeout(callback, 150);
      return;
    }

    let html = generateSplitValidationParams();

    const useCoreOnlyForRatio =
      mode === "cari-rasio" &&
      (currentAlgo === "indobert" ||
        currentAlgo === "mbert" ||
        currentAlgo === "xlm-r");

    if (useCoreOnlyForRatio) {
      html += generateFindBestRatioCoreParams(currentAlgo);
    } else {
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

    // Scope to the active mode container
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
      { id: "seed", key: "seed" },
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
        console.log(`split-ratio-select set: ${modelData.ratio}`);
      } else {
        console.log("split-ratio-select not found");
      }
    }

    // Field mappings
    const fieldMappings = [
      { attr: "lr", id: "lr" },
      { attr: "epoch", id: "epoch" },
      { attr: "batch", id: "batch-size" },
      { attr: "maxlen", id: "max-length" },
      { attr: "seed", id: "seed" },
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
        console.log(`${mapping.id} set: ${value}`);
      } else if (element) {
        console.log(`${mapping.id} has empty value:`, value);
      } else {
        console.log(`${mapping.id} not found`);
      }
    });
  }

  function generateSplitValidationParams() {
    return `
    <div class="param-row">
      <div class="param-group" style="grid-column: span 2;">
        ${renderLabelWithTooltip("Split Ratio", "split_ratio")}
        <select id="split-ratio-select" class="split-select">
          <option value="" disabled selected>-- Select Ratio --</option>
        </select>
      </div>
    </div>
  `;
  }

  function generateFindBestRatioCoreParams(algo) {
    const a = normalizeAlgoKey(algo);
    const isMbert = a === "mbert";
    const isIndoXlm = a === "indobert" || a === "xlm-r";
    const lrOptions =
      a === "xlm-r"
        ? `
          <option value="1e-5">1e-5 (Recommended)</option>
          <option value="1.5e-5">1.5e-5</option>
          <option value="2e-5">2e-5</option>
        `
        : a === "glove"
          ? `
          <option value="0.01">0.01</option>
          <option value="0.05">0.05 (Recommended)</option>
          <option value="0.1">0.1</option>
        `
          : a === "word2vec"
            ? `
          <option value="0.01">0.01</option>
          <option value="0.025">0.025 (Recommended)</option>
          <option value="0.05">0.05</option>
        `
            : `
          <option value="1e-5">1e-5</option>
          <option value="2e-5">2e-5 (Recommended)</option>
          <option value="3e-5">3e-5</option>
          <option value="5e-5">5e-5</option>
        `;

    const maxLengthField = `
      <div class="param-group">
        ${renderLabelWithTooltip("Max Length", "max_length")}
        <input type="text" id="max-length" list="max-length-options-core" placeholder="Select or type manually" value="">
        <datalist id="max-length-options-core">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32">32</option>
          <option value="64">64 (Recommended)</option>
          <option value="128">128</option>
        </datalist>
      </div>
    `;
    const seedFieldCoreMbert = `
      <div class="param-group">
        ${renderLabelWithTooltip("Seed", "seed")}
        <input type="text" id="seed" list="seed-options-core" placeholder="Select or type manually" value="">
        <datalist id="seed-options-core">
          <option value="7">7</option>
          <option value="42">42 (Recommended)</option>
          <option value="123">123</option>
          <option value="2024">2024</option>
          <option value="all">all (42,123,2024,7)</option>
        </datalist>
      </div>
    `;
    const seedFieldCoreSingle = `
      <div class="param-group">
        ${renderLabelWithTooltip("Seed", "seed")}
        <input type="text" id="seed" list="seed-options-core-single" placeholder="Select or type manually" value="">
        <datalist id="seed-options-core-single">
          <option value="7">7</option>
          <option value="42">42 (Recommended)</option>
          <option value="123">123</option>
          <option value="2024">2024</option>
        </datalist>
      </div>
    `;

    return `
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Learning Rate", "lr")}
          <input type="text" id="lr" list="lr-options-core" placeholder="Select or type manually" value="">
          <datalist id="lr-options-core">
            ${lrOptions}
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Epoch", "epoch")}
          <input type="number" id="epoch" placeholder="Example: 3" value="" min="1" max="200">
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Batch Size", "batch_size")}
          <input type="text" id="batch-size" list="batch-size-options-core" placeholder="Select or type manually" value="">
          <datalist id="batch-size-options-core">
            <option value="8">8</option>
            <option value="16">16 (Recommended)</option>
            <option value="32">32</option>
            <option value="64">64</option>
          </datalist>
        </div>
        ${maxLengthField}
      </div>
      ${
        isMbert
          ? `<div class="param-row">${seedFieldCoreMbert}</div>`
          : isIndoXlm
            ? `<div class="param-row">${seedFieldCoreSingle}</div>`
            : ""
      }
    `;
  }

  function renderLabelWithTooltip(label, key, isMandatory = true) {
    const content = PARAM_TOOLTIPS[key] || PARAM_TOOLTIPS.default;
    const mandatoryHtml = isMandatory ? '<span style="color:red">*</span>' : '';
    return `
      <label class="label-with-help">
        <span>${label}${mandatoryHtml}</span>
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
    seed:
      "<strong>Function:</strong> Controls random initialization and data split shuffle.<br><strong>Impact:</strong> Keeps experiments reproducible and helps search stable results.<br><strong>Risk:</strong> Using only one seed can produce misleadingly optimistic or pessimistic scores.",
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
      "<strong>Function:</strong> Vector dimension for word embeddings (Word2Vec/GloVe).<br><strong>Impact:</strong> Higher dimensions can capture richer features.<br><strong>Risk:</strong> Too high may overfit/slow down, too low may lose information.",
    window_size:
      "<strong>Function:</strong> Context window size observed by the model.<br><strong>Impact:</strong> Larger windows capture broader context.<br><strong>Risk:</strong> Too large may add noise, too small may miss context.",
    min_count:
      "<strong>Function:</strong> Minimum word frequency to be included in training.<br><strong>Impact:</strong> Filters very rare/noisy words.<br><strong>Risk:</strong> Too high removes important words, too low retains noise.",
    model_type:
      "<strong>Function:</strong> Chooses Word2Vec architecture (CBOW/Skip-gram).<br><strong>Impact:</strong> Skip-gram is usually better for rare words, CBOW is faster.<br><strong>Risk:</strong> Wrong selection may reduce embedding quality.",
    negative:
      "<strong>Function:</strong> Number of negative samples for embedding training.<br><strong>Impact:</strong> Helps the model distinguish correct/incorrect context.<br><strong>Risk:</strong> Too high is computationally heavy, too low is less effective.",
    x_max:
      "<strong>Function:</strong> Frequency weighting cap in GloVe.<br><strong>Impact:</strong> Controls the influence of very frequent word pairs.<br><strong>Risk:</strong> Too low/high may cause unbalanced weighting.",
    alpha:
      "<strong>Function:</strong> Frequency weighting exponent in GloVe.<br><strong>Impact:</strong> Determines sensitivity to word frequency.<br><strong>Risk:</strong> Extreme values may destabilize embeddings.",
  };

  // ==================== BERT FAMILY (IndoBERT / mBERT / XLM-R) PARAMETERS ====================
  function generateBertTransformerParams(bertDisplayName) {
    const bert = bertDisplayName || "IndoBERT";
    const algoKey = normalizeAlgoKey(currentAlgo);
    const isMbert = algoKey === "mbert";
    const isIndobert = algoKey === "indobert";
    const isXlm = algoKey === "xlm-r";
    const lrDatalistOptions = isXlm
      ? `
            <option value="1e-5">1e-5 (Recommended)</option>
            <option value="1.5e-5">1.5e-5</option>
            <option value="2e-5">2e-5</option>
          `
      : `
            <option value="1e-5">1e-5</option>
            <option value="2e-5">2e-5 (Recommended)</option>
            <option value="3e-5">3e-5</option>
            <option value="5e-5">5e-5</option>
          `;
    const inputReprValue = isXlm
      ? "SentencePiece tokens (XLM-RoBERTa)"
      : "WordPiece Tokens + [CLS]/[SEP]";
    const inputReprHint = isXlm
      ? `Input representation follows the ${bert} / RoBERTa tokenizer (preprocessed final_text).`
      : `Input representation follows the default ${bert} tokenizer.`;
    const maxLengthField = `
      <div class="param-group">
        ${renderLabelWithTooltip("Max Length", "max_length")}
        <input type="text" id="max-length" list="max-length-options" placeholder="Select or type manually" value="">
        <datalist id="max-length-options">
          <option value="8">8</option>
          <option value="16">16</option>
          <option value="32">32</option>
          <option value="64">64 (Recommended)</option>
          <option value="128">128</option>
        </datalist>
      </div>
    `;
    const seedField = `
      <div class="param-group">
        ${renderLabelWithTooltip("Seed", "seed")}
        <input type="text" id="seed" list="seed-options" placeholder="Select or type manually" value="">
        <datalist id="seed-options">
          <option value="7">7</option>
          <option value="42">42 (Recommended)</option>
          <option value="123">123</option>
          <option value="2024">2024</option>
          <option value="all">all (42,123,2024,7)</option>
        </datalist>
      </div>
    `;
    const indoXlmSeedField = `
      <div class="param-group">
        ${renderLabelWithTooltip("Seed", "seed")}
        <input type="text" id="seed" list="seed-options-indo-xlm" placeholder="Select or type manually" value="">
        <datalist id="seed-options-indo-xlm">
          <option value="7">7</option>
          <option value="42">42 (Recommended)</option>
          <option value="123">123</option>
          <option value="2024">2024</option>
        </datalist>
      </div>
    `;
    return `
    <div class="layer-card">
      <div class="layer-header">
        <h4>1. Input Layer</h4>
        <p>Input parameters are separated from other layers to align with text token handling in ${bert}.</p>
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
        ${isMbert ? seedField : maxLengthField}
      </div>
      ${isMbert ? `<div class="param-row">${maxLengthField}</div>` : ""}
      ${isIndobert || isXlm ? `<div class="param-row">${indoXlmSeedField}</div>` : ""}
      <div class="param-row">
        <div class="param-group">
          <label>Input Representation</label>
          <input type="text" value="${inputReprValue}" disabled>
          <small>${inputReprHint}</small>
        </div>
        <div class="param-group">
          <label>Attention Mask</label>
          <input type="text" value="Automatic" disabled>
          <small>Automatically generated during fine-tuning.</small>
        </div>
      </div>
    </div>

    <div class="layer-card">
      <div class="layer-header">
        <h4>2. Hidden Layer</h4>
        <p>Hyperparameter fine-tuning for the ${bert} encoder and classifier head.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Learning Rate", "lr")}
          <input type="text" id="lr" list="lr-options" placeholder="Select or type manually" value="">
          <datalist id="lr-options">
            ${lrDatalistOptions}
          </datalist>
        </div>
        <div class="param-group">
          ${renderLabelWithTooltip("Epoch", "epoch")}
          <input type="number" id="epoch" placeholder="Example: 3" value="" min="1" max="100">
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
          <small>Dropout and weight decay apply to the classifier head during fine-tuning.</small>
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
        <p>Output configuration for fine-tuning classification with Softmax.</p>
      </div>
      <div class="param-row">
        <div class="param-group">
          <label>Output Activation</label>
          <input type="text" value="Softmax" disabled>
          <small>Final output uses Softmax for class probabilities.</small>
        </div>
        <div class="param-group">
          <label>Loss Function</label>
          <input type="text" value="Cross Entropy" disabled>
          <small>Main loss function for multi-class classification.</small>
        </div>
      </div>
      <div class="param-row">
        <div class="param-group">
          ${renderLabelWithTooltip("Early Stopping", "early_stopping")}
          <input type="text" id="early-stopping" list="early-stopping-options" placeholder="Select or type manually" value="">
          <datalist id="early-stopping-options">
            <option value="0">Disabled</option>
            <option value="2">Enabled (patience 2) (Recommended)</option>
            <option value="3">Enabled (patience 3)</option>
          </datalist>
        </div>
        <div class="param-group">
          <label>Prediction Target</label>
          <input type="text" value="Label Class" disabled>
          <small>The output neuron count represents the number of labels in the dataset.</small>
        </div>
      </div>
    </div>
  `;
  }

  function generateIndoBERTParams() {
    return generateBertTransformerParams("IndoBERT");
  }

  // ==================== mBERT PARAMETERS (DATALIST) ====================
  function generateMBERTParams() {
    return generateBertTransformerParams("mBERT");
  }

  // ==================== XLM-R (UI berlapis seperti IndoBERT/mBERT; Supabase & API: xlm-r) ====================
  function generateXLMRParams() {
    return generateBertTransformerParams("XLM-R");
  }

  // ==================== Word2Vec PARAMETERS (DATALIST) ====================
  function generateWord2VecParams() {
    return `
    <div class="param-row">
      <div class="param-group">
        ${renderLabelWithTooltip("Vector Size", "vector_size")}
        <input type="text" id="vector-size" list="vector-size-options-w2v" placeholder="Select or type manually" value="">
        <datalist id="vector-size-options-w2v">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Window Size", "window_size")}
        <input type="text" id="window-size" list="window-size-options-w2v" placeholder="Select or type manually" value="">
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
        ${renderLabelWithTooltip("Min Count", "min_count")}
        <input type="text" id="min-count" list="min-count-options-w2v" placeholder="Select or type manually" value="">
        <datalist id="min-count-options-w2v">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Learning Rate", "lr")}
        <input type="text" id="lr" list="lr-options-w2v" placeholder="Select or type manually" value="">
        <datalist id="lr-options-w2v">
          <option value="0.01">0.01</option>
          <option value="0.025">0.025 (Recommended)</option>
          <option value="0.05">0.05</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        ${renderLabelWithTooltip("Epoch", "epoch")}
        <input type="number" id="epoch" placeholder="Example: 50" value="" min="1">
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Model Type", "model_type")}
        <input type="text" id="model-type" list="model-type-options-w2v" placeholder="Select or type manually" value="">
        <datalist id="model-type-options-w2v">
          <option value="skip-gram">Skip-gram (Recommended)</option>
          <option value="cbow">CBOW</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        ${renderLabelWithTooltip("Negative Sampling", "negative")}
        <input type="text" id="negative" list="negative-options-w2v" placeholder="Select or type manually" value="">
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
        ${renderLabelWithTooltip("Vector Size", "vector_size")}
        <input type="text" id="vector-size" list="vector-size-options-glove" placeholder="Select or type manually" value="">
        <datalist id="vector-size-options-glove">
          <option value="100">100 (Recommended)</option>
          <option value="150">150</option>
          <option value="200">200</option>
          <option value="300">300</option>
        </datalist>
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Window Size", "window_size")}
        <input type="text" id="window-size" list="window-size-options-glove" placeholder="Select or type manually" value="">
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
        ${renderLabelWithTooltip("Min Count", "min_count")}
        <input type="text" id="min-count" list="min-count-options-glove" placeholder="Select or type manually" value="">
        <datalist id="min-count-options-glove">
          <option value="1">1 (Recommended)</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
        </datalist>
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("Learning Rate", "lr")}
        <input type="text" id="lr" list="lr-options-glove" placeholder="Select or type manually" value="">
        <datalist id="lr-options-glove">
          <option value="0.01">0.01</option>
          <option value="0.05">0.05 (Recommended)</option>
          <option value="0.1">0.1</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        ${renderLabelWithTooltip("Epoch", "epoch")}
        <input type="number" id="epoch" placeholder="Example: 50" value="" min="1">
      </div>
      <div class="param-group">
        ${renderLabelWithTooltip("X_max", "x_max")}
        <input type="text" id="x-max" list="x-max-options-glove" placeholder="Select or type manually" value="">
        <datalist id="x-max-options-glove">
          <option value="50">50</option>
          <option value="100">100 (Recommended)</option>
          <option value="200">200</option>
        </datalist>
      </div>
    </div>
    <div class="param-row">
      <div class="param-group">
        ${renderLabelWithTooltip("Alpha", "alpha")}
        <input type="text" id="alpha" list="alpha-options-glove" placeholder="Select or type manually" value="">
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
    let selected = document.querySelector("#dataset-list li.selected");
    if (!selected) {
      selected = document.querySelector("#dataset-list li[data-dataset-id]");
      if (selected) selectDatasetListItem(selected);
    }

    if (!selected) {
      showToast("Please select a dataset first.");
      return;
    }

    const datasetName = selected.innerText.trim();
    selectedDatasetId = parseInt(selected.dataset.datasetId || "0", 10) || null;
    if (selectedDatasetId) {
      localStorage.setItem(STORAGE_SELECTED_DATASET_ID, String(selectedDatasetId));
      localStorage.setItem(STORAGE_SELECTED_DATASET_NAME, datasetName);
    }
    document.getElementById("dataset-card-name").innerText = datasetName;
    document.getElementById("dataset-card").style.display = "flex";

    const ratio = selected.dataset.ratio;
    const kfold = selected.dataset.kfold;

    setTimeout(() => {
      if (ratio && !globalBestParams) {
        const splitSelect = document.getElementById("split-ratio-select");
        if (splitSelect) splitSelect.value = ratio;
      }
    }, 100);

    applyRatioSearchContextState({ rerenderParams: true });

    closeModalDataset();
    showToast("Dataset was selected successfully.");
  };

  window.closeModalDataset = function () {
    const modal = document.getElementById("modal-dataset");
    if (modal) {
      modal.style.display = "none";
    }
  };

  function applySelectedOldModel() {
    if (!selectedModel) {
      showToast("Please select one model first.");
      setModelSelectionStatus("Select one model from the list first.", "warning");
      return;
    }

    const picked = selectedModel;
    const modelName = picked.innerText.trim();
    const ds = picked.dataset;
    const modelData = {
      ratio: ds.ratio,
      kfold: ds.kfold,
      lr: ds.lr,
      epoch: ds.epoch,
      batch: ds.batch,
      maxlen: ds.maxlen,
      optimizer: ds.optimizer,
      weightDecay: ds.weightDecay,
      scheduler: ds.scheduler,
      warmup: ds.warmup,
      dropout: ds.dropout,
      earlyStopping: ds.earlyStopping,
      gradAccum: ds.gradAccum,
      vectorSize: ds.vectorSize,
      windowSize: ds.windowSize,
      minCount: ds.minCount,
      modelType: ds.modelType,
      negative: ds.negative,
      xMax: ds.xMax,
      alpha: ds.alpha,
    };

    document
      .querySelectorAll("#model-list li")
      .forEach((el) => el.classList.remove("selected"));
    selectedModel = null;

    const modelCardName = document.getElementById("model-card-name");
    const modelCardMeta = document.getElementById("model-card-meta");
    const modelCard = document.getElementById("model-card");
    const modal = document.getElementById("modal-lama");
    const modelSelect = document.getElementById("model-select");
    if (modal) modal.style.display = "none";
    if (modelCardName) modelCardName.innerText = modelName;
    if (modelCardMeta) {
      modelCardMeta.innerText =
        "Selected existing model will prefill saved hyperparameters for training using the best ratio.";
    }
    if (modelCard) modelCard.style.display = "flex";
    if (modelSelect) modelSelect.value = "lama";

    const algo = ds.algo;
    if (algo) {
      document.getElementById("algo-select").value = algo;
      currentAlgo = algo;
    }

    renderParameters(currentMode, () => {
      setTimeout(() => {
        fillParametersFromModel(modelData);
        updateRatioDropdown();
        if (modelData.ratio) {
          const splitSelect = document.getElementById("split-ratio-select");
          if (splitSelect) splitSelect.value = modelData.ratio;
        }
        const trainingNameEl = document.getElementById("training-name");
        if (trainingNameEl && !String(trainingNameEl.value || "").trim()) {
          trainingNameEl.value = modelName;
        }
        showToast(`Model "${modelName}" was loaded successfully.`, "success");
        setModelSelectionStatus(
          `Selected model: ${modelName}. You can start training using the best ratio now or adjust parameters first.`,
          "success",
        );
      }, 150);
    });
  }

  window.pilihModelLama = function () {
    applySelectedOldModel();
  };

  window.closeModalLama = function () {
    const modal = document.getElementById("modal-lama");
    if (modal) modal.style.display = "none";
    const modelCard = document.getElementById("model-card");
    const modelSelect = document.getElementById("model-select");
    if (modelCard) modelCard.style.display = "none";
    if (modelSelect && modelSelect.value === "lama") modelSelect.value = "";
    document
      .querySelectorAll("#model-list li")
      .forEach((el) => el.classList.remove("selected"));
    selectedModel = null;
    setModelSelectionStatus("Existing model selection was cancelled.", "warning");
  };

  document.addEventListener("click", async function (e) {
    if (e.target.id === "btn-mulai-cari") {
      await startTraining("cari-rasio");
    } else if (e.target.id === "btn-mulai-training") {
      await startTraining("training-final");
    } else if (e.target.id === "btn-auto-test-all") {
      if (!ratioData || ratioData.length === 0) {
        showToast("No split ratios available in the table. Add ratios first.");
        return;
      }
      showToast(`Starting auto-test for ${ratioData.length} ratios...`);
      for (const ratioObj of ratioData) {
        const ratioStr = `${ratioObj.train}:${ratioObj.test}`;
        const splitSelect = document.getElementById("split-ratio-select");
        if (splitSelect) splitSelect.value = ratioStr;
        await startTraining("cari-rasio");
      }
      showToast("Auto-test for all ratios completed.", "success");
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
        title.innerHTML = `${trainingName} - Training (Best Ratio)`;
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
      const optimizerDisplay = params.optimizer || "-";

      paramsInfo.innerHTML = `
      <strong>Split:</strong> ${splitRatio} | 
      <strong>LR:</strong> ${lrDisplay} | 
      <strong>Epoch:</strong> ${epochDisplay} | 
      <strong>Batch:</strong> ${batchDisplay} | 
      ${formatTransformerInputSnippet(params)} | 
      <strong>Optimizer:</strong> ${optimizerDisplay}
    `;
    }

    // 🔧 SEMBUNYIKAN tombol "Use Best Model" untuk mode training-final
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    if (btnGunakanTerbaik && mode === "training-final") {
      btnGunakanTerbaik.style.display = "none";
    }

    const btnSimpan = card.querySelector(".btn-simpan-card");
    if (btnSimpan && mode === "cari-rasio") {
      btnSimpan.style.display = "none";
    }

    // Simpan parameter ke dataset card
    card.dataset.params = JSON.stringify(params);

    return card;
  }

  async function hydrateBestParamsForCurrentContext() {
    // 1) Coba ambil dari localStorage context store (paling cepat).
    try {
      applyRatioSearchContextState({ rerenderParams: false });
    } catch (e) {
      // ignore
    }
    if (globalBestParams) return true;

    // 2) Fallback: kalau pernah tersimpan di Supabase (mode cari-rasio), ambil best ((accuracy+f1)/2 tertinggi).
    if (!supabaseClient) return false;
    if (!currentAlgo || !selectedDatasetId) return false;

    try {
      const algoKeyCtx = normalizeAlgoKey(currentAlgo);
      let ratioQuery = supabaseClient
        .from("models")
        .select(
          "split_ratio,learning_rate,epoch,batch_size,max_length,seed,optimizer,weight_decay,scheduler,warmup_ratio,dropout,early_stopping,gradient_accumulation,f1_score,accuracy,precision,mode,algoritma,nama_model",
        )
        .eq("dataset_id", selectedDatasetId)
        .eq("mode", "cari-rasio");
      if (algoKeyCtx === "xlm-r") {
        ratioQuery = ratioQuery.in("algoritma", ["xlm-r", "xlm-r-2", "xlmr"]);
      } else {
        ratioQuery = ratioQuery.eq("algoritma", algoKeyCtx);
      }
      const { data, error } = await ratioQuery.order("created_at", {
        ascending: false,
      });

      if (error) return false;
      let ratioRows = data || [];
      if (
        algoKeyCtx === "xlm-r" &&
        typeof window.kamusFilterXlmModelRows === "function"
      ) {
        ratioRows = window.kamusFilterXlmModelRows(ratioRows);
      }
      const best = ratioRows.sort((a, b) => {
        const scoreA =
          ((Number(a?.accuracy) || 0) + (Number(a?.f1_score) || 0)) / 2;
        const scoreB =
          ((Number(b?.accuracy) || 0) + (Number(b?.f1_score) || 0)) / 2;
        return scoreB - scoreA;
      })[0];
      if (!best || !best.split_ratio) return false;

      globalBestParams = {
        algo: currentAlgo,
        splitRatio: best.split_ratio,
        lr: best.learning_rate,
        epoch: best.epoch,
        batchSize: best.batch_size,
        maxLength: best.max_length,
        seed: best.seed || "",
        optimizer: best.optimizer,
        weightDecay: best.weight_decay,
        scheduler: best.scheduler,
        warmup: best.warmup_ratio,
        dropout: best.dropout,
        earlyStopping: best.early_stopping,
        gradAccum: best.gradient_accumulation,
        avgScore:
          ((Number(best.accuracy) || 0) + (Number(best.f1_score) || 0)) / 2,
        avgAccuracy: Number(best.accuracy) || 0,
      };
      persistRatioSearchContextState();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function startTraining(mode) {
    const modelCard = document.getElementById("model-card");
    const modelSelected =
      modelCard && modelCard.style.display === "flex";

    const splitSelect = document.getElementById("split-ratio-select");
    const splitRatio = splitSelect?.value;

    if (!splitRatio) {
      showToast("Please select a split ratio first.");
      return;
    }

    const [trainStr, testStr] = splitRatio.split(":");
    const trainVal = parseInt(trainStr);
    if (isNaN(trainVal) || trainVal < 50) {
      showToast("Invalid training ratio. Training percentage must be at least 50 (e.g., 50:50).");
      return;
    }

    if (!currentAlgo) {
      showToast("Please select an algorithm first.");
      return;
    }

    // Pastikan state best ratio yang pernah dicari (localStorage/Supabase) ter-load,
    // supaya final training tidak salah ter-restrict.
    if (mode === "training-final" && !globalBestParams && !modelSelected) {
      await hydrateBestParamsForCurrentContext();
      if (!globalBestParams && !modelSelected) {
        showToast(
          "Please run Find the Best Ratio first, or select an existing model (Select Existing Model) to reuse its split and hyperparameters.",
        );
        return;
      }
    }

    // Parameter inti: transformer (mBERT / IndoBERT / XLM-R) wajib isi max-length + seed.
    const bertFamilyNeedsSeed =
      currentAlgo === "mbert" ||
      currentAlgo === "indobert" ||
      currentAlgo === "xlm-r";
    const requiredFields = bertFamilyNeedsSeed
      ? ["lr", "epoch", "batch-size", "max-length", "seed"]
      : ["lr", "epoch", "batch-size", "max-length"];
    for (let field of requiredFields) {
      const element = document.getElementById(field);
      if (element && !element.value) {
        showToast("All parameter fields must be filled before training.");
        return;
      }
    }

    const datasetSelected =
      document.getElementById("dataset-card").style.display === "flex";
    const modelNameCardShown =
      document.getElementById("new-model-name-card").style.display === "flex";

    if (mode !== "training-final" && !datasetSelected) {
      showToast("Please select a dataset first.");
      return;
    }

    // 🔧 Untuk mode training-final, validasi nama training
    if (mode === "training-final") {
      const trainingName = document
        .getElementById("training-name")
        ?.value.trim();
      if (!trainingName) {
        showToast("Please enter a training name first.");
        return;
      }

      if (!modelSelected && !modelNameCardShown) {
        showToast("Please select an existing model or create a new model first.");
        return;
      }

      if (modelNameCardShown && !modelNameSaved) {
        showToast("Please save the model name first.");
        return;
      }
    }

    const isCoreOnlyRatioSearch =
      mode === "cari-rasio" &&
      (currentAlgo === "indobert" ||
        currentAlgo === "mbert" ||
        currentAlgo === "xlm-r");

    const params = {
      splitRatio: splitRatio,
      lr: document.getElementById("lr")?.value || "",
      epoch: parseInt(document.getElementById("epoch")?.value) || 3,
      batchSize: document.getElementById("batch-size")?.value || "",
      maxLength: document.getElementById("max-length")?.value || "",
      seed: document.getElementById("seed")?.value || "42",
      algo: currentAlgo,
      mode: mode,
    };

    if (currentAlgo === "mbert") {
      const parsedSeed = parseSeedSelection(params.seed);
      params.seedMode = parsedSeed.mode;
      params.seedList = parsedSeed.seeds;
      params.seed = String(parsedSeed.seeds[0] || 42);
    }

    // Parameter lanjutan dipakai untuk:
    // 1) training-final semua algoritma
    // 2) cari-rasio untuk selain IndoBERT/mBERT (agar tetap seperti sebelumnya)
    if (mode === "training-final" || !isCoreOnlyRatioSearch) {
      Object.assign(params, {
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
      });
    }

    const container = document.getElementById("training-cards-container");
    if (mode === "training-final") {
      container.style.display = "flex";
    }

    const runSequentialSeeds =
      currentAlgo === "mbert" &&
      Array.isArray(params.seedList) &&
      params.seedList.length > 1;

    if (runSequentialSeeds) {
      showToast(
        `Running ${params.seedList.length} seeds sequentially: ${params.seedList.join(", ")}`,
        "info",
      );
      for (const seedValue of params.seedList) {
        const seededParams = {
          ...params,
          seed: String(seedValue),
          seedMode: "single",
        };
        const card = createTrainingCard(mode, seededParams);
        container.appendChild(card);
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        await simulateTrainingInCard(card, mode, seededParams);
      }
      return;
    }

    // 🔧 Buat training card untuk run tunggal
    const card = createTrainingCard(mode, params);
    container.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    const now = new Date().toLocaleTimeString("en-US", {
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

  const processingStepOrder = ["prepare", "queue", "train", "metrics", "finish"];

  function resetProcessingStepUI(card) {
    card.querySelectorAll(".proc-progress-step").forEach((el) => {
      el.classList.remove("active");
      el.classList.remove("done");
    });
    const elapsed = card.querySelector(".proc-progress-elapsed");
    if (elapsed) elapsed.textContent = "Elapsed time: 00:00";
  }

  function setProcessingStep(card, stepId) {
    const currentIdx = processingStepOrder.indexOf(stepId);
    card.querySelectorAll(".proc-progress-step").forEach((el) => {
      const idx = processingStepOrder.indexOf(el.dataset.step);
      el.classList.remove("active");
      el.classList.remove("done");
      if (idx < currentIdx) {
        el.classList.add("done");
      } else if (idx === currentIdx) {
        el.classList.add("active");
      }
    });
  }

  function startProcessingElapsed(card) {
    stopProcessingElapsed(card);
    card.dataset.progressStartedAt = String(Date.now());
    const elapsed = card.querySelector(".proc-progress-elapsed");
    const timerId = setInterval(() => {
      if (!elapsed) return;
      const startedAt = Number(card.dataset.progressStartedAt || 0);
      if (!startedAt) return;
      const totalSec = Math.floor((Date.now() - startedAt) / 1000);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      elapsed.textContent = `Elapsed time: ${mm}:${ss}`;
    }, 1000);
    card.dataset.progressTimerId = String(timerId);
  }

  function stopProcessingElapsed(card) {
    const timerId = Number(card.dataset.progressTimerId || 0);
    if (timerId) clearInterval(timerId);
    delete card.dataset.progressTimerId;
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

  async function simulateTrainingInCard(card, mode, params) {
    // Real training via backend for BERT-family models.
    if (["indobert", "mbert", "xlm-r"].includes(normalizeAlgoKey(params.algo || currentAlgo))) {
      await runBackendBertTraining(card, mode, params);
      return;
    }

    const progressBar = card.querySelector(".progress-bar");
    const progressText = card.querySelector(".progress-text");
    const tableBody = card.querySelector(".results-table tbody");

    let progress = 0;
    const totalEpochs = params.epoch;
    let currentEpoch = 0;
    const epochResults = []; // TAMBAHKAN: Array untuk menyimpan hasil

    tableBody.innerHTML = "";
    progressBar.classList.add("running");
    resetProgressLog(card, "Training started");
    resetProcessingStepUI(card);
    setProcessingStep(card, "prepare");
    startProcessingElapsed(card);
    appendProgressLog(card, `Mode: simulation ${params.algo || currentAlgo}`, "warning");
    setLoadingVisual(card, true, "Training simulation is running...");
    setProcessingStep(card, "train");

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 5) + 3;

      const epochProgress = Math.floor((progress / 100) * totalEpochs);

      if (epochProgress > currentEpoch && epochProgress <= totalEpochs) {
        currentEpoch = epochProgress;
        const result = addEpochResult(tableBody, currentEpoch, params);
        epochResults.push(result); // TAMBAHKAN: Simpan hasil
        appendProgressLog(
          card,
          `Epoch ${currentEpoch}/${totalEpochs} completed (F1 ${result.f1.toFixed(2)}%)`,
          "info",
        );
      }

        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setLoadingVisual(card, false);
          appendProgressLog(card, "All epochs completed, summarizing results...", "success");
          setProcessingStep(card, "metrics");
          finishTrainingInCard(card, mode, params, epochResults); // KIRIM epochResults
          resolve();
        }

        progressBar.style.width = progress + "%";
        progressText.innerText = `${progress}% — Training simulation is running...`;
      }, 400);
    });
  }

  async function runBackendBertTraining(card, mode, params) {
    return new Promise(async (resolve, reject) => {
    const progressBar = card.querySelector(".progress-bar");
    const progressText = card.querySelector(".progress-text");
    const tableBody = card.querySelector(".results-table tbody");

    if (!selectedDatasetId) {
      showToast("Please select a preprocessed dataset first.", "error");
      reject(new Error("Dataset is not selected"));
      return;
    }

    // Tentukan model name (untuk backend save)
    let modelName = "";
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
      const algoTag = ((params.algo || currentAlgo) === "mbert") ? "mBERT" : "IndoBERT";
      modelName =
        document.getElementById("training-name")?.value?.trim() || `${algoTag}_${Date.now()}`;
    }

    // Reset UI
    tableBody.innerHTML = "";
    progressBar.classList.add("running");
    resetProcessingStepUI(card);
    setProcessingStep(card, "prepare");
    startProcessingElapsed(card);
    const setProgressPct = (value) => {
      const safe = Math.max(0, Math.min(100, Number(value) || 0));
      progressBar.style.width = `${safe.toFixed(1)}%`;
      progressText.innerText = `${Math.round(safe)}% — Training in progress...`;
    };
    setProgressPct(0);
    const algoKeyTrain = normalizeAlgoKey(params.algo || currentAlgo);
    let backendTrainSlug = "indobert";
    if (algoKeyTrain === "mbert") backendTrainSlug = "mbert";
    else if (algoKeyTrain === "xlm-r") backendTrainSlug = "xlm-r";
    const algoLabel =
      algoKeyTrain === "mbert"
        ? "mBERT"
        : algoKeyTrain === "xlm-r"
          ? "XLM-R"
          : "IndoBERT";
    const isIndobertTrain = algoKeyTrain === "indobert";
    resetProgressLog(card, `Preparing ${algoLabel} training job...`);
    setLoadingVisual(card, true, "Sending job request to backend...");

    try {
      const payload = {
        dataset_id: selectedDatasetId,
        model_name: modelName,
        split_ratio: params.splitRatio || "80:20",
        lr: parseFloat(params.lr || "0.00002"),
        epoch: parseInt(params.epoch || 3, 10),
        batch_size: parseInt(params.batchSize || 16, 10),
        max_length: parseInt(params.maxLength || 64, 10),
        seed: (() => {
          const parsed = parseInt(params.seed || 42, 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 42;
        })(),
        // Cari rasio: fast_mode (partial fine-tune, seq lebih pendek). Final training: penuh.
        fast_mode: mode === "cari-rasio",
        weight_decay: parseFloat(params.weightDecay || "0.01"),
        warmup_ratio: parseFloat(params.warmup || "0.1"),
        dropout: parseFloat(params.dropout || "0.1"),
        grad_accum: parseInt(params.gradAccum || 1, 10),
        early_stopping_patience: parseInt(params.earlyStopping || 0, 10),
      };

      const trainAsyncUrl = isIndobertTrain
        ? `${API_BASE}/processing/indobert/train/async`
        : `${API_BASE}/processing/train/${encodeURIComponent(backendTrainSlug)}/async`;

      // Start async job
      const res = await fetch(trainAsyncUrl, {
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
      setLoadingVisual(card, true, `Job ${jobId.slice(0, 6)} is in progress...`);
      setProcessingStep(card, "queue");
      appendProgressLog(
        card,
        `Job created: ${jobId.slice(0, 8)} | device will be selected automatically`,
        "info",
      );

      // Poll status
      const epochResults = [];
      let renderedEpochs = 0;
      let lastStatus = "";
      setProgressPct(2);

      const poll = async () => {
        const statusUrl = isIndobertTrain
          ? `${API_BASE}/processing/indobert/train/status/${jobId}`
          : `${API_BASE}/processing/train/status/${jobId}`;
        const stRes = await fetch(statusUrl);
        const st = await stRes.json();
        if (!stRes.ok) throw new Error(st?.detail || "Failed to fetch status");

        if (st.status !== lastStatus) {
          lastStatus = st.status;
          if (st.status === "queued") appendProgressLog(card, "Job is still in the queue...", "warning");
          if (st.status === "running") {
            appendProgressLog(card, "Training is running on backend", "info");
            setProcessingStep(card, "train");
          }
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
          row.innerHTML = `
            <td>${m.epoch}</td>
            <td>${accuracy.toFixed(2)}%</td>
            <td>${precision.toFixed(2)}%</td>
            <td>${recall.toFixed(2)}%</td>
            <td>${f1.toFixed(2)}%</td>
            <td>${parseFloat(loss).toFixed(4)}</td>
          `;
          tableBody.appendChild(row);
          epochResults.push({
            epoch: m.epoch,
            accuracy,
            precision,
            recall,
            f1,
            loss: parseFloat(loss),
            mcc: Number.isFinite(Number(m.mcc)) ? Number(m.mcc) : null,
            roc_auc: Number.isFinite(Number(m.roc_auc))
              ? Number(m.roc_auc) * 100
              : null,
            confusion_matrix: m.confusion_matrix || null,
            confusion_labels: m.confusion_labels || null,
          });
          appendProgressLog(
            card,
            `Epoch ${m.epoch}/${totalEpochs} | Acc ${accuracy.toFixed(2)}% | Prec ${precision.toFixed(2)}% | F1 ${f1.toFixed(2)}% | Loss ${parseFloat(loss).toFixed(4)}`,
            "info",
          );
          renderedEpochs++;
        }

        if (st.status === "done") {
          setProgressPct(100);
          progressBar.classList.remove("running");
          setLoadingVisual(card, false);
          setProcessingStep(card, "metrics");
          appendProgressLog(
            card,
            `Training completed (${st.result?.device || "device"})`,
            "success",
          );
          if (st.result?.model_dir) {
            appendProgressLog(
              card,
              `Checkpoint folder (backend disk): ${st.result.model_dir}`,
              "info",
            );
          }

          finishTrainingInCard(card, mode, params, epochResults);
          showToast(
            `${algoLabel} training completed (${st.result?.device || "device"})`,
            "success",
          );
          resolve();
          return;
        }

        if (st.status === "error") {
          progressText.innerText = "100% — Failed";
          progressBar.classList.remove("running");
          setLoadingVisual(card, false);
          stopProcessingElapsed(card);
          appendProgressLog(card, `Training failed: ${st.error || "-"}`, "error");
          showToast(st.error || "Training failed", "error");
          reject(new Error(st.error || "Training failed"));
          return;
        }

        setTimeout(poll, 1000);
      };

      setTimeout(poll, 700);
    } catch (err) {
      console.error(err);
      progressBar.style.width = "100%";
      progressText.innerText = "100% — Failed";
      progressBar.classList.remove("running");
      setLoadingVisual(card, false);
      stopProcessingElapsed(card);
      appendProgressLog(card, `Error: ${err.message || "training failed"}`, "error");
      showToast(err.message || "Training failed", "error");
      reject(err);
    }
    });
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
          `Training (best ratio): Epoch ${currentEpoch}/${totalEpochs} completed`,
          "info",
        );
      }

      if (currentEpoch >= totalEpochs) {
        clearInterval(interval);

        // Training selesai - simpan ke history
        const trainingName =
          document.getElementById("training-name")?.value ||
          `Training_${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;
        const trainingDesc =
          document.getElementById("training-desc")?.value || "";
        const splitRatio =
          params.splitRatio ||
          document.getElementById("split-ratio-select")?.value ||
          "80:20";

        const historyEntry = {
          tanggal: new Date().toISOString(),
          training_name: trainingName,
          nama_model: trainingName,
          algo: params.algo || currentAlgo,
          rasio: splitRatio,
          keterangan: trainingDesc,
          parameter: {
            algo: params.algo || currentAlgo,
            lr: params.lr,
            epoch: params.epoch,
            batchSize: params.batchSize,
            maxLength: params.maxLength,
            seed: params.seed,
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

        void saveTrainingHistory(historyEntry);

        // Hitung average untuk ditampilkan di toast
        const avgF1 =
          epochResults.reduce((sum, r) => sum + r.f1, 0) / epochResults.length;

        showToast(
          `Training completed. Average F1: ${avgF1.toFixed(2)}%`,
          "success",
        );

        // Reset input form (opsional)
        document.getElementById("training-name").value = "";
        document.getElementById("training-desc").value = "";
      }
    }, 800); // Delay per epoch
  }

  /** Estimasi ROC training (persen) — sama rumus backend `estimate_train_roc_auc_percent`. */
  function estimateTrainRocAucPercent(accuracy, precision, recall, f1, mcc) {
    const parts = [accuracy, precision, recall, f1, mcc].filter((n) =>
      Number.isFinite(Number(n)),
    );
    if (!parts.length) return null;
    return parts.reduce((a, b) => a + Number(b), 0) / parts.length;
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
    const roc_auc = estimateTrainRocAucPercent(
      accuracy,
      precision,
      recall,
      f1,
      null,
    );
    return {
      epoch,
      accuracy,
      precision,
      recall,
      f1,
      loss,
      roc_auc,
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
    const row = document.createElement("tr");
    row.innerHTML = `
    <td>${epoch}</td>
    <td>${accuracy}%</td>
    <td>${precision}%</td>
    <td>${recall}%</td>
    <td>${f1}%</td>
    <td>${loss}</td>
  `;
    tableBody.appendChild(row);

    // TAMBAHKAN: Return hasil sebagai object
    const roc_auc = estimateTrainRocAucPercent(
      parseFloat(accuracy),
      parseFloat(precision),
      parseFloat(recall),
      parseFloat(f1),
      null,
    );
    return {
      epoch,
      accuracy: parseFloat(accuracy),
      precision: parseFloat(precision),
      recall: parseFloat(recall),
      f1: parseFloat(f1),
      loss: parseFloat(loss),
      roc_auc,
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
        if (Number.isFinite(Number(r.mcc))) {
          acc.mcc += Number(r.mcc);
          acc.mccCount += 1;
        }
        if (Number.isFinite(Number(r.roc_auc))) {
          acc.roc_auc += Number(r.roc_auc);
          acc.rocCount += 1;
        }
        return acc;
      },
      {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        loss: 0,
        mcc: 0,
        mccCount: 0,
        roc_auc: 0,
        rocCount: 0,
      },
    );

    // Hitung rata-rata
    const avg = {
      accuracy: sum.accuracy / count,
      precision: sum.precision / count,
      recall: sum.recall / count,
      f1: sum.f1 / count,
      loss: sum.loss / count,
    };
    if (sum.mccCount > 0) {
      avg.mcc = sum.mcc / sum.mccCount;
    }
    if (sum.rocCount > 0) {
      avg.roc_auc = sum.roc_auc / sum.rocCount;
    }
    const stdDev = computeEpochF1StdDev(epochResults);
    if (stdDev != null && Number.isFinite(stdDev)) {
      avg.std_deviation = stdDev;
    }

    // Tampilkan baris average
    avgRow.style.display = "table-footer-group";
    card.querySelector(".avg-accuracy").innerText =
      avg.accuracy.toFixed(2) + "%";
    card.querySelector(".avg-precision").innerText =
      avg.precision.toFixed(2) + "%";
    card.querySelector(".avg-recall").innerText = avg.recall.toFixed(2) + "%";
    card.querySelector(".avg-f1").innerText = avg.f1.toFixed(2) + "%";
    card.querySelector(".avg-loss").innerText = avg.loss.toFixed(4);

    return avg;
  }

  function finishTrainingInCard(card, mode, params, epochResults) {
    const progressBar = card.querySelector(".progress-bar");
    const progressText = card.querySelector(".progress-text");
    const btnGunakanTerbaik = card.querySelector(".btn-gunakan-terbaik-card");
    const btnSimpan = card.querySelector(".btn-simpan-card");
    const bestParamsDisplay = card.querySelector(".best-params-display");

    progressBar.style.width = "100%";
    progressBar.classList.remove("running");
    progressText.innerText = "100% — Completed";
    setProcessingStep(card, "finish");
    stopProcessingElapsed(card);
    appendProgressLog(
      card,
      `Summary completed. Total recorded epochs: ${epochResults.length}`,
      "success",
    );

    // Tampilkan tombol simpan
    if (btnSimpan) {
      btnSimpan.style.display = "inline-block";
    }

    // Hitung dan tampilkan average
    const avgData = calculateAndDisplayAverage(card, epochResults);
    if (avgData) {
      card.dataset.avgMetrics = JSON.stringify(avgData);
    }
    if (isFinalTrainingMode(mode)) {
      card.dataset.epochResults = JSON.stringify(epochResults || []);
    } else {
      delete card.dataset.epochResults;
    }

    // Simpan ke comparison data (untuk tabel perbandingan rasio)
    if (avgData && params.splitRatio) {
      const existingRatioMetrics = ratioComparisonData[params.splitRatio];
      const existingScore = ratioBestScore(existingRatioMetrics);
      const incomingScore = ratioBestScore(avgData);
      // Untuk rasio yang sama, simpan hanya hasil tertinggi berdasarkan (accuracy+f1)/2.
      if (!existingRatioMetrics || incomingScore >= existingScore) {
        ratioComparisonData[params.splitRatio] = avgData;
      }
      renderRatioComparisonTable();
    }

    // 🔧 TAMBAHAN: Simpan ke history jika mode training-final
    if (mode === "training-final") {
      const trainingName =
        document.getElementById("training-name")?.value ||
        `Training_${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;
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
        algo: params.algo || currentAlgo,
        rasio: splitRatio,
        dataset:
          localStorage.getItem(STORAGE_SELECTED_DATASET_NAME) || "",
        keterangan: trainingDesc,
        parameter: {
          algo: params.algo || currentAlgo,
          lr: params.lr,
          epoch: params.epoch,
          batchSize: params.batchSize,
          maxLength: params.maxLength,
          seed: params.seed,
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
          mcc: Number.isFinite(Number(r.mcc)) ? Number(r.mcc) : null,
          roc_auc: r.roc_auc != null ? r.roc_auc : null,
          confusion_matrix: r.confusion_matrix || null,
          confusion_labels: r.confusion_labels || null,
        })),
      };

      void saveTrainingHistory(historyEntry);
      showToast("Training was saved to history.", "success");
    }

    if (mode === "training-final") {
      // Auto-save final training ke database, dan boleh fallback local.
      saveModelFromCard(card, {
        silent: true,
        auto: true,
        allowLocalFallback: true,
        epochResults: epochResults,
      });
    } else if (mode === "cari-rasio") {
      // Cari rasio tetap disimpan ke database, tanpa fallback ke local saved_models.
      saveModelFromCard(card, {
        silent: true,
        auto: true,
        allowLocalFallback: false,
      });
    }

    if (mode === "cari-rasio") {
      // Tampilkan parameter terbaik
      const bestParamsContent = bestParamsDisplay?.querySelector(
        ".best-params-content",
      );
      const rows = card.querySelectorAll(".results-table tbody tr");
      let bestScore = 0;
      let bestRow = null;

      rows.forEach((row) => {
        const accVal = parseFloat(row.cells[1]?.innerText) || 0;
        const f1Val = parseFloat(row.cells[4]?.innerText) || 0;
        const score = (accVal + f1Val) / 2;
        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
        }
      });

      if (bestRow) {
        bestRow.classList.add("best-row");
      }

      if (bestParamsContent) {
        bestParamsContent.innerHTML = `
        <p><strong>Split Ratio:</strong> ${params.splitRatio}</p>
        <p><strong>Learning Rate:</strong> ${params.lr}</p>
        <p><strong>Epoch:</strong> ${params.epoch}</p>
        <p><strong>Batch Size:</strong> ${params.batchSize}</p>
        <p>${formatTransformerInputSnippet(params)}</p>
        <p><strong>Best Score (Accuracy + F1):</strong> ${bestScore.toFixed(2)}%</p>
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

      // Update global best params jika skor (accuracy+f1)/2 lebih tinggi
      const incomingScore = ratioBestScore(avgData);
      if (
        !globalBestParams ||
        (avgData && incomingScore > (globalBestParams.avgScore || 0))
      ) {
        globalBestParams = {
          ...params,
          avgScore: incomingScore,
          avgAccuracy: avgData.accuracy,
        };

        renderGlobalBestParamsDisplay();
      }

      persistRatioSearchContextState();

      showToast(
        "Find Best Ratio completed. Click 'Use Best Model' on the card you want to use for training with the best ratio.",
        "success",
      );
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
      showToast("No parameters were saved.");
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
    persistRatioSearchContextState();

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
    applyModeSpecificVisibility();

    const modelSelect = document.getElementById("model-select");
    const modelCard = document.getElementById("model-card");
    const newModelNameCard = document.getElementById("new-model-name-card");
    if (modelSelect) modelSelect.value = "";
    if (modelCard) modelCard.style.display = "none";
    if (newModelNameCard) newModelNameCard.style.display = "none";
    modelNameSaved = false;

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
        <p><strong>Split Ratio:</strong> ${params.splitRatio}</p>
        <p><strong>Learning Rate:</strong> ${params.lr}</p>
        <p><strong>Epoch:</strong> ${params.epoch}</p>
        <p><strong>Batch Size:</strong> ${params.batchSize}</p>
        <p>${formatTransformerInputSnippet(params)}</p>
        <p><strong>Optimizer:</strong> ${params.optimizer || "-"}</p>
      `;
      }
      // Jangan tampilkan best params display
      // document.getElementById('best-params-display').style.display = 'block';

      showToast(
        `The best model from ratio ${params.splitRatio} was applied. Proceeding to training using the best ratio.`,
        "success",
      );

      // Scroll ke parameter card
      document.getElementById("param-card-training-final").scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      refreshAdminPageAOS();
    });
  }

  /** Optional `models` columns — stripped automatically when Supabase schema lacks them. */
  const MODELS_OPTIONAL_INSERT_COLUMNS = [
    "macro_avg",
    "train_weighted_avg",
    "train_std_deviation",
    "std_deviation",
    "train_roc_auc",
    "train_loss",
    "train_mcc",
    "k_fold",
    "optimizer",
    "weight_decay",
    "scheduler",
    "warmup_ratio",
    "dropout",
    "early_stopping",
    "gradient_accumulation",
    "max_length",
    "seed",
  ];

  function parseSupabaseMissingColumn(error) {
    if (!error) return null;
    const msg = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" ");
    let m = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
    if (m) return m[1];
    m = msg.match(/column ["']?([^"'\s]+)["']? (?:of relation|does not exist)/i);
    if (m) return m[1];
    if (/roc[\s_-]?auc/i.test(msg) && !/train_roc_auc/i.test(msg)) {
      return "train_roc_auc";
    }
    return null;
  }

  function isXlmAlgoKey(value) {
    return normalizeStoredAlgorithmSelection(value) === "xlm-r";
  }

  async function supabaseModelExists(namaModel) {
    if (!supabaseClient || !namaModel) return false;
    const { data, error } = await supabaseClient
      .from("models")
      .select("id")
      .eq("nama_model", namaModel)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  }

  /** Push XLM-R dari saved_models + training_history ke Supabase. */
  async function syncLocalSavedXlmModelsToSupabase(options = {}) {
    if (typeof window.kamusSyncXlmModelsToSupabase === "function") {
      return window.kamusSyncXlmModelsToSupabase(options);
    }
    if (!supabaseClient) return { synced: 0, remaining: 0 };
    const silent = options.silent !== false;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("saved_models") || "[]");
    } catch (e) {
      return { synced: 0, remaining: 0 };
    }
    if (!Array.isArray(saved) || !saved.length) {
      return { synced: 0, remaining: 0 };
    }

    const remaining = [];
    let synced = 0;
    for (const entry of saved) {
      if (!isXlmAlgoKey(entry?.algoritma)) {
        remaining.push(entry);
        continue;
      }
      const nama = String(entry?.nama_model || "").trim();
      const datasetId = Number(entry?.dataset_id);
      if (!nama || !Number.isFinite(datasetId) || datasetId <= 0) {
        remaining.push(entry);
        continue;
      }
      if (await supabaseModelExists(nama, "xlm-r")) {
        synced += 1;
        continue;
      }
      const row = buildModelsBaseInsertRow({
        ...entry,
        algoritma: "xlm-r",
        mode: entry.mode || "training-final",
        created_at: entry.created_at || new Date().toISOString(),
      });
      const insertResult = await insertModelsRowWithFallback(row);
      if (insertResult.ok) {
        synced += 1;
      } else {
        remaining.push(entry);
      }
    }

    localStorage.setItem("saved_models", JSON.stringify(remaining));
    if (synced && !silent) {
      showToast(
        synced === 1
          ? "1 XLM-R model was synced to Supabase."
          : synced + " XLM-R models were synced to Supabase.",
        "success",
      );
    }
    return { synced, remaining: remaining.length };
  }

  function buildModelsBaseInsertRow(modelData) {
    return {
      nama_model: modelData.nama_model,
      algoritma: normalizeStoredAlgorithmSelection(modelData.algoritma),
      mode: modelData.mode,
      dataset_id: modelData.dataset_id,
      split_ratio: modelData.split_ratio,
      learning_rate: modelData.learning_rate,
      epoch: modelData.epoch,
      batch_size: modelData.batch_size,
      accuracy: modelData.accuracy,
      precision: modelData.precision,
      recall: modelData.recall,
      f1_score: modelData.f1_score,
      created_at: modelData.created_at,
    };
  }

  async function insertModelsRowWithFallback(payload) {
    let row = { ...payload };
    const dropped = [];
    for (let attempt = 0; attempt < 28; attempt++) {
      const { data, error } = await supabaseClient
        .from("models")
        .insert([row])
        .select("id");
      if (!error) {
        return {
          ok: true,
          id: Array.isArray(data) && data[0] ? data[0].id : null,
          dropped,
        };
      }
      const missing = parseSupabaseMissingColumn(error);
      if (missing && Object.prototype.hasOwnProperty.call(row, missing)) {
        delete row[missing];
        dropped.push(missing);
        continue;
      }
      const schemaLike = /schema cache|PGRST204|column/i.test(
        String(error.message || ""),
      );
      if (schemaLike) {
        const next = MODELS_OPTIONAL_INSERT_COLUMNS.find(
          (col) =>
            Object.prototype.hasOwnProperty.call(row, col) &&
            !dropped.includes(col),
        );
        if (next) {
          delete row[next];
          dropped.push(next);
          continue;
        }
      }
      return { ok: false, error, dropped, lastRow: row };
    }
    return {
      ok: false,
      error: { message: "Too many schema fallback attempts" },
      dropped,
    };
  }

  async function insertModelEpochMetricsWithFallback(payloads) {
    if (!payloads || payloads.length === 0) return { ok: true };
    if (!supabaseClient) return { ok: false, error: { message: "No Supabase client" } };
    try {
      const { error } = await supabaseClient
        .from("model_epoch_metrics")
        .insert(payloads);
      if (!error) return { ok: true };
      return { ok: false, error };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function shouldNotifyModelSave(opts, kind) {
    if (kind === "error") return !opts.silent || opts.auto;
    return !opts.silent || opts.auto;
  }

  async function saveModelFromCard(card, options = {}) {
    const opts = {
      silent: false,
      auto: false,
      allowLocalFallback: true,
      ...options,
    };

    if (card?.dataset?.savedToModels === "1") {
      if (!opts.silent) showToast("Model already saved.");
      return;
    }

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

    const avgMetrics = (() => {
      try {
        return JSON.parse(card.dataset.avgMetrics || "null");
      } catch (err) {
        return null;
      }
    })();
    const readAvgCell = (selector, stripPercent = true) => {
      const el = card.querySelector(selector);
      if (!el) return null;
      let t = String(el.innerText || "").trim();
      if (!t || t === "-") return null;
      if (stripPercent) t = t.replace(/%/g, "");
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : null;
    };
    const computeAvgFromEpochRows = () => {
      const parsed = (() => {
        try {
          return JSON.parse(card.dataset.avgMetrics || "null");
        } catch (err) {
          return null;
        }
      })();
      if (parsed && Number.isFinite(Number(parsed.mcc))) {
        return parsed;
      }
      const tableBody = card.querySelector(".results-table tbody");
      if (!tableBody) return null;
      const rows = Array.from(tableBody.querySelectorAll("tr")).filter((row) => {
        const epochLabel = String(row.cells?.[0]?.innerText || "")
          .trim()
          .toLowerCase();
        return epochLabel && epochLabel !== "average";
      });
      if (!rows.length) return null;
      const sum = rows.reduce(
        (acc, row) => {
          acc.accuracy += parseFloat(row.cells?.[1]?.innerText) || 0;
          acc.precision += parseFloat(row.cells?.[2]?.innerText) || 0;
          acc.recall += parseFloat(row.cells?.[3]?.innerText) || 0;
          acc.f1 += parseFloat(row.cells?.[4]?.innerText) || 0;
          acc.loss += parseFloat(row.cells?.[5]?.innerText) || 0;
          return acc;
        },
        { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0 },
      );
      const n = rows.length;
      return {
        accuracy: sum.accuracy / n,
        precision: sum.precision / n,
        recall: sum.recall / n,
        f1: sum.f1 / n,
        loss: sum.loss / n,
      };
    };
    let accuracy = 0,
      precision = 0,
      recall = 0,
      f1 = 0;
    let trainLoss = null;
    let trainMcc = null;

    const resolvedAvg =
      avgMetrics ||
      (() => {
        const fromFooter = {
          accuracy: readAvgCell(".avg-accuracy"),
          precision: readAvgCell(".avg-precision"),
          recall: readAvgCell(".avg-recall"),
          f1: readAvgCell(".avg-f1"),
          loss: readAvgCell(".avg-loss", false),
        };
        if (fromFooter.accuracy != null) return fromFooter;
        return computeAvgFromEpochRows();
      })();

    if (resolvedAvg) {
      accuracy = Number(resolvedAvg.accuracy) || 0;
      precision = Number(resolvedAvg.precision) || 0;
      recall = Number(resolvedAvg.recall) || 0;
      f1 = Number(resolvedAvg.f1) || 0;
      if (resolvedAvg.loss != null && Number.isFinite(Number(resolvedAvg.loss))) {
        trainLoss = Number(resolvedAvg.loss);
      }
      if (resolvedAvg.mcc != null && Number.isFinite(Number(resolvedAvg.mcc))) {
        trainMcc = Number(resolvedAvg.mcc);
      }
    }

    let epochResultsForStd = Array.isArray(opts.epochResults)
      ? opts.epochResults
      : [];
    if (!epochResultsForStd.length) {
      try {
        const parsed = JSON.parse(card.dataset.epochResults || "[]");
        if (Array.isArray(parsed)) epochResultsForStd = parsed;
      } catch (err) {
        epochResultsForStd = [];
      }
    }
    let epochF1Std = computeEpochF1StdDev(epochResultsForStd);
    if (epochF1Std == null && resolvedAvg?.std_deviation != null) {
      epochF1Std = Number(resolvedAvg.std_deviation);
    }
    if (epochF1Std == null) {
      epochF1Std = epochF1StdFromCardTable(card);
    }

    const macroAvg =
      precision || recall || f1 ? (precision + recall + f1) / 3 : null;
    const trainWeightedAvg = f1 || null;
    const trainRocAuc = (() => {
      if (resolvedAvg && Number.isFinite(Number(resolvedAvg.roc_auc))) {
        return Number(resolvedAvg.roc_auc);
      }
      return estimateTrainRocAucPercent(
        accuracy,
        precision,
        recall,
        f1,
        trainMcc,
      );
    })();

    const warmupRatioParsed = (() => {
      const w = params.warmup;
      if (w === undefined || w === null || String(w).trim() === "") return null;
      const n = parseFloat(String(w).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    })();

    const maxLengthToSave = (() => {
      const ml = parseInt(params.maxLength || 64, 10);
      return Number.isFinite(ml) ? ml : 64;
    })();

    const modelData = {
      nama_model: modelName,
      algoritma: normalizeStoredAlgorithmSelection(params.algo || currentAlgo),
      mode: card.dataset.mode || "training-final",
      dataset_id: selectedDatasetId,
      split_ratio: params.splitRatio,
      k_fold: params.kFold || null,
      learning_rate: (() => {
        const v = parseFloat(params.lr);
        return Number.isFinite(v) ? v : null;
      })(),
      epoch: (() => {
        const v = parseInt(params.epoch || 0, 10);
        return Number.isFinite(v) && v > 0 ? v : null;
      })(),
      batch_size: (() => {
        const v = parseInt(params.batchSize || 0, 10);
        return Number.isFinite(v) && v > 0 ? v : null;
      })(),
      max_length: maxLengthToSave,
      seed: (() => {
        const v = parseInt(params.seed || "", 10);
        return Number.isFinite(v) && v > 0 ? v : null;
      })(),
      optimizer: params.optimizer || null,
      weight_decay: params.weightDecay || null,
      scheduler: params.scheduler || null,
      warmup_ratio: warmupRatioParsed,
      dropout: params.dropout || null,
      early_stopping: params.earlyStopping || null,
      gradient_accumulation: params.gradAccum || null,
      // Semua metrik training disimpan sebagai rata-rata seluruh epoch.
      accuracy: accuracy,
      precision: precision,
      recall: recall,
      f1_score: f1,
      macro_avg: macroAvg,
      train_weighted_avg: trainWeightedAvg,
      train_std_deviation: epochF1Std,
      std_deviation: epochF1Std,
      train_roc_auc: trainRocAuc,
      train_loss: trainLoss,
      train_mcc: trainMcc,
      created_at: new Date().toISOString(),
    };

    if (supabaseClient) {
      let insertResult = await insertModelsRowWithFallback(modelData);
      if (!insertResult.ok) {
        insertResult = await insertModelsRowWithFallback(
          buildModelsBaseInsertRow(modelData),
        );
      }
      if (!insertResult.ok && isXlmAlgoKey(modelData.algoritma)) {
        insertResult = await insertModelsRowWithFallback(
          buildModelsBaseInsertRow({
            ...modelData,
            algoritma: "xlm-r",
            mode: modelData.mode || "training-final",
          }),
        );
      }
      if (insertResult.ok) {
        card.dataset.savedToModels = "1";

        const saveMode = card.dataset.mode || modelData.mode || "training-final";
        let epochResultsArr = Array.isArray(opts.epochResults)
          ? opts.epochResults
          : [];
        if (!epochResultsArr.length && isFinalTrainingMode(saveMode)) {
          const epochResultsStr = card.dataset.epochResults;
          if (epochResultsStr) {
            try {
              const parsed = JSON.parse(epochResultsStr);
              if (Array.isArray(parsed)) epochResultsArr = parsed;
            } catch (parseErr) {
              console.warn("Invalid card.dataset.epochResults JSON", parseErr);
            }
          }
        }
        if (
          insertResult.id &&
          isFinalTrainingMode(saveMode) &&
          epochResultsArr.length > 0
        ) {
          const metricsRows = epochResultsArr.map((r) => ({
            model_id: insertResult.id,
            epoch: r.epoch,
            accuracy: r.accuracy,
            precision: r.precision,
            recall: r.recall,
            f1_score: r.f1,
            loss: r.loss,
            roc_auc: r.roc_auc,
            mcc: r.mcc,
            confusion_matrix: r.confusion_matrix,
            confusion_labels: r.confusion_labels,
            created_at: new Date().toISOString(),
          }));
          const epochSave = await insertModelEpochMetricsWithFallback(metricsRows);
          if (!epochSave.ok) {
            console.warn("model_epoch_metrics insert failed:", epochSave.error);
          }
        }

        if (shouldNotifyModelSave(opts, "success")) {
          const dropped = insertResult.dropped || [];
          if (dropped.length) {
            showToast(
              `Model saved to database (some optional columns omitted: ${dropped.join(", ")}). Run supabase/models_testing_columns.sql for full training metrics.`,
              "warning",
            );
          } else {
            showToast("Model was saved to the database.", "success");
          }
        }
      } else {
        console.error("Supabase insert(models) failed:", insertResult.error);
        if (opts.allowLocalFallback) {
          saveToLocalStorage(modelData);
          card.dataset.savedToModels = "local";
          if (isXlmAlgoKey(modelData.algoritma)) {
            const syncRes = await syncLocalSavedXlmModelsToSupabase({
              silent: true,
            });
            if (syncRes.synced > 0) {
              card.dataset.savedToModels = "1";
              if (shouldNotifyModelSave(opts, "success")) {
                showToast("XLM-R model was saved to the database.", "success");
              }
            } else if (shouldNotifyModelSave(opts, "success")) {
              showToast(
                "Training checkpoint is on the server; registry saved locally only. Open Processing (XLM-R) to retry Supabase sync, or click Save.",
                "warning",
              );
            }
          } else if (shouldNotifyModelSave(opts, "success")) {
            showToast(
              "Training checkpoint is on the server; registry saved locally only. Run supabase/models_testing_columns.sql then save again, or use the Save button.",
              "warning",
            );
          }
        } else if (shouldNotifyModelSave(opts, "error")) {
          showToast(
            `Failed to save model to database: ${insertResult.error?.message || "unknown error"}`,
            "error",
          );
        }
      }
    } else {
      if (opts.allowLocalFallback) {
        if (!opts.silent) showToast("Model was saved successfully.");
        saveToLocalStorage(modelData);
      } else if (!opts.silent) {
        showToast("Supabase is unavailable. Model was not saved locally.", "error");
      }
    }

    console.log("Model saved:", modelData);
  }

  function saveModel() {
    showToast("Please use the Save button on the training card.");
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
  let currentTrainingHistory = [];

  async function loadTrainingHistory() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("training_logs")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        currentTrainingHistory = (data || []).map((row) => {
          const params = normalizeParameterViewForDisplay(row.params || {}, {
            algo: row.algo,
          });
          return {
            id: row.id,
            training_name: row.name,
            model_name: params.model_name || "",
            algo: row.algo || params.algo || "",
            tanggal: row.date,
            rasio: row.ratio,
            dataset: row.dataset,
            parameter: params,
            hasil: row.hasil || [],
          };
        });
        return currentTrainingHistory;
      } catch (e) {
        console.error(
          "Failed to load training logs from Supabase, falling back to localStorage",
          e,
        );
      }
    }

    const saved = localStorage.getItem(HISTORY_KEY);
    currentTrainingHistory = saved ? JSON.parse(saved) : [];
    return currentTrainingHistory;
  }

  async function saveTrainingHistory(historyData) {
    currentTrainingHistory.push(historyData);
    _renderHistoryTableUI(currentTrainingHistory);

    if (supabaseClient) {
      try {
        const payload = {
          name:
            historyData.training_name ||
            historyData.nama_model ||
            "Untitled Training",
          algo:
            historyData.algo ||
            (historyData.parameter ? historyData.parameter.algo : ""),
          date: historyData.tanggal || new Date().toISOString(),
          ratio: historyData.rasio || "",
          dataset: historyData.dataset || "",
          params: {
            ...(historyData.parameter || {}),
            model_name:
              historyData.model_name ||
              historyData.nama_model ||
              "",
            training_name: historyData.training_name || "",
            algo:
              historyData.algo ||
              (historyData.parameter ? historyData.parameter.algo : ""),
          },
          hasil: historyData.hasil || [],
        };
        const { error } = await supabaseClient
          .from("training_logs")
          .insert([payload]);
        if (error) throw error;
        return;
      } catch (e) {
        console.error(
          "Failed to save training log to Supabase, falling back to localStorage",
          e,
        );
      }
    }

    const saved = localStorage.getItem(HISTORY_KEY);
    const history = saved ? JSON.parse(saved) : [];
    history.push(historyData);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    currentTrainingHistory = history;
  }

  function _renderHistoryTableUI(history) {
    const tbody = document.getElementById("history-body");
    if (!tbody) return;

    if (history.length === 0) {
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="4" style="text-align:center; color:#999; padding: 20px;">No training history yet</td></tr>';
      return;
    }

    const sorted = [...history].reverse();

    tbody.innerHTML = sorted
      .map((item, index) => {
        const originalIndex = history.length - 1 - index;
        const date = new Date(item.tanggal).toLocaleString("en-US", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const displayName =
          item.training_name || item.nama_model || "Untitled Training";
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

  async function renderHistoryTable() {
    const tbody = document.getElementById("history-body");
    if (!tbody) return;

    if (currentTrainingHistory.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; color:#666; padding: 20px;">Loading data from database...</td></tr>';
    }

    const history = await loadTrainingHistory();
    _renderHistoryTableUI(history);
  }

  function buildLayeredParameterHtmlForDetail(p = {}) {
    const algo = String(p.algo || "").toLowerCase();
    const algoKey = normalizeAlgoKey(algo);
    const v = (x) => (x === undefined || x === null || x === "" ? "-" : String(x));
    const item = (label, value) => `<span><strong>${label}:</strong> ${v(value)}</span>`;

    const inputReprLabel =
      algoKey === "xlm-r"
        ? "SentencePiece tokens (XLM-RoBERTa)"
        : isTransformerAlgoKey(algoKey)
          ? "WordPiece Tokens + [CLS]/[SEP]"
          : "Word Embedding";
    const inputItems = [
      item("Batch Size", resolveParamDisplay(p, "batchSize", "batch_size")),
    ];
    if (isTransformerAlgoKey(algoKey)) {
      inputItems.push(item("Max Length", resolveMaxLengthDisplay(p)));
      inputItems.push(item("Seed", p.seed));
    }
    inputItems.push(item("Input Representation", inputReprLabel));
    const inputLayer = `
      <div class="layer-block">
        <h5 class="layer-title">1. Input Layer</h5>
        <div class="layer-grid">
          ${inputItems.join("")}
        </div>
      </div>
    `;

    const hiddenItems = [
      item("Learning Rate", p.lr),
      item("Epoch", p.epoch),
      item("Optimizer", p.optimizer),
      item("Weight Decay", p.weightDecay),
      item("Scheduler", p.scheduler),
      item("Dropout", p.dropout),
    ];

    if (isTransformerAlgoKey(algoKey)) {
      hiddenItems.push(item("Warmup", p.warmup));
      hiddenItems.push(
        item(
          "Gradient Accumulation",
          resolveParamDisplay(p, "gradAccum", "gradient_accumulation"),
        ),
      );
    } else if (algo === "word2vec") {
      hiddenItems.push(item("Vector Size", p.vectorSize));
      hiddenItems.push(item("Window Size", p.windowSize));
      hiddenItems.push(item("Min Count", p.minCount));
      hiddenItems.push(item("Model Type", p.modelType));
      hiddenItems.push(item("Negative", p.negative));
    } else if (algo === "glove") {
      hiddenItems.push(item("Vector Size", p.vectorSize));
      hiddenItems.push(item("Window Size", p.windowSize));
      hiddenItems.push(item("Min Count", p.minCount));
      hiddenItems.push(item("X Max", p.xMax));
      hiddenItems.push(item("Alpha", p.alpha));
    }

    const hiddenLayer = `
      <div class="layer-block">
        <h5 class="layer-title">2. Hidden Layer</h5>
        <div class="layer-grid">
          ${hiddenItems.join("")}
        </div>
      </div>
    `;

    const outputLayer = `
      <div class="layer-block">
        <h5 class="layer-title">3. Output Layer</h5>
        <div class="layer-grid">
          ${item("Output Activation", "Softmax")}
          ${item("Loss Function", "Cross Entropy")}
          ${item("Early Stopping", p.earlyStopping === "0" ? "Disabled" : p.earlyStopping)}
        </div>
      </div>
    `;

    return inputLayer + hiddenLayer + outputLayer;
  }

  function toEnglishConfusionLabel(raw) {
    const v = String(raw ?? "").trim();
    const key = v.toLowerCase();
    const map = {
      ajakan: "Invitation",
      larangan: "Prohibition",
      perintah: "Command",
      pertanyaan: "Question",
      sapaan: "Greeting",
      informasi: "Information",
      deklaratif: "Declarative",
      imperatif: "Imperative",
      interogatif: "Interrogative",
      pernyataan: "Statement",
    };
    return map[key] || v;
  }

  window.showHistoryDetailModal = function (index) {
    const history = currentTrainingHistory;
    const data = history[index];
    if (!data) {
      showToast("History data was not found.", "error");
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
      dateEl.innerText = new Date(data.tanggal).toLocaleString("en-US", {
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

    const paramView = normalizeParameterViewForDisplay(data.parameter || {}, {
      algo: data.parameter?.algo || data.algo,
    });

    // 🔧 Isi parameter
    const paramsDiv = document.getElementById("detail-params");
    if (paramsDiv) {
      if (data.parameter || paramView.algo) {
        paramsDiv.innerHTML = buildLayeredParameterHtmlForDetail(paramView);
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

      // 🔧 Cari epoch dengan Accuracy tertinggi (untuk confusion matrix)
      let bestAcc = -Infinity;
      let bestEpoch = -1;
      results.forEach((r) => {
        const acc = Number(r.accuracy ?? -Infinity);
        if (acc > bestAcc) {
          bestAcc = acc;
          bestEpoch = r.epoch;
        }
      });

      // 🔧 Render rows
      tbody.innerHTML = results
        .map((r) => {
          const isBest = r.epoch === bestEpoch;
          const f1Val = r.f1 != null ? r.f1 : r.f1_score;
          return `
        <tr class="${isBest ? "best-row" : ""}" style="${isBest ? "background: rgba(200,169,110,0.3); font-weight: 600;" : ""}">
          <td>${isBest ? "Best " : ""}${r.epoch}</td>
          <td>${Number(r.accuracy).toFixed(2)}%</td>
          <td>${Number(r.precision).toFixed(2)}%</td>
          <td>${Number(r.recall).toFixed(2)}%</td>
          <td>${Number(f1Val).toFixed(2)}%</td>
          <td>${Number(r.loss).toFixed(4)}</td>
        </tr>
      `;
        })
        .join("");

      // 🔧 Hitung average
      const count = results.length;
      const sum = results.reduce(
        (acc, r) => {
          const f1Val = r.f1 != null ? r.f1 : r.f1_score;
          acc.accuracy += Number(r.accuracy) || 0;
          acc.precision += Number(r.precision) || 0;
          acc.recall += Number(r.recall) || 0;
          acc.f1 += Number(f1Val) || 0;
          acc.loss += Number(r.loss) || 0;
          return acc;
        },
        { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0 },
      );

      avgFoot.innerHTML = `
      <tr>
        <td><strong>Average</strong></td>
        <td>${(sum.accuracy / count).toFixed(2)}%</td>
        <td>${(sum.precision / count).toFixed(2)}%</td>
        <td>${(sum.recall / count).toFixed(2)}%</td>
        <td>${(sum.f1 / count).toFixed(2)}%</td>
        <td>${(sum.loss / count).toFixed(4)}</td>
      </tr>
    `;

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

          const labelsEn = labels.map((l) => toEnglishConfusionLabel(l));
          const header =
            `<tr><th>Actual \\ Predicted</th>` +
            labelsEn.map((l) => `<th>${l}</th>`).join("") +
            `</tr>`;

          const body = cm
            .slice(0, size)
            .map((row, i) => {
              const cells = labelsEn
                .slice(0, size)
                .map((_, j) => {
                  const v = row?.[j] ?? 0;
                  const cls = i === j ? "diag" : "";
                  return `<td class="${cls}">${v}</td>`;
                })
                .join("");
              return `<tr><th>${labelsEn[i]}</th>${cells}</tr>`;
            })
            .join("");

          confusionTable.innerHTML = header + body;
        } else {
          confusionSection.style.display = "none";
          confusionEmpty.style.display = "block";
          confusionTable.innerHTML = "";
        }
      }
    } else {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:#999;">Result data not available</td></tr>';
      avgFoot.innerHTML = "";

      const confusionSection = document.getElementById(
        "history-confusion-section",
      );
      if (confusionSection) confusionSection.style.display = "none";
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

  document.addEventListener("DOMContentLoaded", function () {
    void renderHistoryTable();
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.style.display = "none";
      }
    });
  });
})();
