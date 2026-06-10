import express from 'express';
import UploadController from '../controllers/uploadController.js';
import { upload, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// POST /api/upload - Upload Excel/CSV files
router.post('/', upload.single('file'), handleUploadError, UploadController.uploadExcel);

// POST /api/upload/clean-and-download - Clean/process and return Excel file
router.post('/clean-and-download', upload.single('file'), handleUploadError, UploadController.cleanAndDownload);

// GET /api/upload/status/:jobId - Poll job status
router.get('/status/:jobId', UploadController.getJobStatus);

// GET /api/upload/history - Get upload history/logs
router.get('/history', UploadController.getUploadHistory);

// GET /api/upload/:id - Get details of specific upload
router.get('/:id', UploadController.getUploadDetails);

// DELETE /api/upload/:id - Delete an upload record
router.delete('/:id', UploadController.deleteUpload);

export default router;
