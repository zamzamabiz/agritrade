import ExcelJS from 'exceljs';
import ExcelParser from '../utils/excelParser.js';
import { normalizeName } from '../utils/nameDedup.js';
import {
  computeChecksum,
  parseChapter,
  parsePeriodMonth,
  toTradeType,
} from "../utils/helpers.js";

const UploadController = {
  // POST /api/upload/clean-and-download - Clean and return processed Excel file
  cleanAndDownload: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      // Parse and clean data
      const parsedRows = await ExcelParser.parseBuffer(req.file.buffer, req.file.originalname);
      // Normalize names (importer/exporter/agent)
      const cleanedRows = parsedRows.map(row => {
        if (row.importer_name) row.importer_name = normalizeName(row.importer_name);
        if (row.exporter_name) row.exporter_name = normalizeName(row.exporter_name);
        if (row.agent_name) row.agent_name = normalizeName(row.agent_name);
        return row;
      });
      if (cleanedRows.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid data rows found' });
      }
      // Determine output format: csv or excel (xlsx/xls)
      const format = (req.query.format || req.headers.accept || '').toLowerCase();
      if (format.includes('csv')) {
        // CSV output
        const headers = Object.keys(cleanedRows[0]);
        const csvRows = [headers.join(',')];
        for (const row of cleanedRows) {
          csvRows.push(headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            // Escape quotes and commas
            const s = String(val).replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
          }).join(','));
        }
        const csvContent = csvRows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="cleaned_${req.file.originalname.replace(/\.[^/.]+$/, "")}.csv"`);
        res.send(csvContent);
      } else {
        // Excel output (xlsx)
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cleaned Data');
        worksheet.columns = Object.keys(cleanedRows[0]).map(key => ({ header: key, key }));
        cleanedRows.forEach(row => worksheet.addRow(row));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cleaned_${req.file.originalname.replace(/\.[^/.]+$/, "")}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      console.error('Clean and download error:', error);
      res.status(500).json({ success: false, message: 'Failed to clean and download file', error: error.message });
    }
  },
  uploadExcel: async (req, res) => {
    try {
      const sql = req.sql;
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      if (!req.user || !req.user.companyId) {
        return res
          .status(401)
          .json({
            success: false,
            message: "Unauthorized: company context missing",
          });
      }

      // Required metadata from frontend
      const companyId = req.user.companyId;
      const tradeType = toTradeType(req.body.trade_type);
      const chapterId = parseChapter(req.body.chapter);
      const periodDate = parsePeriodMonth(req.body.period_month);

      if (!tradeType)
        return res
          .status(400)
          .json({
            success: false,
            message: "trade_type must be import/export",
          });
      if (!chapterId)
        return res
          .status(400)
          .json({ success: false, message: "chapter must be between 01-99" });
      if (!periodDate)
        return res
          .status(400)
          .json({ success: false, message: "period_month must be YYYY-MM" });

      const { Queue } = await import("bullmq");
      const checksum = computeChecksum(req.file.buffer);

      // dedupe: same company + trade_type + chapter + period + checksum already processed or processing
      const existing = await sql`
        SELECT id, status FROM uploaded_file
        WHERE company_id = ${companyId}
          AND trade_type = ${tradeType}
          AND chapter_id = ${chapterId}
          AND period_date = ${periodDate}
          AND checksum = ${checksum}
        LIMIT 1
      `;
      if (existing.length) {
        const status = existing[0].status?.toLowerCase();
        if (status === "success") {
          return res
            .status(409)
            .json({
              success: false,
              message: "Duplicate upload detected - file already processed successfully",
            });
        }
        if (status === "processing" || status === "pending" || status === "active") {
          return res
            .status(409)
            .json({
              success: false,
              message: "This file is already being processed. Please wait for it to complete.",
            });
        }
      }

      // Enqueue BullMQ job
      const queue = new Queue("excel-upload", {
        connection: { host: "127.0.0.1", port: 6379 },
      });
      
      // Generate uploadId here to ensure it's consistent across retries
      const { v4: uuidv4 } = await import("uuid");
      const uploadId = uuidv4();
      
      const job = await queue.add("processExcel", {
        uploadId,
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname,
        companyId,
        tradeType,
        chapterId,
        periodDate,
        checksum,
        userId: req.user.id,
      });

      // Respond immediately with jobId
      return res
        .status(202)
        .json({
          success: true,
          jobId: job.id,
          message: "Upload queued for processing",
        });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process upload",
        error: error.message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  },

  getUploadHistory: async (req, res) => {
    try {
      const sql = req.sql;
      const uploads = await sql`
        SELECT id, company_id, trade_type, chapter_id, period_date, row_count, status, created_at
        FROM uploaded_file
        ORDER BY created_at DESC
        LIMIT 200
      `;
      res.json({ success: true, data: uploads });
    } catch (error) {
      console.error("Error fetching upload history:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch upload history",
          error: error.message,
        });
    }
  },

  getUploadDetails: async (req, res) => {
    try {
      const sql = req.sql;
      const { id } = req.params;
      const uploadInfo =
        await sql`SELECT * FROM uploaded_file WHERE id = ${id} LIMIT 1`;
      if (!uploadInfo.length) {
        return res
          .status(404)
          .json({ success: false, message: "Upload not found" });
      }

      const records = await sql`
        SELECT tf.id,
               tf.item_name,
               tf.origin_country_id,
               c.name AS origin_country,
               tf.importer_name,
               tf.exporter_name,
               tf.quantity,
               tf.value_usd,
               tf.period_date
        FROM trade_fact tf
        LEFT JOIN country_dim c ON c.id = tf.origin_country_id
        WHERE tf.uploaded_file_id = ${id}
        ORDER BY tf.id
        LIMIT 200
      `;

      res.json({
        success: true,
        data: { upload: uploadInfo[0], records, totalRecords: records.length },
      });
    } catch (error) {
      console.error("Error fetching upload details:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch upload details",
          error: error.message,
        });
    }
  },

  // GET /api/upload/status/:jobId - Poll job status
  getJobStatus: async (req, res) => {
    try {
      const { jobId } = req.params;
      const { Queue, Job } = await import("bullmq");
      const queue = new Queue("excel-upload", {
        connection: { host: "127.0.0.1", port: 6379 },
      });
      const job = await queue.getJob(jobId);
      if (!job) {
        return res
          .status(404)
          .json({ success: false, message: "Job not found" });
      }
      const state = await job.getState();
      const progress = job.progress;
      const failedReason = job.failedReason;
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
      return res.status(200).json({
        success: true,
        jobId,
        state,
        progress,
        failedReason,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch job status",
          error: error.message,
        });
    }
  },

  deleteUpload: async (req, res) => {
    try {
      const sql = req.sql;
      const { id } = req.params;

      // Verify the upload record exists
      const uploadRecord = await sql`
        SELECT id, row_count FROM uploaded_file WHERE id = ${id} LIMIT 1
      `;

      if (!uploadRecord.length) {
        return res.status(404).json({
          success: false,
          message: "Upload record not found",
        });
      }

      const recordCount = uploadRecord[0].row_count || 0;

      // Delete all trade_fact records associated with this upload
      await sql`
        DELETE FROM trade_fact WHERE uploaded_file_id = ${id}
      `;

      // Delete the uploaded_file record
      await sql`
        DELETE FROM uploaded_file WHERE id = ${id}
      `;

      return res.json({
        success: true,
        message: `Upload deleted successfully. ${recordCount.toLocaleString()} records removed.`,
        deletedRecordCount: recordCount,
      });
    } catch (error) {
      console.error("Error deleting upload:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete upload",
        error: error.message,
      });
    }
  },

  getUploadStats: async (req, res) => {
    try {
      const sql = req.sql;
      const totalUploads =
        await sql`SELECT COUNT(*) AS count FROM uploaded_file`;
      const totalRecords = await sql`SELECT COUNT(*) AS count FROM trade_fact`;
      res.json({
        success: true,
        data: {
          totalUploads: Number(totalUploads[0]?.count || 0),
          totalRecords: Number(totalRecords[0]?.count || 0),
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch statistics",
          error: error.message,
        });
    }
  },

  getRecentUploads: async (req, res) => {
    try {
      const sql = req.sql;
      const data = await sql`
        SELECT uf.id AS uploaded_file_id, uf.original_filename, uf.created_at, uf.row_count, tf.item_name, tf.quantity
        FROM uploaded_file uf
        JOIN trade_fact tf ON tf.uploaded_file_id = uf.id
        ORDER BY uf.created_at DESC
        LIMIT 10
      `;
      res.json({ success: true, data });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch recent uploads",
          error: error.message,
        });
    }
  },
};

export default UploadController;
