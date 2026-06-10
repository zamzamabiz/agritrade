import express from 'express';
import DataController from '../controllers/dataController.js';

const router = express.Router();

// GET /api/data/records - Get all imported records with pagination
router.get('/records', DataController.getRecords);

// GET /api/data/name-clusters - Get name clusters
router.get('/name-clusters', DataController.getNameClusters);

// POST /api/data/merge-names - Merge secondary names into primary
router.post('/merge-names', DataController.mergeNames);

// GET /api/data/records/:id - Get single record details
router.get('/records/:id', DataController.getRecordById);

// PUT /api/data/records/:id - Update a record
router.put('/records/:id', DataController.updateRecord);

// DELETE /api/data/records/:id - Delete a record
router.delete('/records/:id', DataController.deleteRecord);

export default router;