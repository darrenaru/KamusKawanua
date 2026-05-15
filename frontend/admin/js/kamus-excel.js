/**
 * Shared Excel export (ExcelJS). Does not modify DOM or chart state.
 * Sheets are built in memory; only triggers a file download.
 */
(function (global) {
  const CDNS = [
    "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js",
  ];

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

  /**
   * @param {HTMLTableElement} tableEl
   * @param {{ skipColumnsFromEnd?: number }} opts
   * @returns {string[][]}
   */
  function matrixFromHtmlTable(tableEl, opts) {
    if (!tableEl) return [];
    var skip = (opts && opts.skipColumnsFromEnd) || 0;
    var matrix = [];
    var rows = tableEl.querySelectorAll("tr");
    for (var r = 0; r < rows.length; r++) {
      var tr = rows[r];
      var cells = tr.querySelectorAll("th, td");
      var end = cells.length - skip;
      if (end < 0) end = 0;
      var line = [];
      for (var c = 0; c < end; c++) {
        line.push(String(cells[c].innerText || "").replace(/\r?\n/g, " ").trim());
      }
      matrix.push(line);
    }
    return matrix;
  }

  function applyMatrix(ws, matrix, startRow) {
    var sr = startRow || 1;
    if (!matrix || !matrix.length) return sr;
    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i];
      for (var j = 0; j < row.length; j++) {
        ws.getCell(sr + i, j + 1).value = row[j];
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

  /**
   * @param {string} filename
   * @param {{ name: string, matrix?: string[][], title?: string, table?: HTMLElement, tableOpts?: object, images?: { title?: string, base64: string, width?: number, height?: number }[] }[]} sheets
   */
  async function exportWorkbook(filename, sheets) {
    var ExcelJS = await ensureExcelJs();
    var wb = new ExcelJS.Workbook();
    wb.creator = "Kamus Kawanua";

    for (var s = 0; s < sheets.length; s++) {
      var spec = sheets[s] || {};
      var name = safeSheetName(spec.name);
      var ws = wb.addWorksheet(name);
      var rowPtr = 1;
      if (spec.title) {
        ws.getCell(rowPtr, 1).value = spec.title;
        ws.getCell(rowPtr, 1).font = { bold: true, size: 12 };
        rowPtr += 2;
      }
      var matrix = spec.matrix;
      if (!matrix && spec.table) {
        matrix = matrixFromHtmlTable(spec.table, spec.tableOpts || {});
      }
      if (matrix && matrix.length) {
        applyMatrix(ws, matrix, rowPtr);
        rowPtr += matrix.length + 1;
        var maxCol = 0;
        for (var m = 0; m < matrix.length; m++) {
          if (matrix[m].length > maxCol) maxCol = matrix[m].length;
        }
        if (maxCol > 0) autosizeColumns(ws, maxCol);
        rowPtr += 1;
      }
      if (spec.images && spec.images.length) {
        var imgRow = Math.max(0, rowPtr - 1);
        for (var im = 0; im < spec.images.length; im++) {
          var item = spec.images[im];
          if (item.title) {
            ws.getCell(Math.floor(imgRow) + 1, 1).value = item.title;
            ws.getCell(Math.floor(imgRow) + 1, 1).font = { bold: true };
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

  global.KamusExcel = {
    ensureExcelJs: ensureExcelJs,
    matrixFromHtmlTable: matrixFromHtmlTable,
    exportWorkbook: exportWorkbook,
    canvasToPngBase64: canvasToPngBase64,
    sanitizeFilename: sanitizeFilename,
  };
})(typeof window !== "undefined" ? window : this);
