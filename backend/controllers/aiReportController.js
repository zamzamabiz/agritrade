import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const requireCompany = (req, res) => {
    if (!req.user || !req.user.companyId) {
        res.status(401).json({ success: false, message: 'Unauthorized: company context missing' });
        return null;
    }
    return req.user.companyId;
};

const parseFilters = (query) => query || {};

const objectPaginate = (arr, page = 1, page_size = 50) => {
    const p = Number(page) || 1;
    const ps = Number(page_size) || 50;
    const start = (p - 1) * ps;
    return { total: arr.length, page: p, page_size: ps, records: arr.slice(start, start + ps) };
};

const buildWhere = (companyId, filters = {}, opts = {}) => {
    const clauses = ['tf.company_id = $1'];
    const params = [companyId];
    let p = params.length;

    if (filters.product && filters.product !== 'all') {
        params.push(filters.product);
        p += 1;
        clauses.push(`COALESCE(NULLIF(TRIM(tf.item_name), ''), 'UNKNOWN') = $${p}`);
    }

    if (filters.trade_type) {
        const tt = String(filters.trade_type).toUpperCase();
        if (tt === 'I' || tt === 'E' || tt === 'IMPORT' || tt === 'EXPORT') {
            params.push(tt[0]);
            p += 1;
            clauses.push(`tf.trade_type = $${p}`);
        }
    }

    if (filters.chapter) {
        const chapter = Number(filters.chapter);
        if (!Number.isNaN(chapter)) {
            params.push(chapter);
            p += 1;
            clauses.push(`tf.chapter_id = $${p}`);
        }
    }

    const from = filters.from || filters.startDate;
    const to = filters.to || filters.endDate;
    if (from && to) {
        params.push(from, to);
        const fromIdx = ++p;
        const toIdx = ++p;
        clauses.push(`tf.period_date >= $${fromIdx} AND tf.period_date < (date_trunc('month', $${toIdx}::date) + INTERVAL '1 month')`);
    } else if (from) {
        params.push(from);
        p += 1;
        clauses.push(`tf.period_date >= $${p}`);
    } else if (to) {
        params.push(to);
        p += 1;
        clauses.push(`tf.period_date < (date_trunc('month', $${p}::date) + INTERVAL '1 month')`);
    }

    if (opts.productRequired) {
        params.push(opts.productRequired);
        p += 1;
        clauses.push(`COALESCE(NULLIF(TRIM(tf.item_name), ''), 'UNKNOWN') = $${p}`);
    }

    return { where: clauses.join(' AND '), params };
};

const fetchRows = async (req, res, opts = {}) => {
    const sql = req.sql;
    const companyId = requireCompany(req, res);
    if (!companyId) return null;

    const filters = parseFilters(req.query);
    const { where, params } = buildWhere(companyId, filters, opts);

    const rows = await sql.unsafe(
        `SELECT
            tf.period_date::text AS date_orig,
            EXTRACT(MONTH FROM tf.period_date)::int AS month,
            EXTRACT(YEAR FROM tf.period_date)::int AS year,
            COALESCE(NULLIF(TRIM(tf.item_name), ''), 'UNKNOWN') AS item,
            COALESCE(NULLIF(TRIM(tf.hs_code), ''), 'UNKNOWN') AS hs_code,
            COALESCE(NULLIF(TRIM(tf.exporter_name), ''), 'UNKNOWN') AS exporter_norm,
            COALESCE(NULLIF(TRIM(c.name), ''), 'UNKNOWN') AS exporter_country,
            COALESCE(NULLIF(TRIM(tf.port_of_shipment), ''), 'UNKNOWN') AS exporter_port,
            COALESCE(NULLIF(TRIM(tf.importer_name), ''), 'UNKNOWN') AS importer_norm,
            COALESCE(tf.quantity, 0)::float8 AS quantity_kg,
            CASE
                WHEN COALESCE(tf.quantity, 0) = 0 THEN 0
                ELSE (COALESCE(tf.value_usd, 0) / NULLIF(tf.quantity, 0))::float8
            END AS unit_price_usd,
            COALESCE(tf.value_usd, 0)::float8 AS total_value_usd
         FROM trade_fact tf
         LEFT JOIN country_dim c ON c.id = tf.origin_country_id
         WHERE ${where}`,
        params,
    );

    return rows;
};

const buildCommodityPortfolioRows = (rows, limit = 20) => {
    const sums = {};
    rows.forEach((r) => {
        sums[r.item] = (sums[r.item] || 0) + (Number(r.quantity_kg) || 0);
    });
    const items = Object.keys(sums).map((k) => ({ item: k, quantity_kg: sums[k] }));
    const total = items.reduce((s, it) => s + it.quantity_kg, 0) || 1;
    items.sort((a, b) => b.quantity_kg - a.quantity_kg);
    return items.slice(0, limit).map((it, idx) => ({
        rank: idx + 1,
        item: it.item,
        quantity_kg: +it.quantity_kg.toFixed(2),
        share_pct: +(it.quantity_kg / total * 100).toFixed(1),
    }));
};

