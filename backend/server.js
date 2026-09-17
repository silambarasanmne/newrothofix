const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Initialize Database connection & seed
require('./database');

const authRoutes = require('./routes/auth').router;
const medicineRoutes = require('./routes/medicines');
const billingRoutes = require('./routes/billing');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const patientRoutes = require('./routes/patientRoutes');
const opAuthRoutes = require('./routes/opAuthRoutes');
const prescriptionRoutes = require('./routes/prescriptions');
const app = express();
const PORT = process.env.PORT || 5000;

// High-Performance Middleware Pipeline
app.use(compression()); // Gzip response compression for ultra-fast payload delivery
app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static assets with no-cache headers to ensure immediate updates
app.use(express.static(path.join(__dirname, '../'), {
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

const auditLogsRoutes = require('./routes/auditLogs');

// API Routes (Dual Prefix for Local & Vercel Serverless Rewrites)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/medicines', medicineRoutes);
app.use('/medicines', medicineRoutes);

app.use('/api/billing', billingRoutes);
app.use('/billing', billingRoutes);

app.use('/api/reports', reportRoutes);
app.use('/reports', reportRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/prescriptions', prescriptionRoutes);
app.use('/prescriptions', prescriptionRoutes);

app.use('/api/audit-logs', auditLogsRoutes);
app.use('/audit-logs', auditLogsRoutes);

// OP API Routes
app.use('/api/op-auth', opAuthRoutes);
app.use('/op-auth', opAuthRoutes);

app.use('/api', patientRoutes);

// SPA Page Fallback Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../login.html'));
});

app.get('/billing', (req, res) => {
  res.sendFile(path.join(__dirname, '../billing.html'));
});

app.get('/billing-manager', (req, res) => {
  res.sendFile(path.join(__dirname, '../billing-manager.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard.html'));
});

app.get('/medicines', (req, res) => {
  res.sendFile(path.join(__dirname, '../medicines.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, '../history.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, '../reports.html'));
});

app.get('/users', (req, res) => {
  res.sendFile(path.join(__dirname, '../users.html'));
});

// OP Pages
app.get('/patients', (req, res) => {
  res.sendFile(path.join(__dirname, '../patients.html'));
});

app.get('/doctor', (req, res) => {
  res.sendFile(path.join(__dirname, '../doctor.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../register.html'));
});

// Fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../login.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 ORTHOFIX SPECIALITY CLINIC Server running on port ${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

