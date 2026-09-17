const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireAdmin } = require('./auth');

// GET /api/audit-logs - Fetch application audit log trail (Admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { module, action, username, search, limit = 100, page = 1 } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (module && module !== 'ALL') {
      query += ' AND module = ?';
      params.push(module);
    }

    if (action && action !== 'ALL') {
      query += ' AND action = ?';
      params.push(action);
    }

    if (username) {
      query += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }

    if (search) {
      query += ' AND (description LIKE ? OR record_id LIKE ? OR username LIKE ? OR action LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    // Pagination
    const pageSize = parseInt(limit, 10) || 100;
    const pageNum = parseInt(page, 10) || 1;
    const offset = (pageNum - 1) * pageSize;

    query += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const logs = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (module && module !== 'ALL') {
      countQuery += ' AND module = ?';
      countParams.push(module);
    }
    if (action && action !== 'ALL') {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }
    if (username) {
      countQuery += ' AND username LIKE ?';
      countParams.push(`%${username}%`);
    }
    if (search) {
      countQuery += ' AND (description LIKE ? OR record_id LIKE ? OR username LIKE ? OR action LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const totalRes = db.prepare(countQuery).get(...countParams);

    return res.json({
      success: true,
      data: logs,
      total: totalRes ? totalRes.total : logs.length,
      page: pageNum,
      pageSize
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

module.exports = router;