const buildMomentumRows = (rows, limit = 10) => {
    const jan = rows.filter((r) => r.month === 1);
    const dec = rows.filter((r) => r.month === 12);
    const janSums = {};
    const decSums = {};
    jan.forEach((r) => { janSums[r.item] = (janSums[r.item] || 0) + (Number(r.quantity_kg) || 0); });
    dec.forEach((r) => { decSums[r.item] = (decSums[r.item] || 0) + (Number(r.quantity_kg) || 0); });

    const products = Object.keys({ ...janSums, ...decSums }).map((item) => {
        const j = janSums[item] || 0;
        const d = decSums[item] || 0;
        const inc = d - j;
        const growth = j === 0 && d > 0 ? 100 : j === 0 && d === 0 ? 0 : Math.round((inc / j) * 100);
        return {
            item,
            dec_volume_kg: +d.toFixed(2),
            vol_increase_kg: +inc.toFixed(2),
            growth_pct: growth,
        };
    });

    products.sort((a, b) => b.vol_increase_kg - a.vol_increase_kg);
    return products.slice(0, limit).map((p, idx) => ({ rank: idx + 1, ...p }));
};

const buildTopExportersRows = (rows, limit = 10) => {
    const sums = {};
    rows.forEach((r) => {
        sums[r.exporter_norm] = (sums[r.exporter_norm] || 0) + (Number(r.quantity_kg) || 0);
    });
    return Object.keys(sums)
        .map((k) => ({ exporter: k, quantity_kg: sums[k] }))
        .sort((a, b) => b.quantity_kg - a.quantity_kg)
        .slice(0, limit)
        .map((it, idx) => ({ rank: idx + 1, exporter: it.exporter, quantity_kg: +it.quantity_kg.toFixed(2) }));
};

const buildTopImportersRows = (rows, limit = 10) => {
    const sums = {};
    rows.forEach((r) => {
        sums[r.importer_norm] = (sums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0);
    });
    return Object.keys(sums)
        .map((k) => ({ importer: k, quantity_kg: sums[k] }))
        .sort((a, b) => b.quantity_kg - a.quantity_kg)
        .slice(0, limit)
        .map((it, idx) => ({ rank: idx + 1, importer: it.importer, quantity_kg: +it.quantity_kg.toFixed(2) }));
};

const buildOverviewPayload = (rows) => {
    const totalQuantity = rows.reduce((sum, row) => sum + (Number(row.quantity_kg) || 0), 0);
    const totalValue = rows.reduce((sum, row) => sum + (Number(row.total_value_usd) || 0), 0);
    const shipments = rows.length;
    const activeBuyers = new Set(rows.map((row) => row.importer_norm).filter(Boolean)).size;
    const origins = new Set(rows.map((row) => row.exporter_country).filter(Boolean)).size;

    const itemSums = {};
    const importerSums = {};
    const exporterSums = {};
    rows.forEach((row) => {
        const itemKey = row.item || 'UNKNOWN';
        const importerKey = row.importer_norm || 'UNKNOWN';
        const exporterKey = row.exporter_norm || 'UNKNOWN';
        itemSums[itemKey] = (itemSums[itemKey] || 0) + (Number(row.quantity_kg) || 0);
        importerSums[importerKey] = (importerSums[importerKey] || 0) + (Number(row.quantity_kg) || 0);
        exporterSums[exporterKey] = (exporterSums[exporterKey] || 0) + (Number(row.quantity_kg) || 0);
    });

    const topItems = Object.keys(itemSums)
        .map((item) => ({ item, quantity_kg: itemSums[item] }))
        .sort((a, b) => b.quantity_kg - a.quantity_kg)
        .slice(0, 10)
        .map((row, idx) => ({ rank: idx + 1, ...row, share_pct: totalQuantity ? +(row.quantity_kg / totalQuantity * 100).toFixed(1) : 0 }));

    const topImporters = Object.keys(importerSums)
        .map((importer) => ({ importer, quantity_kg: importerSums[importer] }))
        .sort((a, b) => b.quantity_kg - a.quantity_kg)
        .slice(0, 10)
        .map((row, idx) => ({ rank: idx + 1, ...row, share_pct: totalQuantity ? +(row.quantity_kg / totalQuantity * 100).toFixed(1) : 0 }));

    const topExporters = Object.keys(exporterSums)
        .map((exporter) => ({ exporter, quantity_kg: exporterSums[exporter] }))
        .sort((a, b) => b.quantity_kg - a.quantity_kg)
        .slice(0, 10)
        .map((row, idx) => ({ rank: idx + 1, ...row, share_pct: totalQuantity ? +(row.quantity_kg / totalQuantity * 100).toFixed(1) : 0 }));

    const topItem = topItems[0]?.item || 'N/A';
    const importerTotal = Object.values(importerSums).reduce((sum, value) => sum + value, 0) || 1;
    let hhi = 0;
    Object.values(importerSums).forEach((value) => {
        const share = value / importerTotal;
        hhi += (share * 100) * (share * 100);
    });
    hhi = Math.round(hhi);

    const marketTag = topItems[0]?.quantity_kg > 0 ? 'Top Product Active' : 'Monitoring';

    return {
        summary: [
            { metric: 'Shipments', value: shipments },
            { metric: 'Total Quantity KG', value: +totalQuantity.toFixed(2) },
            { metric: 'Total Value USD', value: +totalValue.toFixed(2) },
            { metric: 'Active Buyers', value: activeBuyers },
            { metric: 'Origin Countries', value: origins },
            { metric: 'HHI', value: hhi },
            { metric: 'Top Product', value: topItem },
            { metric: 'Signal Tag', value: marketTag },
        ],
        topItems,
        topImporters,
        topExporters,
    };
};

