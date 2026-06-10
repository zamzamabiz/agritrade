import { v4 as uuidv4 } from "uuid";
import { Worker, QueueEvents } from "bullmq";
import ExcelParser from "./utils/excelParser.js";
import sql from "./config/database.js";
import {
  ensurePartition,
  getOrCreateCountryId,
} from "./utils/helpers.js";

const BATCH_SIZE = 500;

const worker = new Worker(
  "excel-upload",
  async (job) => {
    const {
      uploadId,
      fileBuffer,
      originalFilename,
      companyId,
      tradeType,
      chapterId,
      periodDate,
      checksum,
      userId,
    } = job.data;
    
    if (!uploadId) {
      throw new Error("Missing uploadId in job data");
    }
    
    try {
      // Milestone: file received
      await job.updateProgress({ percent: 20, stage: "received", inserted: 0, total: 0, rawCount: 0, validCount: 0 });
      // Parse Excel from buffer
      const parsedRows = await ExcelParser.parseBuffer(
        fileBuffer,
        originalFilename,
      );
      const validation = ExcelParser.validateData(parsedRows, periodDate);
      // Milestone: parsing done
      await job.updateProgress({
        percent: 50,
        stage: "parsed",
        inserted: 0,
        total: validation.validCount || 0,
        rawCount: validation.totalRecords || parsedRows.length,
        validCount: validation.validCount || 0,
      });
      if (validation.validCount === 0) {
        await job.updateProgress({
          status: "failed",
          error: "No valid records found",
          rawCount: validation.totalRecords || parsedRows.length,
          validCount: validation.validCount || 0,
        });
        return;
      }
      // Prepare rows
      const validRows = validation.validRecords.map((row) => {
        const rawHs = row.hs_code ? row.hs_code.toString() : "";
        row.hs_code = rawHs || null;
        const rowDate = row.date ? new Date(row.date) : null;
        const safeDate =
          rowDate && !Number.isNaN(rowDate.getTime()) ? rowDate : periodDate;
        row._period_date = safeDate;
        return row;
      });
      // Begin transaction
      await sql.begin(async (tx) => {
        // Check if this uploadId already exists (for retry scenarios)
        const existingUpload = await tx`
          SELECT id FROM uploaded_file WHERE upload_id = ${uploadId} LIMIT 1
        `;
        
        let fileRowId;
        if (existingUpload.length > 0) {
          // Reuse existing record - just skip the insert
          fileRowId = existingUpload[0].id;
          console.log(`✅ [UPLOAD ${uploadId}] Reusing existing upload record ID: ${fileRowId} (retry detected)`);
          
          // Delete any partial records from failed attempts
          const deletedCount = await tx`DELETE FROM trade_fact WHERE uploaded_file_id = ${fileRowId}`;
          console.log(`🗑️  [UPLOAD ${uploadId}] Cleaned up ${deletedCount.count || 0} partial records from previous attempt`);
        } else {
          console.log(`📝 [UPLOAD ${uploadId}] Creating new upload record`);
          // Ensure partitions
          const partitionMonths = new Set();
          for (const r of validRows) {
            const d = r._period_date || periodDate;
            const monthStart = new Date(
              Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
            );
            partitionMonths.add(monthStart.toISOString().slice(0, 10));
          }
          for (const month of partitionMonths) {
            await ensurePartition(tx, month);
          }
          
          // Insert uploaded_file stub (processing)
          const [fileRow] = await tx`
          INSERT INTO uploaded_file (upload_id, company_id, trade_type, chapter_id, period_date, original_filename, row_count, checksum, status)
          VALUES (${uploadId}, ${companyId}, ${tradeType}, ${chapterId}, ${periodDate}, ${originalFilename}, ${validRows.length}, ${checksum}, 'processing')
          RETURNING id
        `;
          fileRowId = fileRow.id;
          console.log(`✔️  [UPLOAD ${uploadId}] Record created with ID: ${fileRowId}`);
        }
        // Prepare fact rows
        const factRows = [];
        for (const row of validRows) {
          const countryId = await getOrCreateCountryId(tx, row.origin);
          factRows.push({
            upload_id: uploadId,
            company_id: companyId,
            trade_type: tradeType,
            chapter_id: chapterId,
            hs_code: row.hs_code ? row.hs_code.toString().trim() : null,
            item_name: row.item,
            item_description: row.item_description || null,
            ntn: row.ntn || null,
            origin_country_id: countryId,
            port_of_shipment: row.port_of_shipment || null,
            importer_name: row.importer_pak || null,
            uom: row.uom || null,
            agent_name: row.agent_name || null,
            agent_number: row.agent_number || null,
            terminal_sheds: row.terminal_sheds || null,
            exporter_name: row.exporter_overseas || row.supplier_name || null,
            period_date: row._period_date || periodDate,
            quantity: row.quantity || null,
            value_usd: row.value_usd || null,
            uploaded_file_id: fileRowId,
            created_at: new Date(),
          });
        }
        // Bulk insert in chunks
        let inserted = 0;
        await job.updateProgress({
          percent: 75,
          stage: "inserting",
          inserted: 0,
          total: factRows.length,
          rawCount: validation.totalRecords || parsedRows.length,
          validCount: validation.validCount || factRows.length,
        });
        for (let i = 0; i < factRows.length; i += BATCH_SIZE) {
          const batch = factRows.slice(i, i + BATCH_SIZE);
          await tx`INSERT INTO trade_fact ${tx(batch)}`;
          inserted += batch.length;
          // Map insert progress from 60 -> 94
          const pct = 70 + Math.min(94 - 70, Math.round((inserted / factRows.length) * 25));
          await job.updateProgress({
            percent: pct,
            stage: "inserting",
            inserted,
            total: factRows.length,
            rawCount: validation.totalRecords || parsedRows.length,
            validCount: validation.validCount || factRows.length,
          });
        }

        await tx`
        UPDATE uploaded_file
        SET status = 'success'
        WHERE id = ${fileRowId}
      `;
      });
      await job.updateProgress({ status: "completed", percent: 100, stage: "completed", inserted: factRows.length, total: factRows.length, rawCount: validation.totalRecords || parsedRows.length, validCount: validation.validCount || factRows.length });
      // No file cleanup needed (buffer only)
    } catch (error) {
      await job.updateProgress({ status: "failed", error: error.message });
      throw error;
    }
  },
  {
    connection: { host: "127.0.0.1", port: 6379 },
    lockDuration: 300000, // 5 minutes - allows time for large file processing
    lockRenewTime: 60000, // Renew lock every 60 seconds
    concurrency: 2, // Process up to 2 jobs in parallel
    settings: {
      maxStalledCount: 3, // Max times a job can be stalled before failing
      stalledInterval: 5000, // Check for stalled jobs every 5 seconds
      maxRetriesPerLocalLock: 5, // Retry acquiring lock up to 5 times
    },
  },
);

const queueEvents = new QueueEvents("excel-upload", {
  connection: { host: "127.0.0.1", port: 6379 },
});
queueEvents.on("completed", ({ jobId }) => {
  console.log(`Job ${jobId} completed.`);
});
queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

console.log("Excel worker started.");
