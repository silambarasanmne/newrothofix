const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { logAudit } = require('../middleware/audit');

const JWT_SECRET = 'medicare-pharmacy-super-secret-key-2026';

// Middleware to authenticate JWT token (Supports Header or Query Param)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// Middleware to check for Admin role
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'Super Admin' && req.user.role !== 'Admin / Billing Manager' && req.user.role !== 'Admin' && req.user.role !== 'Manager' && req.user.role !== 'Medical Manager' && req.user.role !== 'Billing Manager')) {
    logAudit(req, req.user, 'UNAUTHORIZED_ATTEMPT', 'AUTH', 'Page/API', req.originalUrl, 'Denied non-admin attempt to access admin resource');
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Administrator privilege required.' 
    });
  }
  next();
}

// Middleware to enforce role-based authorization
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = req.user.role;
    // Super Admin and Admin always pass
    if (userRole === 'Super Admin' || userRole === 'Admin / Billing Manager' || userRole === 'Admin') {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    logAudit(req, req.user, 'UNAUTHORIZED_ATTEMPT', 'AUTH', 'API', req.originalUrl, `User role '${userRole}' denied access to ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
    });
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const trimmedUsername = username.trim();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(trimmedUsername);

    if (!user) {
      logAudit(req, { username: trimmedUsername, role: 'Unknown' }, 'FAILED_LOGIN', 'AUTH', 'User', null, `Failed login attempt for unknown user: ${trimmedUsername}`);
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (!user.is_active) {
      logAudit(req, { id: user.id, username: user.username, role: user.role }, 'FAILED_LOGIN', 'AUTH', 'User', user.id, `Login attempt on deactivated account: ${user.username}`);
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      logAudit(req, { id: user.id, username: user.username, role: user.role }, 'FAILED_LOGIN', 'AUTH', 'User', user.id, `Invalid password entered for user: ${user.username}`);
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Update last_login_at timestamp
    const nowIso = new Date().toISOString();
    try {
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, user.id);
    } catch (e) {
      console.warn('Could not update last_login_at:', e.message);
    }

    // Generate JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        full_name: user.full_name, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Audit Log Success
    logAudit(req, { id: user.id, username: user.username, role: user.role }, 'LOGIN', 'AUTH', 'User', user.id, `User '${user.username}' logged in successfully`);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  logAudit(req, req.user, 'LOGOUT', 'AUTH', 'User', req.user.id, `User '${req.user.username}' logged out`);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me - Current user profile
router.get('/me', authenticateToken, (req, res) => {
  return res.json({ success: true, user: req.user });
});

module.exports = {
  router,
  authenticateToken,
  requireAdmin,
  requireRole
};