const writeOverviewExcel = async (res, filename, payload) => {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Overview');
    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 24 },
        { header: 'Value', key: 'value', width: 24 },
    ];
    payload.summary.forEach((row) => summarySheet.addRow(row));

    const topItemsSheet = workbook.addWorksheet('Top Commodities');
    topItemsSheet.columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'Item', key: 'item', width: 40 },
        { header: 'Quantity KG', key: 'quantity_kg', width: 18 },
        { header: 'Share %', key: 'share_pct', width: 12 },
    ];
    payload.topItems.forEach((row) => topItemsSheet.addRow(row));

    const topImportersSheet = workbook.addWorksheet('Top Importers');
    topImportersSheet.columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'Importer', key: 'importer', width: 40 },
        { header: 'Quantity KG', key: 'quantity_kg', width: 18 },
        { header: 'Share %', key: 'share_pct', width: 12 },
    ];
    payload.topImporters.forEach((row) => topImportersSheet.addRow(row));

    const topExportersSheet = workbook.addWorksheet('Top Exporters');
    topExportersSheet.columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'Exporter', key: 'exporter', width: 40 },
        { header: 'Quantity KG', key: 'quantity_kg', width: 18 },
        { header: 'Share %', key: 'share_pct', width: 12 },
    ];
    payload.topExporters.forEach((row) => topExportersSheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
};

const writeOverviewPdf = (res, filename, payload) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 28, right: 26, bottom: 68, left: 26 },
        bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colors = {
        brand: '#9a4f13',
        text: '#1f2f46',
        muted: '#596579',
        border: '#ccd5e2',
        headBg: '#eef2f7',
        altBg: '#f8fafc',
    };

    const drawHeader = () => {
        const left = doc.page.margins.left;
        const top = doc.page.margins.top;
        const right = doc.page.width - doc.page.margins.right;
        const generated = new Date().toLocaleString('en-GB', { hour12: false });

        doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.brand)
            .text('TRADEINTEL', left, top, { width: pageWidth, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.text)
            .text('Executive Overview', left, top + 22, { width: pageWidth, align: 'center' });
        doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted)
            .text(`Generated: ${generated}`, left, top + 38, { width: pageWidth, align: 'center' });
        doc.strokeColor(colors.border).lineWidth(1)
            .moveTo(left, top + 56)
            .lineTo(right, top + 56)
            .stroke();
        doc.y = top + 68;
    };

    const drawSummary = () => {
        const labels = payload.summary;
        const startY = doc.y;
        const cellWidth = pageWidth / 4;
        const cellHeight = 34;
        labels.slice(0, 4).forEach((row, idx) => {
            const x = doc.page.margins.left + (idx * cellWidth);
            doc.rect(x, startY, cellWidth - 8, cellHeight).fill(colors.headBg).stroke(colors.border);
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.text)
                .text(row.metric, x + 6, startY + 5, { width: cellWidth - 20 });
            doc.font('Helvetica').fontSize(10).fillColor(colors.brand)
                .text(String(row.value), x + 6, startY + 18, { width: cellWidth - 20 });
        });
        doc.y = startY + cellHeight + 12;
    };

    const drawSimpleTable = (title, headers, rows, numericKeys = []) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.text).text(title, doc.page.margins.left, doc.y, { width: pageWidth });
        const headerY = doc.y + 10;
        const rowH = 20;
        const colWidths = headers.map((h) => h.width);
        let x = doc.page.margins.left;
        doc.rect(x, headerY, pageWidth, rowH).fill(colors.headBg).stroke(colors.border);
        headers.forEach((h, idx) => {
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.text)
                .text(h.label, x + 5, headerY + 6, { width: colWidths[idx] - 10, align: numericKeys.includes(h.key) ? 'right' : 'left' });
            x += colWidths[idx];
            doc.strokeColor(colors.border).moveTo(x, headerY).lineTo(x, headerY + rowH).stroke();
        });

        let y = headerY + rowH;
        rows.slice(0, 8).forEach((row, rowIndex) => {
            let rowX = doc.page.margins.left;
            if (rowIndex % 2 === 0) doc.rect(rowX, y, pageWidth, rowH).fill(colors.altBg);
            doc.rect(rowX, y, pageWidth, rowH).stroke(colors.border);
            headers.forEach((h, idx) => {
                const value = row[h.key];
                doc.font('Helvetica').fontSize(8.5).fillColor(colors.text)
                    .text(value === null || value === undefined ? '-' : String(value), rowX + 5, y + 6, { width: colWidths[idx] - 10, align: numericKeys.includes(h.key) ? 'right' : 'left' });
                rowX += colWidths[idx];
                doc.strokeColor(colors.border).moveTo(rowX, y).lineTo(rowX, y + rowH).stroke();
            });
            y += rowH;
        });
        doc.y = y + 12;
    };

    drawHeader();
    drawSummary();
    drawSimpleTable('Top Commodities', [
        { label: 'Rank', key: 'rank', width: 40 },
        { label: 'Item', key: 'item', width: 300 },
        { label: 'Quantity KG', key: 'quantity_kg', width: 120 },
        { label: 'Share %', key: 'share_pct', width: 90 },
    ], payload.topItems, ['rank', 'quantity_kg', 'share_pct']);
    drawSimpleTable('Top Importers', [
        { label: 'Rank', key: 'rank', width: 40 },
        { label: 'Importer', key: 'importer', width: 300 },
        { label: 'Quantity KG', key: 'quantity_kg', width: 120 },
        { label: 'Share %', key: 'share_pct', width: 90 },
    ], payload.topImporters, ['rank', 'quantity_kg', 'share_pct']);

    const buffered = doc.bufferedPageRange();
    const lastPageIndex = buffered.start + buffered.count - 1;
    doc.switchToPage(lastPageIndex);
    doc.font('Helvetica').fontSize(7.2).fillColor(colors.muted)
        .text('Executive overview export generated by TradeIntel', doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 2, {
            width: pageWidth,
            align: 'center',
            lineBreak: false,
        });
    doc.flushPages();
    doc.end();
};

