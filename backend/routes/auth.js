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
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const role = String(req.user.role || '').toLowerCase();
  const isAdmin = role.includes('admin') || role.includes('manager') || role === 'super admin' || role === 'superadmin';

  if (!isAdmin) {
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

    const userRole = String(req.user.role || '').trim();

    // Super Admin / Admin always pass all role checks
    if (userRole === 'Super Admin' || userRole === 'Admin / Billing Manager' || userRole === 'Admin' || userRole.toLowerCase().includes('admin')) {
      return next();
    }

    // Expand role aliases for exact matching
    const roleMap = {
      'op worker': ['op worker', 'receptionist', 'op'],
      'doctor': ['doctor'],
      'billing worker': ['billing worker', 'medical billing worker', 'cashier', 'biller'],
      'medical billing worker': ['billing worker', 'medical billing worker', 'cashier', 'biller'],
      'billing manager': ['billing manager', 'medical manager', 'manager'],
      'medical manager': ['billing manager', 'medical manager', 'manager']
    };

    const normalizedUserRole = userRole.toLowerCase();
    const isMatch = allowedRoles.some(allowed => {
      const normalizedAllowed = String(allowed).toLowerCase();
      if (normalizedAllowed === normalizedUserRole) return true;
      const aliases = roleMap[normalizedAllowed] || [normalizedAllowed];
      return aliases.includes(normalizedUserRole);
    });

    if (isMatch) {
      return next();
    }

    logAudit(req, req.user, 'UNAUTHORIZED_ATTEMPT', 'AUTH', 'API', req.originalUrl, `User role '${userRole}' denied access to ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      message: `Access denied. Requires role: ${allowedRoles.join(', ')}`
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

