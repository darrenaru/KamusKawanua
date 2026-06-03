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

    var matrix = spec.matrix;
    if (!matrix && spec.table) {
      matrix = matrixFromHtmlTable(spec.table, Object.assign({ skipEmptyRows: true, uppercaseHeader: true }, spec.tableOpts || {}));
    }
    matrix = cleanMatrix(matrix, { skipEmptyRows: true });

    if (matrix.length) {
      var headerRowCount = 0;
      if (spec.tableOpts && spec.tableOpts.uppercaseHeaderRows != null) {
        headerRowCount = Number(spec.tableOpts.uppercaseHeaderRows) || 0;
      } else if (!spec.tableOpts || spec.tableOpts.uppercaseHeader !== false) {
        headerRowCount = 1;
      }
      applyMatrix(ws, matrix, rowPtr, { headerRowCount: headerRowCount });
      rowPtr += matrix.length + 1;
      for (var m = 0; m < matrix.length; m++) {
        if (matrix[m].length > maxCol) maxCol = matrix[m].length;
      }
      if (maxCol > 0) autosizeColumns(ws, maxCol);
    }

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

  global.KamusExcel = {
    ensureExcelJs: ensureExcelJs,
    matrixFromHtmlTable: matrixFromHtmlTable,
    cleanMatrix: cleanMatrix,
    exportWorkbook: exportWorkbook,
    canvasToPngBase64: canvasToPngBase64,
    sanitizeFilename: sanitizeFilename,
    defaultExportTimestamp: defaultExportTimestamp,
  };
})(typeof window !== "undefined" ? window : this);
