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

const DashboardController = {
  getStats: async (req, res) => {
    try {
      const sql = req.sql;
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const fileStatusResult = await sql`
        SELECT
          COUNT(*) as total_files,
          COUNT(*) FILTER (WHERE status = 'success') as success_files,
          COUNT(*) FILTER (WHERE status <> 'success') as failed_files
        FROM uploaded_file
        WHERE company_id = ${companyId}
      `;
      const recordsProcessedResult = await sql`
        SELECT COUNT(*) as count
        FROM trade_fact
        WHERE company_id = ${companyId}
      `;

      const statusRow = fileStatusResult[0] || {};
      const totalFiles = Number(statusRow.total_files || 0);
      const successFiles = Number(statusRow.success_files || 0);
      const failedFiles = Number(statusRow.failed_files || 0);

      const filesUploaded = totalFiles; // total files seen for this company
      const recordsProcessed = Number(recordsProcessedResult[0]?.count || 0);
      const successRate =
        totalFiles > 0 ? Math.round((successFiles / totalFiles) * 100) : 0;
      const errors = failedFiles;

      res.json({
        success: true,
        data: { filesUploaded, recordsProcessed, successRate, errors },
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch stats",
          error: error.message,
        });
    }
  },
  getActivity: async (req, res) => {
    try {
      const sql = req.sql;
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const filesActivity = await sql`
        SELECT
          DATE_TRUNC('week', created_at) as week,
          COUNT(*) as files_uploaded,
          COUNT(*) FILTER (WHERE status = 'success') as success_files,
          COUNT(*) FILTER (WHERE status <> 'success') as failed_files
        FROM uploaded_file
        WHERE company_id = ${companyId}
        GROUP BY week
        ORDER BY week DESC
        LIMIT 10
      `;
      const recordsActivity = await sql`
        SELECT DATE_TRUNC('week', period_date) as week, COUNT(*) as records_processed
        FROM trade_fact
        WHERE company_id = ${companyId}
        GROUP BY week
        ORDER BY week DESC
        LIMIT 10
      `;

      const activityMap = new Map();
      filesActivity.forEach((row) => {
        const week = row.week.toISOString().split("T")[0];
        const totalFilesWeek = Number(row.files_uploaded || 0);
        const successFilesWeek = Number(row.success_files || 0);
        const successRateWeek =
          totalFilesWeek > 0
            ? Math.round((successFilesWeek / totalFilesWeek) * 100)
            : null;

        activityMap.set(week, {
          week,
          filesUploaded: totalFilesWeek,
          recordsProcessed: 0,
          successRate: successRateWeek,
        });
      });
      recordsActivity.forEach((row) => {
        const week = row.week.toISOString().split("T")[0];
        if (activityMap.has(week)) {
          activityMap.get(week).recordsProcessed = Number(
            row.records_processed || 0,
          );
        } else {
          activityMap.set(week, {
            week,
            filesUploaded: 0,
            recordsProcessed: Number(row.records_processed || 0),
            successRate: null,
          });
        }
      });

      const activity = Array.from(activityMap.values()).sort(
        (a, b) => new Date(b.week) - new Date(a.week),
      );

      let totalFilesUploaded = 0;
      let totalRecordsProcessed = 0;
      activity.forEach((row) => {
        totalFilesUploaded += row.filesUploaded;
        totalRecordsProcessed += row.recordsProcessed;
      });

      const averageWeeklyRecords =
        activity.length > 0
          ? Math.round(totalRecordsProcessed / activity.length)
          : 0;

      const currentWeek = activity[0] || null;

      res.json({
        success: true,
        data: activity,
        summary: {
          totalFilesUploaded,
          totalRecordsProcessed,
          averageWeeklyRecords,
          currentWeek,
        },
      });
    } catch (error) {
      console.error("Error fetching activity:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch activity",
          error: error.message,
        });
    }
  },
  getSummary: async (req, res) => {
    try {
      const sql = req.sql;
      const companyId = requireCompany(req, res);
      if (!companyId) return;

      const summaryResult = await sql`
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT origin_country_id) as unique_origins,
          COUNT(DISTINCT TRIM(item_name)) as unique_items,
          COUNT(DISTINCT TRIM(importer_name)) as unique_importers
        FROM trade_fact
        WHERE company_id = ${companyId}
      `;
      const summary = summaryResult[0] || {};

      res.json({
        success: true,
        data: {
          totalRecords: Number(summary.total_records || 0),
          uniqueOrigins: Number(summary.unique_origins || 0),
          uniqueItems: Number(summary.unique_items || 0),
          uniqueImporters: Number(summary.unique_importers || 0),
        },
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch summary",
          error: error.message,
        });
    }
  },
};

export default DashboardController;
