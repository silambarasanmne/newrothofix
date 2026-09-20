const PatientModel = require('../models/patientModel');
const { logAudit } = require('../middleware/audit');

/**
 * Validate Patient Input Fields
 */
const validatePatientInput = ({ patient_name, age, gender, mobile, symptoms }) => {
  const errors = {};

  // Patient Name
  if (!patient_name || typeof patient_name !== 'string' || !patient_name.trim()) {
    errors.patient_name = 'Patient Name is required';
  } else if (patient_name.trim().length < 3) {
    errors.patient_name = 'Patient Name must be at least 3 characters long';
  } else if (!/^[a-zA-Z\s]+$/.test(patient_name.trim())) {
    errors.patient_name = 'Patient Name must contain alphabets and spaces only';
  }

  // Age
  if (age === undefined || age === null || age === '') {
    errors.age = 'Age is required';
  } else {
    const ageNum = Number(age);
    if (isNaN(ageNum) || !Number.isInteger(ageNum)) {
      errors.age = 'Age must be a valid whole number';
    } else if (ageNum < 0 || ageNum > 120) {
      errors.age = 'Age must be between 0 and 120';
    }
  }

  // Gender
  if (!gender || typeof gender !== 'string' || !['Male', 'Female', 'Other'].includes(gender.trim())) {
    errors.gender = 'Gender must be Male, Female, or Other';
  }

  // Mobile Number
  if (!mobile || typeof mobile !== 'string' || !mobile.trim()) {
    errors.mobile = 'Mobile Number is required';
  } else if (!/^\d{10}$/.test(mobile.trim())) {
    errors.mobile = 'Mobile Number must be exactly 10 digits';
  }

  // Symptoms / Issues
  if (!symptoms || typeof symptoms !== 'string' || !symptoms.trim()) {
    errors.symptoms = 'Issues / Symptoms is required';
  } else if (symptoms.trim().length < 5) {
    errors.symptoms = 'Issues / Symptoms must be at least 5 characters long';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Register Patient & Generate Token
 * POST /api/patients
 */
exports.registerPatient = (req, res) => {
  try {
    const { patient_name, age, gender = 'Male', mobile, symptoms } = req.body;

    const validation = validatePatientInput({ patient_name, age, gender, mobile, symptoms });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const newPatient = PatientModel.create({
      patient_name: patient_name.trim(),
      age: Number(age),
      gender: gender.trim(),
      mobile: mobile.trim(),
      symptoms: symptoms.trim()
    });

    logAudit(req, req.user, 'PATIENT_REGISTER', 'PATIENTS', 'Patient', newPatient.id, `Registered patient '${newPatient.patient_name}' with token #${newPatient.token}`);

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      token: newPatient.token,
      data: newPatient
    });
  } catch (error) {
    console.error('Error registering patient:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while registering patient',
      error: error.message
    });
  }
};

/**
 * Update Existing Patient Record
 * PUT /api/patients/:id
 */
exports.updatePatient = (req, res) => {
  try {
    const { id } = req.params;
    const { patient_name, age, gender = 'Male', mobile, symptoms } = req.body;

    const validation = validatePatientInput({ patient_name, age, gender, mobile, symptoms });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const updated = PatientModel.update(id, {
      patient_name: patient_name.trim(),
      age: Number(age),
      gender: gender.trim(),
      mobile: mobile.trim(),
      symptoms: symptoms.trim()
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Patient record not found' });
    }

    logAudit(req, req.user, 'PATIENT_UPDATE', 'PATIENTS', 'Patient', id, `Updated details for patient ID #${id}`);

    return res.status(200).json({
      success: true,
      message: 'Patient record updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating patient',
      error: error.message
    });
  }
};

/**
 * Delete Patient Record (ADMIN ONLY)
 * DELETE /api/patients/:id
 */
exports.deletePatient = (req, res) => {
  try {
    const { id } = req.params;

    // Strict check for Admin role
    if (!req.user || (req.user.role !== 'Admin / Billing Manager' && req.user.role !== 'Admin')) {
      logAudit(req, req.user, 'UNAUTHORIZED_ATTEMPT', 'PATIENTS', 'Patient', id, `Blocked non-admin user '${req.user ? req.user.username : 'Unknown'}' from deleting patient ID #${id}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Workers cannot delete patient records. Only Admin can delete patient records.'
      });
    }

    const deleted = PatientModel.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Patient record not found' });
    }

    logAudit(req, req.user, 'PATIENT_DELETE', 'PATIENTS', 'Patient', id, `Admin deleted patient record ID #${id}`);

    return res.status(200).json({
      success: true,
      message: 'Patient record deleted successfully by Admin'
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting patient',
      error: error.message
    });
  }
};

/**
 * Get All Patients with Pagination, Search, and Sorting
 * GET /api/patients
 */
exports.getPatients = (req, res) => {
  try {
    const { search, fromDate, toDate, date, page, limit, sortBy, order } = req.query;

    const result = PatientModel.findAll({
      search,
      fromDate,
      toDate,
      date,
      page,
      limit,
      sortBy,
      order
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching patients',
      error: error.message
    });
  }
};

/**
 * Get Patient by Token Number
 * GET /api/patients/:token
 */
exports.getPatientByToken = (req, res) => {
  try {
    let { token } = req.params;
    token = String(token).replace('#', '').trim();

    if (!token || isNaN(Number(token))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token number parameter'
      });
    }

    const patient = PatientModel.findByToken(token);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `No patient found with token #${token}`
      });
    }

    return res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Error fetching patient by token:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching patient record',
      error: error.message
    });
  }
};

/**
 * Get Patient by Internal ID
 * GET /api/patients/id/:id
 */
exports.getPatientById = (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID parameter'
      });
    }

    const patient = PatientModel.findById(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `No patient found with ID #${id}`
      });
    }

    return res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Error fetching patient by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching patient record',
      error: error.message
    });
  }
};

/**
 * Export All Registered Patient Records to CSV
 * GET /api/patients/export
 */
exports.exportPatientsCSV = (req, res) => {
  try {
    const { search, fromDate, toDate, date } = req.query;
    const patients = PatientModel.exportAll({ search, fromDate, toDate, date });

    // Generate CSV Header
    let csv = 'Token,Patient Name,Patient ID,Age,Gender,Mobile Number,Symptoms / Issues,Registration Date\n';

    // Generate CSV Rows with escaping
    patients.forEach(p => {
      const escapedName = `"${String(p.patient_name || '').replace(/"/g, '""')}"`;
      const escapedGender = `"${String(p.gender || 'Male').replace(/"/g, '""')}"`;
      const escapedMobile = `"${String(p.mobile || '').replace(/"/g, '""')}"`;
      const escapedSymptoms = `"${String(p.symptoms || '').replace(/"/g, '""')}"`;
      const dateStr = `"${String(p.created_at || '')}"`;
      
      csv += `${p.token},${escapedName},OP-${p.id},${p.age},${escapedGender},${escapedMobile},${escapedSymptoms},${dateStr}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Orthofix_Registered_Patient_Records.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting patient records CSV:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while exporting patient records',
      error: error.message
    });
  }
};

/**
 * Get Summary Stats for Dashboard
 * GET /api/stats
 */
exports.getStats = (req, res) => {
  try {
    const stats = PatientModel.getStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching stats',
      error: error.message
    });
  }
};

