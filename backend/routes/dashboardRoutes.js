
import express from 'express';
import DashboardController from '../controllers/dashboardController.js';
const router = express.Router();

router.get('/stats', DashboardController.getStats);
router.get('/activity', DashboardController.getActivity);
router.get('/summary', DashboardController.getSummary);

export default router;
