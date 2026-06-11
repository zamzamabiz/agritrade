import { mergeNames } from "../utils/nameMap.js";
import { getNameClusters } from "../utils/nameDedup.js";

class DataController {
  static async getNameClusters(req, res) {
    return getNameClusters(req, res);
  }
  
  static async mergeNames(req, res) {
    try {
      const sql = req.sql;
      const { type, primary, secondary } = req.body;
      if (!type || !primary || !Array.isArray(secondary)) {
        return res.status(400).json({ success: false, message: "type, primary, and secondary[] required" });
      }
      const result = await mergeNames({ sql, type, primary, secondary });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to merge names", error: error.message });
    }
  }

  static async getRecords(req, res) {
    try {
      const sql = req.sql;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = (page - 1) * limit;

      if (!req.user || !req.user.companyId) {
        return res
          .status(401)
          .json({
            success: false,
            message: "Unauthorized: company context missing",
          });
      }
      const companyId = req.user.companyId;

      // Get user's preferred columns (default to all if not set)
      let preferredColumns = null;
      try {
        const userId = req.user.id;
        const prefRes = await sql`SELECT preferred_columns FROM users WHERE id = ${userId}`;
        preferredColumns = JSON.parse(prefRes[0]?.preferred_columns || "[]");
      } catch (e) {
        preferredColumns = null;
      }
      // List of all possible columns (must match SELECT below)
      const allColumns = [
        "id",
        "trade_type",
        "hs_code",
        "item_name",
        "item_description",
        "ntn",
        "origin_country",
        "port_of_shipment",
        "importer_name",
        "uom",
        "agent_name",
        "agent_number",
        "terminal_sheds",
        "exporter_name",
        "period_date",
        "quantity",
        "value_usd",
      ];
      // Only use preferredColumns if it is a non-empty array; do not merge with allColumns
      let columnsToReturn = Array.isArray(preferredColumns) && preferredColumns.length > 0 ? preferredColumns : allColumns;
      const tradeType = req.query.trade_type
        ? String(req.query.trade_type).trim().toUpperCase()
        : null;
      const from = req.query.from || req.query.startDate;
      const to = req.query.to || req.query.endDate;
      const params = [companyId];
      const clauses = ["company_id = $1"];
      let p = params.length;

      if (from && to) {
        const fromIdx = ++p;
        const toIdx = ++p;
        params.push(from, to);
        clauses.push(`period_date >= $${fromIdx} AND period_date < (date_trunc('month', $${toIdx}::date) + INTERVAL '1 month')`);
      } else if (from) {
        const idx = ++p;
        params.push(from);
        clauses.push(`period_date >= $${idx}`);
      } else if (to) {
        const idx = ++p;
        params.push(to);
        clauses.push(`period_date < (date_trunc('month', $${idx}::date) + INTERVAL '1 month')`);
      }

      if (
        tradeType === "I" ||
        tradeType === "E" ||
        tradeType === "IMPORT" ||
        tradeType === "EXPORT"
      ) {
        params.push(tradeType[0]);
        p += 1;
        clauses.push(`trade_type = $${p}`);
      }

      if (req.query.chapter) {
        params.push(parseInt(req.query.chapter, 10));
        p += 1;
        clauses.push(`chapter_id = $${p}`);
      }
      if (req.query.origin_country_id) {
        params.push(parseInt(req.query.origin_country_id, 10));
        p += 1;
        clauses.push(`origin_country_id = $${p}`);
      }
      if (req.query.item) {
        params.push(`%${req.query.item}%`);
        p += 1;
        clauses.push(`item_name ILIKE $${p}`);
      }
      if (req.query.importer) {
        params.push(`%${req.query.importer}%`);
        p += 1;
        clauses.push(`importer_name ILIKE $${p}`);
      }
      if (req.query.exporter) {
        params.push(`%${req.query.exporter}%`);
        p += 1;
        clauses.push(`exporter_name ILIKE $${p}`);
      }

      if (req.query.search) {
        params.push(`%${req.query.search}%`);
        p += 1;
        const s = `$${p}`;
        clauses.push(
          `(hs_code ILIKE ${s} OR item_name ILIKE ${s} OR importer_name ILIKE ${s} OR exporter_name ILIKE ${s} OR c.name ILIKE ${s})`,
        );
      }

      const where = clauses.join(" AND ");

      // Sorting
      const sortBy = (req.query.sortBy || "").toLowerCase();
      const sortDirRaw = (req.query.sortDir || "").toLowerCase();
      const sortDir = sortDirRaw === "desc" ? "DESC" : "ASC";

      const sortFieldMap = {
        // direct table columns
        trade_type: "tf.trade_type",
        period_date: "tf.period_date",
        origin_country: "c.name",
        exporter_name: "tf.exporter_name",
        importer_name: "tf.importer_name",
        item_name: "tf.item_name",
        item_description: "tf.item_description",
        ntn: "tf.ntn",
        port_of_shipment: "tf.port_of_shipment",
        uom: "tf.uom",
        // text columns
        origin: "c.name",
        exporter: "tf.exporter_name",
        item: "tf.item_name",
        importer: "tf.importer_name",
        port: "tf.port_of_shipment",
        // numeric columns
        value: "tf.value_usd",
        value_usd: "tf.value_usd",
        quantity: "tf.quantity",
      };

      let orderBy = "tf.period_date DESC, tf.id DESC";
      if (sortBy && sortFieldMap[sortBy]) {
        orderBy = `${sortFieldMap[sortBy]} ${sortDir}, tf.id DESC`;
      }

      // Build SELECT clause dynamically
      const selectMap = {
        id: 'tf.id',
        trade_type: 'tf.trade_type',
        hs_code: 'tf.hs_code',
        item_name: 'tf.item_name',
        item_description: 'tf.item_description',
        ntn: 'tf.ntn',
        origin_country: 'c.name AS origin_country',
        port_of_shipment: 'tf.port_of_shipment',
        importer_name: 'tf.importer_name',
        uom: 'tf.uom',
        agent_name: 'tf.agent_name',
        agent_number: 'tf.agent_number',
        terminal_sheds: 'tf.terminal_sheds',
        exporter_name: 'tf.exporter_name',
        period_date: 'tf.period_date',
        quantity: 'tf.quantity',
        value_usd: 'tf.value_usd',
      };
      const selectClause = columnsToReturn.map(col => selectMap[col]).filter(Boolean).join(', ');
      const records = await sql.unsafe(
        `SELECT ${selectClause}
         FROM trade_fact tf
         LEFT JOIN country_dim c ON c.id = tf.origin_country_id
         WHERE ${where}
           ORDER BY ${orderBy}
         OFFSET $${p + 1}
         LIMIT $${p + 2}`,
        [...params, offset, limit],
      );

      const count = await sql.unsafe(
        `SELECT COUNT(*) AS count FROM trade_fact tf LEFT JOIN country_dim c ON c.id = tf.origin_country_id WHERE ${where}`,
        params,
      );

      const total = Number(count[0]?.count || 0);

      // filter value helpers scoped to company and date range (month/year only)
      const helperClauses = ["company_id = $1"];
      const helperParams = [companyId];
      let hp = helperParams.length;
      if (from) {
        helperParams.push(from);
        hp += 1;
        helperClauses.push(`period_date >= $${hp}`);
      }
      if (to) {
        helperParams.push(to);
        hp += 1;
        helperClauses.push(`period_date < (date_trunc('month', $${hp}::date) + INTERVAL '1 month')`);
      }
      const helperWhere = helperClauses.join(" AND ");

      const origins = await sql.unsafe(
        `SELECT DISTINCT c.name AS origin_country
         FROM trade_fact tf
         LEFT JOIN country_dim c ON c.id = tf.origin_country_id
         WHERE ${helperWhere} AND tf.origin_country_id IS NOT NULL`,
        helperParams,
      );
      const items = await sql.unsafe(
        `SELECT DISTINCT item_name FROM trade_fact WHERE ${helperWhere} AND item_name IS NOT NULL`,
        helperParams,
      );
      const importers = await sql.unsafe(
        `SELECT DISTINCT importer_name FROM trade_fact WHERE ${helperWhere} AND importer_name IS NOT NULL`,
        helperParams,
      );
      const exporters = await sql.unsafe(
        `SELECT DISTINCT exporter_name FROM trade_fact WHERE ${helperWhere} AND exporter_name IS NOT NULL`,
        helperParams,
      );

      // Always return 200, never 304
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      return res.status(200).json({
        success: true,
        data: {
          records: records.map((r) => {
            // Only include keys in columnsToReturn
            const filtered = {};
            for (const col of columnsToReturn) {
              if (Object.prototype.hasOwnProperty.call(r, col)) {
                filtered[col] = r[col];
              }
            }
            // Only map trade_type if present in columns
            if (columnsToReturn.includes('trade_type') && filtered.trade_type) {
              filtered.trade_type =
                filtered.trade_type === "I"
                  ? "IMPORT"
                  : filtered.trade_type === "E"
                    ? "EXPORT"
                    : filtered.trade_type;
            }
            return filtered;
          }),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
          filters: {
            origins: origins
              .map((o) => o.origin_country)
              .filter(Boolean)
              .sort(),
            items: items
              .map((i) => i.item_name)
              .filter(Boolean)
              .sort(),
            importers: importers
              .map((i) => i.importer_name)
              .filter(Boolean)
              .sort(),
            exporters: exporters
              .map((e) => e.exporter_name)
              .filter(Boolean)
              .sort(),
          },
          columns: columnsToReturn,
        },
      });
    } catch (error) {
      console.error("Error fetching records", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch records",
          error: error.message,
        });
    }
  }

  static async getRecordById(req, res) {
    try {
      const sql = req.sql;
      const record =
        await sql`SELECT * FROM trade_fact WHERE id = ${req.params.id} LIMIT 1`;
      if (!record.length)
        return res
          .status(404)
          .json({ success: false, message: "Record not found" });
      res.json({ success: true, data: record[0] });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch record",
          error: error.message,
        });
    }
  }

  static async updateRecord(req, res) {
    return res
      .status(405)
      .json({
        success: false,
        message: "Updates are not supported on fact data (append-only)",
      });
  }

  static async deleteRecord(req, res) {
    return res
      .status(405)
      .json({
        success: false,
        message: "Deletes are disabled for audit integrity",
      });
  }
}

export default DataController;
