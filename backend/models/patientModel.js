const db = require('../database.js');

class PatientModel {
  /**
   * Create a new patient with auto-incrementing sequential token starting from 1
   */
  static create({ patient_name, age, mobile, symptoms }) {
    db.exec('BEGIN TRANSACTION');
    try {
      // Get max token for TODAY so token resets every day starting from 1
      const maxTokenRow = db.prepare(`
        SELECT COALESCE(MAX(token), 0) AS maxToken 
        FROM patients 
        WHERE DATE(created_at) = DATE('now', 'localtime')
      `).get();
      const nextToken = (maxTokenRow ? maxTokenRow.maxToken : 0) + 1;

      const stmt = db.prepare(`
        INSERT INTO patients (token, patient_name, age, mobile, symptoms)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(nextToken, patient_name, Number(age), mobile.trim(), symptoms.trim());

      const createdPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
      db.exec('COMMIT');
      return createdPatient;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Get paginated list of patients with search, sorting, and pagination
   */
  static findAll({ search = '', fromDate = '', toDate = '', date = '', page = 1, limit = 10, sortBy = 'created_at', order = 'DESC' } = {}) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Allowed sort fields for security
    const allowedSortFields = {
      'created_at': 'p.created_at',
      'token': 'p.token',
      'patient_name': 'p.patient_name',
      'age': 'p.age'
    };

    const sortColumn = allowedSortFields[sortBy] || 'p.created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereConditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      const isNumber = /^\d+$/.test(searchTerm);

      if (isNumber) {
        whereConditions.push('(p.token = ? OR p.mobile LIKE ? OR p.patient_name LIKE ?)');
        params.push(parseInt(searchTerm), `%${searchTerm}%`, `%${searchTerm}%`);
      } else {
        whereConditions.push('(p.patient_name LIKE ? OR p.symptoms LIKE ? OR c.doctor_comment LIKE ? OR pr.doctor_name LIKE ?)');
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
    }

    // Support single date or date range (fromDate & toDate)
    const effectiveFrom = fromDate || date;
    const effectiveTo = toDate || date;

    if (effectiveFrom && effectiveFrom.trim() !== '') {
      whereConditions.push('DATE(p.created_at) >= DATE(?)');
      params.push(effectiveFrom.trim());
    }

    if (effectiveTo && effectiveTo.trim() !== '') {
      whereConditions.push('DATE(p.created_at) <= DATE(?)');
      params.push(effectiveTo.trim());
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total matching records
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total 
      FROM patients p
      LEFT JOIN (
        SELECT patient_token, MAX(id) AS latest_id
        FROM prescriptions
        GROUP BY patient_token
      ) latest_pr ON latest_pr.patient_token = p.token
      LEFT JOIN prescriptions pr ON pr.id = latest_pr.latest_id
      LEFT JOIN consultations c ON c.prescription_id = pr.id
      ${whereClause}
    `;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // Fetch data with doctor consultation details
    const dataSql = `
      SELECT p.*,
             c.doctor_comment,
             pr.doctor_name,
             pr.status AS consultation_status,
             (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = pr.id) AS medicine_count
      FROM patients p
      LEFT JOIN (
        SELECT patient_token, MAX(id) AS latest_id
        FROM prescriptions
        GROUP BY patient_token
      ) latest_pr ON latest_pr.patient_token = p.token
      LEFT JOIN prescriptions pr ON pr.id = latest_pr.latest_id
      LEFT JOIN consultations c ON c.prescription_id = pr.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const data = db.prepare(dataSql).all(...params, limitNum, offset);
    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    };
  }

  /**
   * Find a single patient by token number (prioritizes today's token)
   */
  static findByToken(token) {
    const cleanToken = parseInt(String(token).replace('#', '').trim());
    if (isNaN(cleanToken)) return null;

    const query = `
      SELECT p.*,
             c.doctor_comment,
             pr.doctor_name,
             pr.status AS consultation_status
      FROM patients p
      LEFT JOIN (
        SELECT patient_token, MAX(id) AS latest_id
        FROM prescriptions
        GROUP BY patient_token
      ) latest_pr ON latest_pr.patient_token = p.token
      LEFT JOIN prescriptions pr ON pr.id = latest_pr.latest_id
      LEFT JOIN consultations c ON c.prescription_id = pr.id
      WHERE p.token = ?
      ORDER BY p.id DESC LIMIT 1
    `;

    return db.prepare(query).get(cleanToken);
  }

  /**
   * Find a single patient by internal ID
   */
  static findById(id) {
    return db.prepare('SELECT * FROM patients WHERE id = ?').get(parseInt(id));
  }

  /**
   * Get all patient records for export with date range and search filters
   */
  static exportAll({ search = '', fromDate = '', toDate = '', date = '' } = {}) {
    const whereConditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      const isNumber = /^\d+$/.test(searchTerm);

      if (isNumber) {
        whereConditions.push('(token = ? OR mobile LIKE ? OR patient_name LIKE ?)');
        params.push(parseInt(searchTerm), `%${searchTerm}%`, `%${searchTerm}%`);
      } else {
        whereConditions.push('(patient_name LIKE ? OR symptoms LIKE ?)');
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }
    }

    const effectiveFrom = fromDate || date;
    const effectiveTo = toDate || date;

    if (effectiveFrom && effectiveFrom.trim() !== '') {
      whereConditions.push('DATE(created_at) >= DATE(?)');
      params.push(effectiveFrom.trim());
    }

    if (effectiveTo && effectiveTo.trim() !== '') {
      whereConditions.push('DATE(created_at) <= DATE(?)');
      params.push(effectiveTo.trim());
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sql = `SELECT id, token, patient_name, age, mobile, symptoms, created_at FROM patients ${whereClause} ORDER BY token ASC`;

    return db.prepare(sql).all(...params);
  }

  /**
   * Get summary dashboard stats
   */
  static getStats() {
    const totalPatientsRow = db.prepare('SELECT COUNT(*) AS total FROM patients').get();
    const todayPatientsRow = db.prepare(`
      SELECT COUNT(*) AS today 
      FROM patients 
      WHERE DATE(created_at) = DATE('now', 'localtime')
    `).get();

    const latestTokenRow = db.prepare(`
      SELECT COALESCE(MAX(token), 0) AS latestToken 
      FROM patients 
      WHERE DATE(created_at) = DATE('now', 'localtime')
    `).get();

    return {
      totalPatients: totalPatientsRow ? totalPatientsRow.total : 0,
      todayPatients: todayPatientsRow ? todayPatientsRow.today : 0,
      latestToken: latestTokenRow ? latestTokenRow.latestToken : 0
    };
  }

  /**
   * Update existing patient details
   */
  static update(id, { patient_name, age, mobile, symptoms }) {
    const stmt = db.prepare(`
      UPDATE patients 
      SET patient_name = ?, age = ?, mobile = ?, symptoms = ?
      WHERE id = ?
    `);
    const result = stmt.run(patient_name.trim(), Number(age), mobile.trim(), symptoms.trim(), parseInt(id));
    return result.changes > 0;
  }

  /**
   * Delete patient record by ID
   */
  static delete(id) {
    const stmt = db.prepare('DELETE FROM patients WHERE id = ?');
    const result = stmt.run(parseInt(id));
    return result.changes > 0;
  }
}

module.exports = PatientModel;
