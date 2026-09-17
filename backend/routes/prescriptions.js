const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('./auth');
const { logAudit } = require('../middleware/audit');

// POST /api/prescriptions - Create or Update prescription/consultation
router.post('/', authenticateToken, requireRole('Doctor'), (req, res) => {
  try {
    const { patient_token, patient_mobile, patient_name, age, symptoms, complaints, diagnosis, doctor_comment, items } = req.body;

    if (!patient_token) {
      return res.status(400).json({ success: false, message: 'Patient token is required.' });
    }

    if (!doctor_comment || !doctor_comment.trim()) {
      return res.status(400).json({ success: false, message: 'Doctor note is mandatory.' });
    }

    const safeItems = Array.isArray(items) ? items : [];

    // Check for existing pending prescription for the same token to update instead of erroring out
    const existingPending = db.prepare("SELECT id FROM prescriptions WHERE patient_token = ? AND status = 'Pending'").get(patient_token);

    db.exec('BEGIN TRANSACTION;');
    let prescriptionId = null;

    try {
      const doctorId = req.user ? req.user.id : null;
      const doctorName = req.user ? req.user.full_name : 'Dr. Specialist';

      if (existingPending) {
        // UPDATE existing pending prescription & consultation
        prescriptionId = existingPending.id;

        const updatePrescription = db.prepare(`
          UPDATE prescriptions 
          SET doctor_id = ?, doctor_name = ?, complaints = ?, diagnosis = ?, submission_status = 'Submitted'
          WHERE id = ?
        `);
        updatePrescription.run(
          doctorId,
          doctorName,
          complaints || symptoms || '',
          diagnosis || '',
          prescriptionId
        );

        // Update consultation record if exists, or insert if missing
        const existingConsultation = db.prepare('SELECT id FROM consultations WHERE prescription_id = ?').get(prescriptionId);
        if (existingConsultation) {
          const updateConsultation = db.prepare(`
            UPDATE consultations
            SET patient_name = ?, patient_mobile = ?, doctor_id = ?, age = ?, symptoms = ?, doctor_comment = ?
            WHERE prescription_id = ?
          `);
          updateConsultation.run(
            patient_name || '',
            patient_mobile || '',
            doctorId,
            parseInt(age) || 0,
            symptoms || complaints || '',
            doctor_comment.trim(),
            prescriptionId
          );
        } else {
          const insertConsultation = db.prepare(`
            INSERT INTO consultations (prescription_id, patient_token, patient_name, patient_mobile, doctor_id, age, symptoms, doctor_comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertConsultation.run(
            prescriptionId,
            patient_token,
            patient_name || '',
            patient_mobile || '',
            doctorId,
            parseInt(age) || 0,
            symptoms || complaints || '',
            doctor_comment.trim()
          );
        }

        // Clear existing items to be replaced with new items
        db.prepare('DELETE FROM prescription_items WHERE prescription_id = ?').run(prescriptionId);

      } else {
        // 1. Insert New Prescription Record with Doctor Details
        const insertPrescription = db.prepare(`
          INSERT INTO prescriptions (patient_token, patient_mobile, doctor_id, doctor_name, complaints, diagnosis, submission_status, status)
          VALUES (?, ?, ?, ?, ?, ?, 'Submitted', 'Pending')
        `);
        
        const pResult = insertPrescription.run(
          patient_token,
          patient_mobile || '',
          doctorId,
          doctorName,
          complaints || symptoms || '',
          diagnosis || ''
        );
        prescriptionId = pResult.lastInsertRowid;

        // 1.5. Insert Consultation Record
        const insertConsultation = db.prepare(`
          INSERT INTO consultations (prescription_id, patient_token, patient_name, patient_mobile, doctor_id, age, symptoms, doctor_comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertConsultation.run(
          prescriptionId,
          patient_token,
          patient_name || '',
          patient_mobile || '',
          doctorId,
          parseInt(age) || 0,
          symptoms || complaints || '',
          doctor_comment.trim()
        );
      }

      // 2. Insert Prescription Items if any
      if (safeItems.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO prescription_items (prescription_id, medicine_id, medicine_name, quantity, instructions)
          VALUES (?, ?, ?, ?, ?)
        `);

        const fallbackMed = db.prepare('SELECT id FROM medicines ORDER BY id ASC LIMIT 1').get();
        const fallbackMedId = fallbackMed ? fallbackMed.id : 1;

        for (const item of safeItems) {
          let validMedId = null;
          if (item.medicine_id) {
            const medExists = db.prepare('SELECT id FROM medicines WHERE id = ?').get(item.medicine_id);
            if (medExists) validMedId = item.medicine_id;
          }
          if (!validMedId && item.medicine_name) {
            const medByName = db.prepare('SELECT id FROM medicines WHERE name LIKE ?').get(`%${item.medicine_name.trim()}%`);
            if (medByName) validMedId = medByName.id;
          }

          insertItem.run(
            prescriptionId,
            validMedId || fallbackMedId,
            item.medicine_name || '',
            item.quantity || 1,
            item.instructions || ''
          );
        }
      }

      db.exec('COMMIT;');

      logAudit(req, req.user, 'CONSULTATION_SUBMIT', 'DOCTOR', 'Prescription', prescriptionId, `Doctor '${doctorName}' saved consultation for token #${patient_token}`);

      return res.json({ success: true, message: 'Prescription & Consultation saved successfully.', prescription_id: prescriptionId });
    } catch (txError) {
      db.exec('ROLLBACK;');
      console.error('Failed to save prescription:', txError);
      return res.status(500).json({ success: false, message: 'Failed to save prescription.' });
    }
  } catch (error) {
    console.error('Prescription POST error:', error);
    return res.status(500).json({ success: false, message: 'Server error while saving prescription.' });
  }
});

// GET /api/prescriptions/today - Fetch all pending prescriptions/consultations for today
router.get('/today', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch today's pending prescriptions along with consultation/patient info
    const stmt = db.prepare(`
      SELECT p.*, c.patient_name, c.age, c.symptoms, c.doctor_comment
      FROM prescriptions p
      LEFT JOIN consultations c ON p.id = c.prescription_id
      WHERE date(p.created_at) = ? AND p.status = 'Pending'
      ORDER BY p.id DESC
    `);
    
    const prescriptions = stmt.all(today);
    
    return res.json({
      success: true,
      prescriptions
    });
  } catch (error) {
    console.error('Prescriptions /today fetch error:', error);
    return res.status(500).json({ success: false, message: "Failed to fetch today's prescriptions." });
  }
});

// GET /api/prescriptions/patient/:identifier - Fetch pending prescription by token or mobile
router.get('/patient/:identifier', authenticateToken, (req, res) => {
  try {
    const identifier = req.params.identifier;
    
    // Find the pending prescription for the patient
    const stmt = db.prepare(`
      SELECT p.*, c.doctor_comment, COALESCE(c.patient_name, pat.patient_name) as patient_name, COALESCE(c.patient_mobile, pat.mobile, p.patient_mobile) as mobile
      FROM prescriptions p
      LEFT JOIN consultations c ON p.id = c.prescription_id
      LEFT JOIN patients pat ON p.patient_token = pat.token
      WHERE (p.patient_token = ? OR p.patient_mobile = ? OR pat.mobile = ? OR c.patient_mobile = ?) AND p.status = 'Pending'
      ORDER BY p.id DESC
      LIMIT 1
    `);
    
    const prescription = stmt.get(identifier, identifier, identifier, identifier);

    if (!prescription) {
      return res.json({ success: false, message: 'No pending prescription found for this patient.' });
    }

    // Fetch the prescription items
    const itemsStmt = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?');
    const items = itemsStmt.all(prescription.id);

    return res.json({
      success: true,
      prescription: {
        ...prescription,
        items
      }
    });
  } catch (error) {
    console.error('Prescription fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch prescription.' });
  }
});

module.exports = router;