const writeExportExcel = async (res, filename, columns, rows) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Report');
    ws.columns = columns;
    rows.forEach((r) => ws.addRow(r));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
};

const writeExportPdf = (res, filename, title, headers, rows) => {
    const landscape = headers.length > 4;
    const doc = new PDFDocument({
        size: 'A4',
        layout: landscape ? 'landscape' : 'portrait',
        margins: { top: 26, right: 24, bottom: 72, left: 24 },
        bufferPages: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colors = {
        brand: '#9a4f13',
        text: '#1f2f46',
        muted: '#596579',
        border: '#ccd5e2',
        headBg: '#eef2f7',
        altBg: '#f8fafc',
    };

    const headerLabelMap = {
        rank: 'RANK',
        item: 'ITEM',
        quantity_kg: 'QUANTITY KG',
        share_pct: 'SHARE %',
        dec_volume_kg: 'DEC VOLUME KG',
        vol_increase_kg: 'VOLUME INCREASE KG',
        growth_pct: 'GROWTH %',
        exporter: 'EXPORTER',
        importer: 'IMPORTER',
    };

    const widthMap = {
        rank: 0.8,
        item: 3.4,
        quantity_kg: 1.5,
        share_pct: 1.0,
        dec_volume_kg: 1.6,
        vol_increase_kg: 1.8,
        growth_pct: 1.1,
        exporter: 3.2,
        importer: 3.2,
    };

    const totalWeight = headers.reduce((sum, h) => sum + (widthMap[h] || 1.4), 0);
    const colWidths = headers.map((h) => (pageWidth * (widthMap[h] || 1.4)) / totalWeight);

    const isNumeric = (h) => ['rank', 'quantity_kg', 'share_pct', 'dec_volume_kg', 'vol_increase_kg', 'growth_pct'].includes(h);

    const formatCell = (value, key) => {
        if (value === null || value === undefined || value === '') return '-';
        if (['quantity_kg', 'dec_volume_kg', 'vol_increase_kg'].includes(key) && Number.isFinite(Number(value))) {
            return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
        }
        if (key === 'share_pct' && Number.isFinite(Number(value))) {
            return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
        }
        if (key === 'growth_pct' && Number.isFinite(Number(value))) {
            const n = Number(value);
            return `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`;
        }
        return String(value);
    };

    const drawHeader = (pageNo) => {
        const left = doc.page.margins.left;
        const top = doc.page.margins.top;
        const right = doc.page.width - doc.page.margins.right;
        const generated = new Date().toLocaleString('en-GB', { hour12: false });

        doc.font('Helvetica-Bold').fontSize(13).fillColor(colors.brand)
            .text('TRADEINTEL', left, top, { width: pageWidth, align: 'left' });

        doc.font('Helvetica').fontSize(8.5).fillColor(colors.text)
            .text('HS CODE CLASSIFICATION INTELLIGENCE PLATFORM', left, top + 16, { width: pageWidth, align: 'left' });

        doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.text)
            .text(title, left, top + 34, { width: pageWidth, align: 'center' });

        doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted)
            .text(`Generated: ${generated}   |   Records: ${rows.length}   |   Page ${pageNo}`, left, top + 50, {
                width: pageWidth,
                align: 'center',
            });

        doc.strokeColor(colors.border).lineWidth(1)
            .moveTo(left, top + 68)
            .lineTo(right, top + 68)
            .stroke();

        doc.y = top + 76;
    };

    const drawTableHeader = () => {
        const left = doc.page.margins.left;
        const y = doc.y;
        const h = 23;
        let x = left;

        doc.rect(left, y, pageWidth, h).fill(colors.headBg).stroke(colors.border);

        headers.forEach((key, i) => {
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.text)
                .text(headerLabelMap[key] || key.replace(/_/g, ' ').toUpperCase(), x + 5, y + 7, {
                    width: colWidths[i] - 10,
                    align: isNumeric(key) ? 'right' : 'left',
                });
            x += colWidths[i];
            doc.strokeColor(colors.border).moveTo(x, y).lineTo(x, y + h).stroke();
        });

        doc.y = y + h;
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
    drawHeader(pageNo);
    drawTableHeader();
    let y = doc.y;

    if (!rows.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#9a3412')
            .text('No data found for selected filters.', doc.page.margins.left, y + 12, {
                width: pageWidth,
                align: 'left',
            });
    }

    rows.forEach((row, idx) => {
        const texts = headers.map((h) => formatCell(row[h], h));
        const heights = texts.map((t, i) => doc.heightOfString(t, { width: colWidths[i] - 10 }));
        const rowH = Math.max(20, Math.max(...heights) + 8);

        if (y + rowH > doc.page.height - doc.page.margins.bottom - 12) {
            doc.addPage();
            pageNo += 1;
            drawHeader(pageNo);
            drawTableHeader();
            y = doc.y;
        }

        const left = doc.page.margins.left;
        let x = left;

        if (idx % 2 === 0) {
            doc.rect(left, y, pageWidth, rowH).fill(colors.altBg);
        }
        doc.rect(left, y, pageWidth, rowH).stroke(colors.border);

        headers.forEach((h, i) => {
            doc.font('Helvetica').fontSize(8.6).fillColor(colors.text)
                .text(texts[i], x + 5, y + 5, {
                    width: colWidths[i] - 10,
                    align: isNumeric(h) ? 'right' : 'left',
                });
            x += colWidths[i];
            doc.strokeColor(colors.border).moveTo(x, y).lineTo(x, y + rowH).stroke();
        });

        y += rowH;
        doc.y = y;
    });

    const buffered = doc.bufferedPageRange();
    const lastPageIndex = buffered.start + buffered.count - 1;
    doc.switchToPage(lastPageIndex);
    drawFooter(buffered.count);
    doc.flushPages();
    doc.end();
};

