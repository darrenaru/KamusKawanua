/**
 * Shared Excel export (ExcelJS). Uniform layout across Evaluasi, Processing, etc.
 * - Metadata sheet: key | value (2 columns)
 * - Table sheets: title (row 1), blank (row 2), header + data (from row 3)
 * - Conclusion: title + one paragraph per row in column A
 * - Charts: title + embedded PNG images
 */
(function (global) {
  const CDNS = [
    "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js",
  ];

  const STYLE = {
    titleFont: { bold: true, size: 12, color: { argb: "FF1A1714" } },
    headerFont: { bold: true, size: 10, color: { argb: "FF1A1714" } },
    headerFill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0EDE8" },
    },
    metaLabelFont: { bold: true, size: 10, color: { argb: "FF6B5E50" } },
    chartTitleFont: { bold: true, size: 11, color: { argb: "FF2C1F0E" } },
  };

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var excelLoadPromise = null;
  function ensureExcelJs() {
    if (global.ExcelJS) return Promise.resolve(global.ExcelJS);
    if (excelLoadPromise) return excelLoadPromise;
    excelLoadPromise = (async function () {
      for (var i = 0; i < CDNS.length; i++) {
        try {
          await loadScript(CDNS[i]);
          if (global.ExcelJS) return global.ExcelJS;
        } catch (e) {}
      }
      throw new Error("ExcelJS could not be loaded (check network/CDN).");
    })();
    return excelLoadPromise;
  }

  function safeSheetName(name) {
    var s = String(name || "Sheet").replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
    return s || "Sheet";
  }

  function sanitizeFilename(name) {
    return String(name || "export")
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 120);
  }

  function cellText(el) {
    if (!el) return "";
    return String(el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPlaceholderRow(cells) {
    if (!cells || !cells.length) return true;
    if (cells.length === 1) {
      var t = String(cells[0] || "").toLowerCase();
      if (!t || t === "—" || t === "-") return true;
      if (/^no\s+.+\s+available\.?$/i.test(t)) return true;
      if (/^no\s+.+\s+yet\.?$/i.test(t)) return true;
    }
    return false;
  }

  function cleanMatrix(matrix, opts) {
    if (!matrix || !matrix.length) return [];
    var out = [];
    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i].map(function (c) {
        return String(c == null ? "" : c).replace(/\s+/g, " ").trim();
      });
      if (opts && opts.skipEmptyRows && isPlaceholderRow(row)) continue;
      if (row.every(function (c) { return !c; })) continue;
      out.push(row);
    }
    return out;
  }

  function uppercaseHeaderRows(matrix, count) {
    var n = Math.min(count || 1, matrix.length);
    for (var i = 0; i < n; i++) {
      matrix[i] = matrix[i].map(function (h) {
        return String(h || "").toUpperCase();
      });
    }
    return matrix;
  }

  /**
   * @param {HTMLTableElement} tableEl
   * @param {{ skipColumnsFromEnd?: number, skipEmptyRows?: boolean, uppercaseHeader?: boolean }} opts
   */
  function matrixFromHtmlTable(tableEl, opts) {
    if (!tableEl) return [];
    var skip = (opts && opts.skipColumnsFromEnd) || 0;
    var matrix = [];
    var rows = tableEl.querySelectorAll("tr");
    for (var r = 0; r < rows.length; r++) {
      var tr = rows[r];
      if (tr.classList && tr.classList.contains("empty-row")) continue;
      var cells = tr.querySelectorAll("th, td");
      var end = cells.length - skip;
      if (end < 0) end = 0;
      var line = [];
      for (var c = 0; c < end; c++) {
        line.push(cellText(cells[c]));
      }
      if (line.length) matrix.push(line);
    }
    matrix = cleanMatrix(matrix, { skipEmptyRows: opts && opts.skipEmptyRows !== false });
    var headerCount = 0;
    if (opts && opts.uppercaseHeaderRows != null) {
      headerCount = Number(opts.uppercaseHeaderRows) || 0;
    } else if (opts && opts.uppercaseHeader !== false) {
      headerCount = 1;
    }
    if (headerCount > 0 && matrix.length) {
      uppercaseHeaderRows(matrix, headerCount);
    }
    return matrix;
  }

  function applyMatrix(ws, matrix, startRow, styleOpts) {
    var sr = startRow || 1;
    if (!matrix || !matrix.length) return sr;
    var headerCount = (styleOpts && styleOpts.headerRowCount) || 0;
    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i];
      var isHeader = headerCount > 0 && i < headerCount;
      for (var j = 0; j < row.length; j++) {
        var cell = ws.getCell(sr + i, j + 1);
        cell.value = row[j];
        if (isHeader) {
          cell.font = Object.assign({}, STYLE.headerFont);
          cell.fill = Object.assign({}, STYLE.headerFill);
          cell.alignment = { vertical: "middle", horizontal: j === 0 ? "left" : "center" };
        }
      }
    }
    return sr + matrix.length;
  }

  function autosizeColumns(ws, maxCol, maxWidth) {
    maxWidth = maxWidth || 48;
    for (var col = 1; col <= maxCol; col++) {
      var w = 10;
      ws.eachRow({ includeEmpty: false }, function (row) {
        var cell = row.getCell(col);
        var v = cell.value;
        var len = v == null ? 0 : String(v).length;
        if (len > w) w = len;
      });
      ws.getColumn(col).width = Math.min(maxWidth, Math.max(10, w + 2));
    }
  }

  function writeMetadataSheet(ws, matrix) {
    var rows = cleanMatrix(matrix, { skipEmptyRows: false });
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i][0] != null ? rows[i][0] : "";
      var value = rows[i].length > 1 ? rows[i].slice(1).join(" ") : "";
      var lc = ws.getCell(i + 1, 1);
      var vc = ws.getCell(i + 1, 2);
      lc.value = label;
      vc.value = value;
      lc.font = Object.assign({}, STYLE.metaLabelFont);
      vc.alignment = { vertical: "middle", wrapText: true };
    }
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 42;
  }

  function writeTableSheet(ws, spec) {
    var rowPtr = 1;
    var maxCol = 0;

    if (spec.meta && spec.meta.length) {
      writeMetadataSheet(ws, spec.meta);
      rowPtr = spec.meta.length + 2;
    }

    if (spec.title) {
      ws.getCell(rowPtr, 1).value = spec.title;
      ws.getCell(rowPtr, 1).font = Object.assign({}, STYLE.titleFont);
      rowPtr += 2;
    }

    function writeMatrixBlock(blockMatrix, blockOpts) {
      var m = cleanMatrix(blockMatrix, { skipEmptyRows: true });
      if (!m.length) return rowPtr;
      var headerRowCount = 0;
      var opts = blockOpts || spec.tableOpts || {};
      if (opts.uppercaseHeaderRows != null) {
        headerRowCount = Number(opts.uppercaseHeaderRows) || 0;
      } else if (opts.uppercaseHeader !== false) {
        headerRowCount = 1;
      }
      applyMatrix(ws, m, rowPtr, { headerRowCount: headerRowCount });
      rowPtr += m.length + 1;
      for (var mi = 0; mi < m.length; mi++) {
        if (m[mi].length > maxCol) maxCol = m[mi].length;
      }
      return rowPtr;
    }

    var matrix = spec.matrix;
    if (!matrix && spec.table) {
      matrix = matrixFromHtmlTable(
        spec.table,
        Object.assign({ skipEmptyRows: true, uppercaseHeader: true }, spec.tableOpts || {}),
      );
    }
    if (matrix && matrix.length) {
      writeMatrixBlock(matrix, spec.tableOpts);
    }

    if (spec.sections && spec.sections.length) {
      for (var si = 0; si < spec.sections.length; si++) {
        var sec = spec.sections[si] || {};
        if (sec.title) {
          ws.getCell(rowPtr, 1).value = sec.title;
          ws.getCell(rowPtr, 1).font = Object.assign({}, STYLE.titleFont);
          rowPtr += 2;
        }
        if (sec.subtitle) {
          ws.getCell(rowPtr, 1).value = sec.subtitle;
          ws.getCell(rowPtr, 1).font = Object.assign({}, STYLE.metaLabelFont);
          rowPtr += 1;
        }
        writeMatrixBlock(sec.matrix, sec.tableOpts || spec.tableOpts);
      }
    }

    if (maxCol > 0) autosizeColumns(ws, maxCol);

    if (spec.images && spec.images.length) {
      if (!spec.title && rowPtr === 1) {
        ws.getCell(rowPtr, 1).value = spec.imagesTitle || "Charts";
        ws.getCell(rowPtr, 1).font = Object.assign({}, STYLE.titleFont);
        rowPtr += 2;
      }
      var imgRow = rowPtr - 1;
      for (var im = 0; im < spec.images.length; im++) {
        var item = spec.images[im];
        if (item.title) {
          var titleCell = ws.getCell(Math.floor(imgRow) + 1, 1);
          titleCell.value = item.title;
          titleCell.font = Object.assign({}, STYLE.chartTitleFont);
          imgRow += 1.2;
        }
        var raw = item.base64 || "";
        var b64 = raw.indexOf(",") >= 0 ? raw.split(",")[1] : raw;
        if (!b64) {
          ws.getCell(Math.floor(imgRow) + 1, 1).value = "(Image not available)";
          imgRow += 2;
          continue;
        }
        try {
          var wb = ws.workbook;
          var imgId = wb.addImage({ base64: b64, extension: "png" });
          var w = item.width || 520;
          var h = item.height || 320;
          ws.addImage(imgId, {
            tl: { col: 0.15, row: imgRow },
            ext: { width: w, height: h },
          });
          imgRow += h / 13.2 + 1.35;
        } catch (err) {
          ws.getCell(Math.floor(imgRow) + 1, 1).value = "(Could not embed chart image)";
          imgRow += 2;
        }
      }
    }

    return rowPtr;
  }

  /**
   * @param {string} filename
   * @param {object[]} sheets
   */
  async function exportWorkbook(filename, sheets) {
    var ExcelJS = await ensureExcelJs();
    var wb = new ExcelJS.Workbook();
    wb.creator = "Kamus Kawanua";
    wb.created = new Date();

    for (var s = 0; s < sheets.length; s++) {
      var spec = sheets[s] || {};
      var name = safeSheetName(spec.name);
      var ws = wb.addWorksheet(name);
      var layout = spec.layout || (spec.name === "Metadata" ? "metadata" : "table");

      if (layout === "metadata") {
        writeMetadataSheet(ws, spec.matrix || []);
        continue;
      }

      if (layout === "conclusion") {
        var rowPtr = 1;
        if (spec.title) {
          ws.getCell(rowPtr, 1).value = spec.title;
          ws.getCell(rowPtr, 1).font = Object.assign({}, STYLE.titleFont);
          rowPtr += 2;
        }
        var lines = cleanMatrix(spec.matrix || [], { skipEmptyRows: true });
        if (!lines.length) lines = [["(empty)"]];
        applyMatrix(ws, lines, rowPtr, {});
        ws.getColumn(1).width = 96;
        continue;
      }

      writeTableSheet(ws, spec);
    }

    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = sanitizeFilename(filename) + ".xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function canvasToPngBase64(canvasEl) {
    if (!canvasEl || typeof canvasEl.toDataURL !== "function") return "";
    try {
      return canvasEl.toDataURL("image/png");
    } catch (e) {
      return "";
    }
  }

  function defaultExportTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  }

  function resolveParamVal(p, camel, snake) {
    if (!p || typeof p !== "object") return undefined;
    var c = p[camel];
    if (c !== undefined && c !== null && c !== "") return c;
    if (snake && p[snake] !== undefined && p[snake] !== null && p[snake] !== "") {
      return p[snake];
    }
    return undefined;
  }

  function paramText(v) {
    return v === undefined || v === null || v === "" ? "-" : String(v);
  }

  function pickEpochF1(row) {
    if (!row) return NaN;
    if (row.f1 != null && row.f1 !== "") return Number(row.f1);
    if (row.f1_score != null && row.f1_score !== "") return Number(row.f1_score);
    return NaN;
  }

  function findBestEpochByAccuracy(results) {
    if (!results || !results.length) return { best: null, bestEpoch: -1, bestAcc: -Infinity };
    var best = null;
    var bestEpoch = -1;
    var bestAcc = -Infinity;
    for (var i = 0; i < results.length; i++) {
      var acc = Number(results[i].accuracy);
      if (Number.isFinite(acc) && acc > bestAcc) {
        bestAcc = acc;
        bestEpoch = results[i].epoch;
        best = results[i];
      }
    }
    return { best: best, bestEpoch: bestEpoch, bestAcc: bestAcc };
  }

  function formatMetricPercent(v, digits) {
    var n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits == null ? 2 : digits) + "%";
  }

  function formatMetricFloat(v, digits) {
    var n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits == null ? 4 : digits);
  }

  /**
   * @param {object[]} results
   * @returns {string[][]}
   */
  function buildEpochResultsMatrix(results) {
    if (!results || !results.length) {
      return [["EPOCH", "ACCURACY (%)", "PRECISION (%)", "RECALL (%)", "F1-SCORE (%)", "LOSS"], ["(no data)", "—", "—", "—", "—", "—"]];
    }
    var rows = [["EPOCH", "ACCURACY (%)", "PRECISION (%)", "RECALL (%)", "F1-SCORE (%)", "LOSS"]];
    var sum = { accuracy: 0, precision: 0, recall: 0, f1: 0, loss: 0 };
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var f1Val = pickEpochF1(r);
      rows.push([
        String(r.epoch == null ? i + 1 : r.epoch),
        formatMetricPercent(r.accuracy, 2),
        formatMetricPercent(r.precision, 2),
        formatMetricPercent(r.recall, 2),
        Number.isFinite(f1Val) ? f1Val.toFixed(2) + "%" : "—",
        formatMetricFloat(r.loss, 4),
      ]);
      sum.accuracy += Number(r.accuracy) || 0;
      sum.precision += Number(r.precision) || 0;
      sum.recall += Number(r.recall) || 0;
      sum.f1 += Number.isFinite(f1Val) ? f1Val : 0;
      sum.loss += Number(r.loss) || 0;
    }
    var count = results.length;
    rows.push([
      "Average",
      (sum.accuracy / count).toFixed(2) + "%",
      (sum.precision / count).toFixed(2) + "%",
      (sum.recall / count).toFixed(2) + "%",
      (sum.f1 / count).toFixed(2) + "%",
      (sum.loss / count).toFixed(4),
    ]);
    return rows;
  }

  /**
   * @param {function(string): string} [labelFn]
   */
  function buildConfusionMatrixFromResults(results, labelFn) {
    var pick = findBestEpochByAccuracy(results);
    var best = pick.best;
    if (!best) return null;
    var cm = best.confusion_matrix;
    var labels = best.confusion_labels;
    if (!cm || !labels || !Array.isArray(cm) || !Array.isArray(labels) || cm.length !== labels.length) {
      return null;
    }
    var mapLabel = typeof labelFn === "function" ? labelFn : function (x) { return String(x == null ? "" : x).trim(); };
    var labelsOut = labels.map(mapLabel);
    var header = ["Actual \\ Predicted"].concat(labelsOut);
    var body = [];
    for (var i = 0; i < labelsOut.length; i++) {
      var row = cm[i] || [];
      body.push([labelsOut[i]].concat(row.map(function (c) { return String(c == null ? 0 : c); })));
    }
    return {
      matrix: [header].concat(body),
      subtitle:
        "Best epoch: " +
        String(pick.bestEpoch) +
        " | Accuracy: " +
        formatMetricPercent(pick.bestAcc, 2),
    };
  }

  function buildTrainingLogParameterMeta(params, algoHint) {
    var p = params || {};
    var algo = String(p.algo || algoHint || "").toLowerCase();
    var rows = [
      ["Batch Size", paramText(resolveParamVal(p, "batchSize", "batch_size"))],
      ["Max Length", paramText(resolveParamVal(p, "maxLength", "max_length"))],
      ["Seed", paramText(p.seed)],
      ["Learning Rate", paramText(p.lr)],
      ["Epoch", paramText(p.epoch)],
      ["Optimizer", paramText(p.optimizer)],
      ["Weight Decay", paramText(resolveParamVal(p, "weightDecay", "weight_decay"))],
      ["Scheduler", paramText(p.scheduler)],
      ["Dropout", paramText(p.dropout)],
      ["Warmup", paramText(p.warmup || p.warmup_ratio)],
      [
        "Gradient Accumulation",
        paramText(resolveParamVal(p, "gradAccum", "gradient_accumulation")),
      ],
      ["Early Stopping", paramText(resolveParamVal(p, "earlyStopping", "early_stopping"))],
      ["Fast Mode", paramText(p.fast_mode)],
      ["Algorithm (params)", paramText(p.algo || algoHint)],
    ];
    if (algo === "word2vec") {
      rows.push(
        ["Vector Size", paramText(resolveParamVal(p, "vectorSize", "vector_size"))],
        ["Window Size", paramText(resolveParamVal(p, "windowSize", "window_size"))],
        ["Min Count", paramText(resolveParamVal(p, "minCount", "min_count"))],
        ["Model Type", paramText(resolveParamVal(p, "modelType", "model_type"))],
        ["Negative", paramText(p.negative)],
      );
    } else if (algo === "glove") {
      rows.push(
        ["Vector Size", paramText(resolveParamVal(p, "vectorSize", "vector_size"))],
        ["Window Size", paramText(resolveParamVal(p, "windowSize", "window_size"))],
        ["Min Count", paramText(resolveParamVal(p, "minCount", "min_count"))],
        ["X Max", paramText(resolveParamVal(p, "xMax", "x_max"))],
        ["Alpha", paramText(p.alpha)],
      );
    }
    return rows;
  }

  function buildTrainingLogSummaryMeta(log) {
    var item = log || {};
    var params = item.parameter || item.params || {};
    var dateRaw = item.tanggal || item.date || item.created_at;
    var dateText = "-";
    if (dateRaw) {
      try {
        dateText = new Date(dateRaw).toLocaleString("en-US");
      } catch (e) {
        dateText = String(dateRaw);
      }
    }
    return [
      ["Training name", paramText(item.training_name || item.name || item.nama_model)],
      ["Model name", paramText(item.model_name || params.model_name || item.nama_model)],
      ["Split ratio", paramText(item.rasio || item.ratio)],
      ["Dataset", paramText(item.dataset || params.dataset)],
      ["Date", dateText],
      ["Algorithm", paramText(item.algo || params.algo)],
      ["Description", paramText(item.keterangan || item.description)],
    ];
  }

  /**
   * Build one Excel sheet spec for a training log entry (epochs + parameters + confusion).
   */
  function buildTrainingLogDetailSheet(log, sheetName, labelFn) {
    var results = log && (log.hasil || log.results) ? log.hasil || log.results : [];
    var meta = buildTrainingLogSummaryMeta(log)
      .concat([["", ""]])
      .concat(buildTrainingLogParameterMeta(log.parameter || log.params || {}, log.algo));
    var sections = [
      {
        title: "Training results by epoch",
        matrix: buildEpochResultsMatrix(results),
        tableOpts: { uppercaseHeader: true },
      },
    ];
    var conf = buildConfusionMatrixFromResults(results, labelFn);
    if (conf && conf.matrix) {
      sections.push({
        title: "Confusion matrix (best accuracy epoch)",
        subtitle: conf.subtitle,
        matrix: conf.matrix,
        tableOpts: { uppercaseHeader: true },
      });
    } else {
      sections.push({
        title: "Confusion matrix (best accuracy epoch)",
        matrix: [["Confusion matrix was not available for this run."]],
        tableOpts: { uppercaseHeader: false },
      });
    }
    return {
      name: sheetName,
      meta: meta,
      sections: sections,
    };
  }

  global.KamusExcel = {
    ensureExcelJs: ensureExcelJs,
    matrixFromHtmlTable: matrixFromHtmlTable,
    cleanMatrix: cleanMatrix,
    exportWorkbook: exportWorkbook,
    canvasToPngBase64: canvasToPngBase64,
    sanitizeFilename: sanitizeFilename,
    defaultExportTimestamp: defaultExportTimestamp,
    buildEpochResultsMatrix: buildEpochResultsMatrix,
    buildConfusionMatrixFromResults: buildConfusionMatrixFromResults,
    buildTrainingLogParameterMeta: buildTrainingLogParameterMeta,
    buildTrainingLogSummaryMeta: buildTrainingLogSummaryMeta,
    buildTrainingLogDetailSheet: buildTrainingLogDetailSheet,
    findBestEpochByAccuracy: findBestEpochByAccuracy,
  };
})(typeof window !== "undefined" ? window : this);
