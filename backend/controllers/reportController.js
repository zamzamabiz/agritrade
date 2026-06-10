import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const normalizeTradeType = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === "I" || normalized === "IMPORT") return "I";
  if (normalized === "E" || normalized === "EXPORT") return "E";
  return null;
};

const normalizeTextFilter = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
};

const buildFilters = (params) => {
  const clauses = [];
  const values = [];
  let i = 1;

  clauses.push(`company_id = $${i++}`);
  values.push(params.companyId);

  clauses.push(`period_date BETWEEN $${i++} AND $${i++}`);
  values.push(params.from, params.to);

  const isValid = (v) => v !== undefined && v !== null && v !== "";

  const normalizedTradeType = normalizeTradeType(params.tradeType);
  if (isValid(normalizedTradeType)) {
    clauses.push(`trade_type = $${i}`);
    values.push(normalizedTradeType);
    i += 1;
  }
  if (isValid(params.hs_code)) {
    clauses.push(`hs_code = $${i}`);
    values.push(params.hs_code);
    i += 1;
  }
  if (isValid(params.origin)) {
    clauses.push(`c.name ILIKE $${i}`);
    values.push(`%${params.origin}%`);
    i += 1;
  }
  if (isValid(params.item)) {
    clauses.push(`item_name ILIKE $${i}`);
    values.push(`%${params.item}%`);
    i += 1;
  }
  if (isValid(params.importer)) {
    clauses.push(`importer_name ILIKE $${i}`);
    values.push(`%${params.importer}%`);
    i += 1;
  }
  if (isValid(params.exporter)) {
    clauses.push(`exporter_name ILIKE $${i}`);
    values.push(`%${params.exporter}%`);
    i += 1;
  }

  return { whereSql: clauses.join(" AND "), values };
};

const fetchRows = async (sql, filters) => {
  const { whereSql, values } = buildFilters(filters);
  return sql.unsafe(
    `SELECT tf.id, tf.period_date, tf.hs_code, tf.item_name, tf.origin_country_id, tf.importer_name, tf.exporter_name, tf.quantity, tf.value_usd, c.name AS origin_country
     FROM trade_fact tf
     LEFT JOIN country_dim c ON c.id = tf.origin_country_id
     WHERE ${whereSql}
     ORDER BY tf.period_date DESC, tf.id DESC`,
    values,
  );
};

const fetchGrouped = async (sql, filters, groupKey, label) => {
  const { whereSql, values } = buildFilters(filters);
  const query = `
    SELECT ${groupKey} AS ${label}, COUNT(*) AS transaction_count, SUM(quantity) AS total_quantity
    FROM trade_fact
    WHERE ${whereSql} AND ${groupKey} IS NOT NULL
    GROUP BY ${groupKey}
    ORDER BY ${label} ASC`;
  return sql.unsafe(query, values);
};

const writeExcel = async (res, filename, columns, rows) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");
  worksheet.columns = columns;
  rows.forEach((r) => worksheet.addRow(r));
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