const AiController = {
    upload: async (req, res) => {
        return res.status(400).json({
            success: false,
            message: 'AI upload is disabled. Data is sourced from the database via the standard upload pipeline.',
        });
    },

    stats: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const total_quantity_kg = rows.reduce((s, r) => s + (Number(r.quantity_kg) || 0), 0);
            const active_buyers = new Set(rows.map((r) => r.importer_norm)).size;
            const origins = new Set(rows.map((r) => r.exporter_country)).size;
            const shipments = rows.length;

            const productSums = {};
            rows.forEach((r) => { productSums[r.item] = (productSums[r.item] || 0) + (Number(r.quantity_kg) || 0); });
            const topProduct = Object.keys(productSums).sort((a, b) => (productSums[b] || 0) - (productSums[a] || 0))[0] || null;
            const topShare = topProduct ? (productSums[topProduct] / (total_quantity_kg || 1)) * 100 : 0;

            const importerSums = {};
            rows.forEach((r) => { importerSums[r.importer_norm] = (importerSums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const total = total_quantity_kg || 1;
            let hhi = 0;
            Object.values(importerSums).forEach((v) => { const s = v / total; hhi += (s * 100) * (s * 100); });
            hhi = Math.round(hhi);

            let tag = 'Concentrated';
            if (topShare > 15) tag = 'High Volume';
            else if (hhi < 250) tag = 'Fragmented Market';

            const ai_pulse = {
                message: `Market Pulse: ${total_quantity_kg} KG currently active across ${active_buyers} unique buyers. ${topProduct ? topProduct + ' shows significant volume in this selection.' : ''}`,
                tag,
            };

            return res.json({ total_quantity_kg, active_buyers, origins, shipments, ai_pulse });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
        }
    },

    commodityPortfolio: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => { sums[r.item] = (sums[r.item] || 0) + (Number(r.quantity_kg) || 0); });
            const items = Object.keys(sums).map((k) => ({ item: k, quantity_kg: sums[k] }));
            const total_quantity_kg = items.reduce((s, it) => s + it.quantity_kg, 0);
            items.sort((a, b) => b.quantity_kg - a.quantity_kg);
            const commodities = items.slice(0, 20).map((it, idx) => ({ rank: idx + 1, item: it.item, quantity_kg: it.quantity_kg, share_pct: total_quantity_kg ? +(it.quantity_kg / total_quantity_kg * 100).toFixed(1) : 0 }));
            return res.json({ total_quantity_kg, commodities });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch commodity portfolio', error: error.message });
        }
    },

    topImporters: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => { sums[r.importer_norm] = (sums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const arr = Object.keys(sums).map((k) => ({ importer: k, quantity_kg: sums[k] }));
            arr.sort((a, b) => b.quantity_kg - a.quantity_kg);
            const limit = Number(req.query.limit) || 10;
            const importers = arr.slice(0, limit).map((it, idx) => ({ rank: idx + 1, importer: it.importer, quantity_kg: it.quantity_kg }));
            return res.json({ importers });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch top importers', error: error.message });
        }
    },

    topExporters: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => { sums[r.exporter_norm] = (sums[r.exporter_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const arr = Object.keys(sums).map((k) => ({ exporter: k, quantity_kg: sums[k] }));
            arr.sort((a, b) => b.quantity_kg - a.quantity_kg);
            const limit = Number(req.query.limit) || 10;
            const exporters = arr.slice(0, limit).map((it, idx) => ({ rank: idx + 1, exporter: it.exporter, quantity_kg: it.quantity_kg }));
            return res.json({ exporters });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch top exporters', error: error.message });
        }
    },

    shipments: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sort_by = req.query.sort_by || 'date_orig';
            const sort_dir = req.query.sort_dir === 'asc' ? 1 : -1;
            const sorted = [...rows].sort((a, b) => {
                if (!a[sort_by]) return -1 * sort_dir;
                if (!b[sort_by]) return 1 * sort_dir;
                if (a[sort_by] < b[sort_by]) return -1 * sort_dir;
                if (a[sort_by] > b[sort_by]) return 1 * sort_dir;
                return 0;
            });
            const page = Number(req.query.page) || 1;
            const page_size = Number(req.query.page_size) || 50;
            const paged = objectPaginate(sorted, page, page_size);
            paged.records = paged.records.map((r) => ({ date: r.date_orig, item: r.item, exporter: r.exporter_norm, exporter_country: r.exporter_country, importer: r.importer_norm, quantity_kg: r.quantity_kg, unit_price_usd: r.unit_price_usd, total_value_usd: r.total_value_usd }));
            return res.json(paged);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch shipments', error: error.message });
        }
    },

    exportExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Report');
            ws.columns = [
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Item', key: 'item', width: 40 },
                { header: 'Exporter', key: 'exporter', width: 30 },
                { header: 'Exporter Country', key: 'exporter_country', width: 20 },
                { header: 'Importer', key: 'importer', width: 30 },
                { header: 'Quantity KG', key: 'quantity_kg', width: 14 },
                { header: 'Unit Price USD', key: 'unit_price_usd', width: 14 },
                { header: 'Total Value USD', key: 'total_value_usd', width: 16 },
            ];
            rows.forEach((r) => ws.addRow({ date: r.date_orig, item: r.item, exporter: r.exporter_norm, exporter_country: r.exporter_country, importer: r.importer_norm, quantity_kg: r.quantity_kg, unit_price_usd: r.unit_price_usd, total_value_usd: r.total_value_usd }));
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export excel', error: error.message });
        }
    },

    exportOverviewExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const payload = buildOverviewPayload(rows);
            await writeOverviewExcel(res, 'overview_report.xlsx', payload);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export overview report', error: error.message });
        }
    },

    exportOverviewPDF: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const payload = buildOverviewPayload(rows);
            writeOverviewPdf(res, 'overview_report.pdf', payload);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export overview report', error: error.message });
        }
    },

    exportMarketIntelExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 20;
            const reportRows = buildCommodityPortfolioRows(rows, limit);
            await writeExportExcel(res, 'market_intel_report.xlsx', [
                { header: 'Rank', key: 'rank', width: 10 },
                { header: 'Item', key: 'item', width: 36 },
                { header: 'Quantity (KG)', key: 'quantity_kg', width: 18 },
                { header: 'Share %', key: 'share_pct', width: 12 },
            ], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export market intel report', error: error.message });
        }
    },

    exportMarketIntelPDF: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 20;
            const reportRows = buildCommodityPortfolioRows(rows, limit);
            writeExportPdf(res, 'market_intel_report.pdf', 'Market Intel Report', ['rank', 'item', 'quantity_kg', 'share_pct'], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export market intel report', error: error.message });
        }
    },

    exportStrategicExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildMomentumRows(rows, limit);
            await writeExportExcel(res, 'strategic_report.xlsx', [
                { header: 'Rank', key: 'rank', width: 10 },
                { header: 'Item', key: 'item', width: 36 },
                { header: 'Dec Volume (KG)', key: 'dec_volume_kg', width: 18 },
                { header: 'Vol Increase (KG)', key: 'vol_increase_kg', width: 18 },
                { header: 'Growth %', key: 'growth_pct', width: 12 },
            ], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export strategic report', error: error.message });
        }
    },

    exportStrategicPDF: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildMomentumRows(rows, limit);
            writeExportPdf(res, 'strategic_report.pdf', 'Strategic Report', ['rank', 'item', 'dec_volume_kg', 'vol_increase_kg', 'growth_pct'], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export strategic report', error: error.message });
        }
    },

    exportItemExporterExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildTopExportersRows(rows, limit);
            await writeExportExcel(res, 'item_exporter_report.xlsx', [
                { header: 'Rank', key: 'rank', width: 10 },
                { header: 'Exporter', key: 'exporter', width: 40 },
                { header: 'Quantity (KG)', key: 'quantity_kg', width: 18 },
            ], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export item-exporter report', error: error.message });
        }
    },

    exportItemExporterPDF: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildTopExportersRows(rows, limit);
            writeExportPdf(res, 'item_exporter_report.pdf', 'Item Exporter Report', ['rank', 'exporter', 'quantity_kg'], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export item-exporter report', error: error.message });
        }
    },

    exportItemImporterExcel: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildTopImportersRows(rows, limit);
            await writeExportExcel(res, 'item_importer_report.xlsx', [
                { header: 'Rank', key: 'rank', width: 10 },
                { header: 'Importer', key: 'importer', width: 40 },
                { header: 'Quantity (KG)', key: 'quantity_kg', width: 18 },
            ], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export item-importer report', error: error.message });
        }
    },

    exportItemImporterPDF: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const limit = Number(req.query.limit) || 10;
            const reportRows = buildTopImportersRows(rows, limit);
            writeExportPdf(res, 'item_importer_report.pdf', 'Item Importer Report', ['rank', 'importer', 'quantity_kg'], reportRows);
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to export item-importer report', error: error.message });
        }
    },

    pricePulse: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const sums = {};
            rows.forEach((r) => { sums[r.importer_norm] = (sums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const topImporters = Object.keys(sums).sort((a, b) => sums[b] - sums[a]).slice(0, 5);
            const series = topImporters.map((imp) => {
                const prices = months.map((_, mi) => {
                    const vals = rows.filter((r) => r.importer_norm === imp && r.month === mi + 1).map((r) => r.unit_price_usd).filter((v) => v || v === 0);
                    if (!vals.length) return null;
                    return +(vals.reduce((s, x) => s + Number(x), 0) / vals.length).toFixed(2);
                });
                return { importer: imp, prices };
            });
            return res.json({ months, series });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch price pulse', error: error.message });
        }
    },

    importerShare: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => { sums[r.importer_norm] = (sums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const total = Object.values(sums).reduce((s, v) => s + v, 0) || 1;
            const arr = Object.keys(sums).map((k) => ({ importer: k, quantity_kg: sums[k], share_pct: +(sums[k] / total * 100).toFixed(1) }));
            arr.sort((a, b) => b.quantity_kg - a.quantity_kg);
            return res.json({ importers: arr.slice(0, 20) });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch importer share', error: error.message });
        }
    },

    originMonthly: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const originSums = {};
            rows.forEach((r) => {
                const c = r.exporter_country || 'UNKNOWN';
                originSums[c] = originSums[c] || Array(12).fill(0);
                if (r.month) originSums[c][r.month - 1] += Number(r.quantity_kg) || 0;
            });
            const origins = Object.keys(originSums).map((c) => ({ country: c, monthly_kg: originSums[c] }));
            origins.sort((a, b) => b.monthly_kg.reduce((s, x) => s + x, 0) - a.monthly_kg.reduce((s, x) => s + x, 0));
            return res.json({ months, origins: origins.slice(0, 6) });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch origin monthly', error: error.message });
        }
    },

    monthlyPulse: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const totals = Array(12).fill(0);
            rows.forEach((r) => { if (r.month) totals[r.month - 1] += Number(r.quantity_kg) || 0; });
            return res.json({ months, total_kg: totals });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch monthly pulse', error: error.message });
        }
    },

    momentum: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const jan = rows.filter((r) => r.month === 1);
            const dec = rows.filter((r) => r.month === 12);
            const janSums = {};
            const decSums = {};
            jan.forEach((r) => { janSums[r.item] = (janSums[r.item] || 0) + (Number(r.quantity_kg) || 0); });
            dec.forEach((r) => { decSums[r.item] = (decSums[r.item] || 0) + (Number(r.quantity_kg) || 0); });
            const products = Object.keys({ ...janSums, ...decSums }).map((item) => {
                const j = janSums[item] || 0;
                const d = decSums[item] || 0;
                const inc = d - j;
                const growth = j === 0 && d > 0 ? 100 : j === 0 && d === 0 ? 0 : Math.round((inc / j) * 100);
                return { item, jan_volume_kg: j, dec_volume_kg: d, vol_increase_kg: inc, growth_pct: growth };
            });
            products.sort((a, b) => b.vol_increase_kg - a.vol_increase_kg);
            return res.json({ products: products.slice(0, 10).map((p, idx) => ({ rank: idx + 1, ...p })) });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch momentum', error: error.message });
        }
    },

    hhi: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => { sums[r.importer_norm] = (sums[r.importer_norm] || 0) + (Number(r.quantity_kg) || 0); });
            const total = Object.values(sums).reduce((s, v) => s + v, 0) || 1;
            let hhi = 0;
            Object.values(sums).forEach((v) => { const s = v / total; hhi += (s * 100) * (s * 100); });
            hhi = Math.round(hhi);

            let label = 'Fragmented Market';
            if (hhi < 1500) label = 'Fragmented Market';
            else if (hhi < 2500) label = 'Moderately Concentrated';
            else label = 'Highly Concentrated';

            const interpretation = label === 'Fragmented Market'
                ? 'HHI below 1500 indicates a highly fragmented, competitive import market.'
                : 'HHI indicates concentration level.';

            return res.json({ hhi, label, interpretation });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch hhi', error: error.message });
        }
    },

    partnerLoyalty: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const pairs = {};
            rows.forEach((r) => {
                const key = `${r.importer_norm}||${r.exporter_norm}`;
                pairs[key] = pairs[key] || { importer: r.importer_norm, exporter: r.exporter_norm, quantity_kg: 0, shipments: 0 };
                pairs[key].quantity_kg += Number(r.quantity_kg) || 0;
                pairs[key].shipments += 1;
            });
            const arr = Object.values(pairs)
                .sort((a, b) => b.quantity_kg - a.quantity_kg)
                .slice(0, Number(req.query.limit) || 5)
                .map((p, idx) => ({ rank: idx + 1, ...p }));
            return res.json({ pairs: arr });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch partner loyalty', error: error.message });
        }
    },

    topPorts: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const ports = {};
            rows.forEach((r) => {
                const p = r.exporter_port || 'UNKNOWN';
                ports[p] = ports[p] || { port: p, country: r.exporter_country, quantity_kg: 0 };
                ports[p].quantity_kg += Number(r.quantity_kg) || 0;
            });
            const arr = Object.values(ports)
                .sort((a, b) => b.quantity_kg - a.quantity_kg)
                .slice(0, Number(req.query.limit) || 5)
                .map((p, idx) => ({ rank: idx + 1, ...p }));
            return res.json({ ports: arr });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch top ports', error: error.message });
        }
    },

    hsCodeShare: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const sums = {};
            rows.forEach((r) => {
                const k = r.hs_code || 'UNKNOWN';
                sums[k] = (sums[k] || 0) + (Number(r.quantity_kg) || 0);
            });
            const total = Object.values(sums).reduce((s, v) => s + v, 0) || 1;
            const arr = Object.keys(sums).map((k) => ({ hs_code: k, label: k, quantity_kg: sums[k], share_pct: +(sums[k] / total * 100).toFixed(1) }));
            arr.sort((a, b) => b.quantity_kg - a.quantity_kg);
            return res.json({ hs_codes: arr });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch hs code share', error: error.message });
        }
    },

    itemExporterProducts: async (req, res) => {
        try {
            const rows = await fetchRows(req, res);
            if (!rows) return;

            const products = Array.from(new Set(rows.map((r) => r.item).filter(Boolean))).sort();
            return res.json({ products });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch item-exporter products', error: error.message });
        }
    },

    itemExporter: async (req, res) => {
        try {
            const product = req.query.product;
            if (!product) return res.status(400).json({ success: false, message: 'product required' });
            const rows = await fetchRows(req, res, { productRequired: product });
            if (!rows) return;

            const exporters = {};
            rows.forEach((r) => {
                const k = r.exporter_norm;
                exporters[k] = exporters[k] || { exporter: k, exporter_country: r.exporter_country, client_map: {} };
                const client = r.importer_norm;
                exporters[k].client_map[client] = exporters[k].client_map[client] || { importer: client, shipments: 0, quantity_kg: 0 };
                exporters[k].client_map[client].shipments += 1;
                exporters[k].client_map[client].quantity_kg += Number(r.quantity_kg) || 0;
            });
            const arr = Object.values(exporters).map((e) => ({ exporter: e.exporter, exporter_country: e.exporter_country, client_count: Object.keys(e.client_map).length, clients: Object.values(e.client_map) }));
            const page = Number(req.query.page) || 1;
            const page_size = Number(req.query.page_size) || 20;
            const start = (page - 1) * page_size;
            return res.json({ product, total_exporters: arr.length, page, page_size, exporters: arr.slice(start, start + page_size) });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch item exporter', error: error.message });
        }
    },

    itemImporter: async (req, res) => {
        try {
            const product = req.query.product;
            if (!product) return res.status(400).json({ success: false, message: 'product required' });
            const rows = await fetchRows(req, res, { productRequired: product });
            if (!rows) return;

            const importers = {};
            rows.forEach((r) => {
                const k = r.importer_norm;
                importers[k] = importers[k] || { importer: k, supplier_map: {} };
                const sup = r.exporter_norm;
                importers[k].supplier_map[sup] = importers[k].supplier_map[sup] || { exporter: sup, exporter_country: r.exporter_country, shipments: 0, quantity_kg: 0 };
                importers[k].supplier_map[sup].shipments += 1;
                importers[k].supplier_map[sup].quantity_kg += Number(r.quantity_kg) || 0;
            });
            const arr = Object.values(importers).map((i) => ({ importer: i.importer, supplier_count: Object.keys(i.supplier_map).length, suppliers: Object.values(i.supplier_map) }));
            const page = Number(req.query.page) || 1;
            const page_size = Number(req.query.page_size) || 20;
            const start = (page - 1) * page_size;
            return res.json({ product, total_importers: arr.length, page, page_size, importers: arr.slice(start, start + page_size) });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Failed to fetch item importer', error: error.message });
        }
    },
};

export default AiController;
