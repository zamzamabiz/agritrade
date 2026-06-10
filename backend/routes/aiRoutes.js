import express from 'express';
import AiController from '../controllers/aiReportController.js';

const router = express.Router();

// File upload (multipart)
router.post('/upload', AiController.upload);

// Stats
router.get('/stats', AiController.stats);

// Dashboard
router.get('/dashboard/commodity-portfolio', AiController.commodityPortfolio);
router.get('/dashboard/top-importers', AiController.topImporters);
router.get('/dashboard/top-exporters', AiController.topExporters);
router.get('/dashboard/shipments', AiController.shipments);
router.get('/dashboard/export-excel', AiController.exportExcel);

// Advanced report exports
router.get('/export/market-intel/excel', AiController.exportMarketIntelExcel);
router.get('/export/market-intel/pdf', AiController.exportMarketIntelPDF);
router.get('/export/strategic/excel', AiController.exportStrategicExcel);
router.get('/export/strategic/pdf', AiController.exportStrategicPDF);
router.get('/export/item-exporter/excel', AiController.exportItemExporterExcel);
router.get('/export/item-exporter/pdf', AiController.exportItemExporterPDF);
router.get('/export/item-importer/excel', AiController.exportItemImporterExcel);
router.get('/export/item-importer/pdf', AiController.exportItemImporterPDF);

// Market intel
router.get('/market-intel/price-pulse', AiController.pricePulse);
router.get('/market-intel/importer-share', AiController.importerShare);
router.get('/market-intel/origin-monthly', AiController.originMonthly);
router.get('/market-intel/monthly-pulse', AiController.monthlyPulse);

// Strategic
router.get('/strategic/momentum', AiController.momentum);
router.get('/strategic/hhi', AiController.hhi);
router.get('/strategic/partner-loyalty', AiController.partnerLoyalty);
router.get('/strategic/top-ports', AiController.topPorts);
router.get('/strategic/hs-code-share', AiController.hsCodeShare);

// Item > exporter/importer
router.get('/item-exporter/products', AiController.itemExporterProducts);
router.get('/item-exporter', AiController.itemExporter);
router.get('/item-importer', AiController.itemImporter);

export default router;
