const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticateToken, requireAdmin, requireRole } = require('./auth');

// REST API endpoints
router.post('/patients', authenticateToken, requireRole('OP Worker'), patientController.registerPatient);
router.put('/patients/:id', authenticateToken, requireRole('OP Worker'), patientController.updatePatient);
router.delete('/patients/:id', authenticateToken, requireAdmin, patientController.deletePatient);
router.get('/patients/export', authenticateToken, patientController.exportPatientsCSV);
router.get('/patients', authenticateToken, patientController.getPatients);
router.get('/patients/id/:id', authenticateToken, patientController.getPatientById);
router.get('/patients/:token', authenticateToken, patientController.getPatientByToken);
router.get('/stats', authenticateToken, patientController.getStats);

module.exports = router;

