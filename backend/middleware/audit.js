const db = require('../database');

/**
 * Log application events and audit trail entries into the audit_logs table
 * @param {Object} req Express request object (optional, for IP & user agent)
 * @param {Object} user User object { id, username, role } (optional)
 * @param {String} action Action name (LOGIN, FAILED_LOGIN, PATIENT_REGISTER, PATIENT_UPDATE, PATIENT_DELETE, CONSULTATION_SUBMIT, BILL_CREATE, USER_CREATE, USER_UPDATE, USER_DEACTIVATE, PASSWORD_RESET, UNAUTHORIZED_ATTEMPT)
 * @param {String} module Module name (AUTH, PATIENTS, DOCTOR, BILLING, USERS)
 * @param {String} recordType Type of record affected (e.g., 'Patient', 'User', 'Prescription', 'Sale')
 * @param {String|Number} recordId Affected record ID
 * @param {String} description Detail description of the action
 */
function logAudit(req, user, action, module, recordType = null, recordId = null, description = '') {
  try {
    const userId = user ? (user.id || null) : null;
    const username = user ? (user.username || 'system') : 'system';
    const role = user ? (user.role || 'System') : 'System';

    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
      userAgent = req.headers['user-agent'] || null;
    }

    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, role, action, module, record_type, record_id, description, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      username,
      role,
      action,
      module,
      recordType,
      recordId ? String(recordId) : null,
      description,
      ipAddress,
      userAgent
    );
  } catch (err) {
    console.error('Audit Logging Error:', err.message);
  }
}

module.exports = {
  logAudit
};