const writePdfTable = (res, filename, title, headers, rows, columnWidths) => {
  const landscape = headers.length > 6;
  const doc = new PDFDocument({
    size: "A4",
    layout: landscape ? "landscape" : "portrait",
    margins: { top: 30, bottom: 76, left: 24, right: 24 },
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableTopOffset = 82;
  const headerHeight = 30;

  let colWidths;
  if (Array.isArray(columnWidths) && columnWidths.length === headers.length) {
    const total = columnWidths.reduce((sum, w) => sum + (Number(w) || 0), 0);
    const denom = total > 0 ? total : headers.length;
    colWidths = columnWidths.map((w) => (pageWidth * (Number(w) || 1)) / denom);
  } else {
    const equalWidth = pageWidth / headers.length;
    colWidths = headers.map(() => equalWidth);
  }

  const colors = {
    brand: "#0f4c5c",
    headerBg: "#f0f4f8",
    rowAlt: "#f8fafc",
    border: "#cfd8e3",
    text: "#0b1f2a",
    muted: "#5f6b76",
    white: "#ffffff",
  };

  const labelMap = {
    sno: "S.NO",
    period_date: "DATE",
    hs_code: "HS CODE",
    item_name: "ITEM",
    origin_country: "ORIGIN",
    importer_name: "IMPORTER",
    exporter_name: "EXPORTER",
    quantity: "QUANTITY",
    value_usd: "VALUE (USD)",
    transaction_count: "TRANSACTIONS",
    total_quantity: "TOTAL QTY",
    agent_name: "AGENT",
    agent_number: "AGENT #",
    terminal_sheds: "TERMINAL/SHEDS",
    origin_country_id: "COUNTRY ID",
  };

  const isNumericColumn = (key) =>
    ["sno", "quantity", "value_usd", "transaction_count", "total_quantity", "origin_country_id"].includes(key);

  const formatCellText = (value, key) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (value === null || value === undefined || value === "") return "-";
    if (key === "value_usd" && Number.isFinite(Number(value))) {
      return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (["quantity", "transaction_count", "total_quantity", "sno"].includes(key) && Number.isFinite(Number(value))) {
      return Number(value).toLocaleString("en-US");
    }
    return String(value);
  };

  const drawPageHeader = (pageNo) => {
    const top = doc.page.margins.top;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;

    doc.rect(left, top - 12, pageWidth, 38).fill(colors.brand);
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(colors.white)
      .text("AgriTrade Insights", left + 12, top - 2, {
        width: pageWidth - 24,
        align: "left",
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(colors.white)
      .text(`Page ${pageNo}`, left + 12, top + 10, {
        width: pageWidth - 24,
        align: "right",
      });

    const timestamp = new Date().toLocaleString("en-GB", {
      hour12: false,
    });

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(colors.text)
      .text(title, left, top + 36, { width: pageWidth, align: "left" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(colors.muted)
      .text(`Generated: ${timestamp}   |   Records: ${rows.length}`, left, top + 54, {
        width: pageWidth,
        align: "left",
      });

    doc
      .strokeColor(colors.border)
      .lineWidth(1)
      .moveTo(left, top + 72)
      .lineTo(right, top + 72)
      .stroke();

    doc.y = top + tableTopOffset;
  };

  const drawTableHeader = () => {
    const y = doc.y;
    let x = doc.page.margins.left;

    doc.rect(x, y, pageWidth, headerHeight).fill(colors.headerBg);
    doc.rect(x, y, pageWidth, headerHeight).stroke(colors.border);

    headers.forEach((key, i) => {
      const label = labelMap[key] || key.replace(/_/g, " ").toUpperCase();
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(colors.text)
        .text(label, x + 6, y + 9, {
          width: colWidths[i] - 12,
          align: isNumericColumn(key) ? "right" : "left",
        });

      x += colWidths[i];
      doc
        .strokeColor(colors.border)
        .moveTo(x, y)
        .lineTo(x, y + headerHeight)
        .stroke();
    });

    doc.y = y + headerHeight;
  };

  const drawFooter = (pageNo) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = pageWidth;
    // Keep footer fully inside the printable area so PDFKit never creates a spillover page.
    const yBase = doc.page.height - doc.page.margins.bottom - 20;

    doc.strokeColor(colors.border).lineWidth(1)
      .moveTo(left, yBase - 6)
      .lineTo(right, yBase - 6)
      .stroke();

    doc.font('Helvetica').fontSize(7.2).fillColor(colors.text)
      .text('WORLD CUSTOMS ORGANIZATION · HARMONIZED SYSTEM', left, yBase, {
          width,
          align: 'center',
          lineBreak: false,
      });

    doc.font('Helvetica').fontSize(7.2).fillColor(colors.text)
      .text('PAKISTAN CUSTOMS DATA PLATFORM', left, yBase + 9, {
          width,
          align: 'center',
          lineBreak: false,
      });

    doc.font('Helvetica-Bold').fontSize(7.2).fillColor(colors.brand)
      .text('CHAPTER 01-99', left, yBase, {
          width: width / 3,
          align: 'left',
          lineBreak: false,
      });

    doc.font('Helvetica').fontSize(7.2).fillColor(colors.text)
      .text('DESIGNED BY INSHA TAHIR', left + (width * 2 / 3), yBase, {
          width: width / 3,
          align: 'right',
          lineBreak: false,
      });
  };

  let pageNo = 1;
  drawPageHeader(pageNo);
  drawTableHeader();

  let y = doc.y;

  if (!rows.length) {
    const boxY = y + 16;
    doc.rect(doc.page.margins.left, boxY, pageWidth, 54).fill("#fff7ed").stroke("#fed7aa");
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#9a3412")
      .text("No data found for selected filters", doc.page.margins.left + 12, boxY + 12, {
        width: pageWidth - 24,
        align: "left",
      });
  }

  rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(9);
    const cellTexts = headers.map((key) => formatCellText(row[key], key));
    const cellHeights = cellTexts.map((text, i) =>
      doc.heightOfString(text, { width: colWidths[i] - 12 }),
    );
    const dynamicHeight = Math.max(24, Math.max(...cellHeights) + 10);

    if (y + dynamicHeight > doc.page.height - doc.page.margins.bottom - 18) {
      doc.addPage();
      pageNo += 1;
      drawPageHeader(pageNo);
      drawTableHeader();
      y = doc.y;
    }

    let x = doc.page.margins.left;
    if (rowIndex % 2 === 0) {
      doc.rect(x, y, pageWidth, dynamicHeight).fill(colors.rowAlt);
    }

    doc.rect(x, y, pageWidth, dynamicHeight).stroke(colors.border);

    headers.forEach((key, i) => {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(colors.text)
        .text(cellTexts[i], x + 6, y + 6, {
          width: colWidths[i] - 12,
          align: isNumericColumn(key) ? "right" : "left",
        });

      x += colWidths[i];
      doc
        .strokeColor(colors.border)
        .moveTo(x, y)
        .lineTo(x, y + dynamicHeight)
        .stroke();
    });

    y += dynamicHeight;
    doc.y = y;
  });

  const buffered = doc.bufferedPageRange();
  const lastPageIndex = buffered.start + buffered.count - 1;
  doc.switchToPage(lastPageIndex);
  drawFooter(buffered.count);
  doc.flushPages();
  doc.end();
};

const requireCompany = (req, res) => {
  if (!req.user || !req.user.companyId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: company context missing",
    });
    return null;
  }
  return req.user.companyId;
};

const ReportController = {
  exportReport: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const source = Object.keys(req.body || {}).length ? req.body : req.query;

      const from = firstNonEmpty(source.startDate, source.from) || "0001-01-01";
      const to = firstNonEmpty(source.endDate, source.to) || "9999-12-31";

      const filters = {
        companyId,
        from,
        to,
        tradeType: normalizeTradeType(source.trade_type),
        hs_code: normalizeTextFilter(source.hs_code),
        originCountryId: source.origin_country_id
          ? Number(source.origin_country_id)
          : null,
        item: normalizeTextFilter(source.item),
        importer: normalizeTextFilter(source.importer),
        exporter: normalizeTextFilter(source.exporter),
      };

      const rows = await fetchRows(req.sql, filters);
      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));
      await writeExcel(
        res,
        `trade_report_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Trade Type", key: "trade_type", width: 10 },
          { header: "Date", key: "period_date", width: 12 },
          { header: "HS Code", key: "hs_code", width: 8 },
          { header: "Item", key: "item_name", width: 40 },
          { header: "Origin", key: "origin_country", width: 18 },
          { header: "Importer", key: "importer_name", width: 28 },
          { header: "Exporter", key: "exporter_name", width: 28 },
          { header: "Quantity", key: "quantity", width: 12 },
          { header: "Value USD", key: "value_usd", width: 14 },
          { header: "File ID", key: "uploaded_file_id", width: 10 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export report",
        error: error.message,
      });
    }
  },

  exportReportPDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const source = Object.keys(req.body || {}).length ? req.body : req.query;

      const from = firstNonEmpty(source.startDate, source.from) || "0001-01-01";
      const to = firstNonEmpty(source.endDate, source.to) || "9999-12-31";

      const filters = {
        companyId,
        from,
        to,
        tradeType: normalizeTradeType(source.trade_type),
        hs_code: normalizeTextFilter(source.hs_code),
        originCountryId: source.origin_country_id
          ? Number(source.origin_country_id)
          : null,
        item: normalizeTextFilter(source.item),
        importer: normalizeTextFilter(source.importer),
        exporter: normalizeTextFilter(source.exporter),
      };

      const rows = await fetchRows(req.sql, filters);
      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));
      writePdfTable(
        res,
        `trade_report_${from}_to_${to}.pdf`,
        `Trade Report ${from} to ${to}`,
        [
          "sno",
          "hs_code",
          "period_date",
          "item_name",
          "origin_country",
          "importer_name",
          "exporter_name",
          "quantity",
          "value_usd",
        ],
        rowsWithSerial,
        [
          0.6, // sno (narrow)
          1, // hs_code
          1, // period_date
          2.4, // item_name (wide)
          1.3, // origin_country
          2.4, // importer_name (wide)
          2.4, // exporter_name (wide)
          1.1, // quantity (narrow)
          0.9, // value_usd (narrow)
        ],
      );
    } catch (error) {
      console.error("Error exporting report PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export report PDF",
        error: error.message,
      });
    }
  },

  exportItemWiseExcel: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "TRIM(item_name)",
        "item",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      await writeExcel(
        res,
        `item_wise_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Item", key: "item", width: 40 },
          { header: "Transaction Count", key: "transaction_count", width: 18 },
          { header: "Total Quantity", key: "total_quantity", width: 16 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting item-wise Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export item-wise Excel",
        error: error.message,
      });
    }
  },

  exportImporterWiseExcel: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          exporter: req.query.exporter,
        },
        "TRIM(importer_name)",
        "importer",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      await writeExcel(
        res,
        `importer_wise_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Importer", key: "importer", width: 32 },
          { header: "Transaction Count", key: "transaction_count", width: 18 },
          { header: "Total Quantity", key: "total_quantity", width: 16 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting importer-wise Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export importer-wise Excel",
        error: error.message,
      });
    }
  },

  exportExporterWiseExcel: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          importer: req.query.importer,
        },
        "TRIM(exporter_name)",
        "exporter",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      await writeExcel(
        res,
        `exporter_wise_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Exporter", key: "exporter", width: 32 },
          { header: "Transaction Count", key: "transaction_count", width: 18 },
          { header: "Total Quantity", key: "total_quantity", width: 16 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting exporter-wise Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export exporter-wise Excel",
        error: error.message,
      });
    }
  },

  exportCountryWiseExcel: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          item: req.query.item,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "origin_country_id",
        "origin_country_id",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      await writeExcel(
        res,
        `country_wise_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Origin Country ID", key: "origin_country_id", width: 18 },
          { header: "Transaction Count", key: "transaction_count", width: 18 },
          { header: "Total Quantity", key: "total_quantity", width: 16 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting country-wise Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export country-wise Excel",
        error: error.message,
      });
    }
  },

  exportAgentWiseExcel: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "TRIM(agent_name)",
        "agent_name",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      await writeExcel(
        res,
        `agent_wise_${from}_to_${to}.xlsx`,
        [
          { header: "S.No", key: "sno", width: 6 },
          { header: "Agent Name", key: "agent_name", width: 32 },
          { header: "Agent Number", key: "agent_number", width: 18 },
          { header: "Terminal/Sheds", key: "terminal_sheds", width: 18 },
          { header: "Transaction Count", key: "transaction_count", width: 18 },
          { header: "Total Quantity", key: "total_quantity", width: 16 },
        ],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting agent-wise Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export agent-wise Excel",
        error: error.message,
      });
    }
  },

  exportItemWisePDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "TRIM(item_name)",
        "item",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      writePdfTable(
        res,
        `item_wise_${from}_to_${to}.pdf`,
        `Item-wise Report ${from} to ${to}`,
        ["sno", "item", "transaction_count", "total_quantity"],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting item-wise PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export item-wise PDF",
        error: error.message,
      });
    }
  },

  exportImporterWisePDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          exporter: req.query.exporter,
        },
        "TRIM(importer_name)",
        "importer",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      writePdfTable(
        res,
        `importer_wise_${from}_to_${to}.pdf`,
        `Importer-wise Report ${from} to ${to}`,
        ["sno", "importer", "transaction_count", "total_quantity"],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting importer-wise PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export importer-wise PDF",
        error: error.message,
      });
    }
  },

  exportExporterWisePDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          importer: req.query.importer,
        },
        "TRIM(exporter_name)",
        "exporter",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      writePdfTable(
        res,
        `exporter_wise_${from}_to_${to}.pdf`,
        `Exporter-wise Report ${from} to ${to}`,
        ["sno", "exporter", "transaction_count", "total_quantity"],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting exporter-wise PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export exporter-wise PDF",
        error: error.message,
      });
    }
  },

  exportCountryWisePDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          item: req.query.item,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "origin_country_id",
        "origin_country_id",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      writePdfTable(
        res,
        `country_wise_${from}_to_${to}.pdf`,
        `Country-wise Report ${from} to ${to}`,
        ["sno", "origin_country_id", "transaction_count", "total_quantity"],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting country-wise PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export country-wise PDF",
        error: error.message,
      });
    }
  },

  exportAgentWisePDF: async (req, res) => {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const from = req.query.startDate || "0001-01-01";
      const to = req.query.endDate || "9999-12-31";

      const rows = await fetchGrouped(
        req.sql,
        {
          companyId,
          from,
          to,
          tradeType: req.query.trade_type
            ? req.query.trade_type.toUpperCase()[0]
            : null,
          hs_code: req.query.hs_code ? Number(req.query.hs_code) : null,
          originCountryId: req.query.origin_country_id
            ? Number(req.query.origin_country_id)
            : null,
          item: req.query.item,
          importer: req.query.importer,
          exporter: req.query.exporter,
        },
        "TRIM(agent_name)",
        "agent_name",
      );

      const rowsWithSerial = rows.map((r, index) => ({
        ...r,
        sno: index + 1,
      }));

      writePdfTable(
        res,
        `agent_wise_${from}_to_${to}.pdf`,
        `Agent-wise Report ${from} to ${to}`,
        ["sno", "agent_name", "agent_number", "terminal_sheds", "transaction_count", "total_quantity"],
        rowsWithSerial,
      );
    } catch (error) {
      console.error("Error exporting agent-wise PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export agent-wise PDF",
        error: error.message,
      });
    }
  },
};

export default ReportController;
