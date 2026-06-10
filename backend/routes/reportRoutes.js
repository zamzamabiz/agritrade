import express from 'express';
import ReportController from '../controllers/reportController.js';

const router = express.Router();

// Trade-level exports
router.post('/export/excel', ReportController.exportReport);
router.post('/export/pdf', ReportController.exportReportPDF);

router.get('/item-wise/excel', ReportController.exportItemWiseExcel);
router.get('/item-wise/pdf', ReportController.exportItemWisePDF);

router.get('/importer-wise/excel', ReportController.exportImporterWiseExcel);
router.get('/importer-wise/pdf', ReportController.exportImporterWisePDF);

router.get('/exporter-wise/excel', ReportController.exportExporterWiseExcel);
router.get('/exporter-wise/pdf', ReportController.exportExporterWisePDF);

router.get('/country-wise/excel', ReportController.exportCountryWiseExcel);
router.get('/country-wise/pdf', ReportController.exportCountryWisePDF);

router.get('/agent-wise/excel', ReportController.exportAgentWiseExcel);
router.get('/agent-wise/pdf', ReportController.exportAgentWisePDF);

export default router;
