PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  mobile_number TEXT,
  role TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  batch_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  purchase_price REAL NOT NULL,
  selling_price REAL NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 10,
  gst_percent REAL DEFAULT 12.0,
  barcode TEXT UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token INTEGER NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  mobile TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER,
  patient_token INTEGER NOT NULL,
  patient_mobile TEXT,
  doctor_id INTEGER,
  doctor_name TEXT,
  complaints TEXT,
  diagnosis TEXT,
  submission_status TEXT DEFAULT 'Submitted',
  status TEXT DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Consultations Table
CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER,
  patient_token INTEGER NOT NULL,
  patient_name TEXT,
  patient_mobile TEXT,
  age INTEGER,
  symptoms TEXT,
  doctor_id INTEGER,
  doctor_comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL
);

-- 6. Prescription Items Table
CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  instructions TEXT,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

-- 7. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  consultation_id INTEGER,
  doctor_id INTEGER,
  doctor_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  subtotal REAL NOT NULL,
  discount_type TEXT DEFAULT 'fixed',
  discount_value REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  consultation_charges REAL DEFAULT 0,
  medicine_charges REAL DEFAULT 0,
  other_charges REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  amount_received REAL,
  change_amount REAL DEFAULT 0,
  checkout_status TEXT DEFAULT 'Completed',
  worker_id INTEGER,
  worker_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  generic_name TEXT,
  batch_number TEXT,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

-- 9. Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  previous_quantity INTEGER NOT NULL,
  change_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  role TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_type TEXT,
  record_id TEXT,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_medicines_search ON medicines(name, generic_name, category);
CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(current_stock, minimum_stock);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_consultation ON sales(consultation_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_med ON sale_items(medicine_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_patients_token ON patients(token);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(patient_name);
CREATE INDEX IF NOT EXISTS idx_prescriptions_token ON prescriptions(patient_token);
CREATE INDEX IF NOT EXISTS idx_prescriptions_mobile ON prescriptions(patient_mobile);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);

-- Default Superadmin User
INSERT OR IGNORE INTO users (username, password, full_name, email, role, is_active)
VALUES (
  'superadmin',
  '$2a$10$i0.zvhwT.jU6jJ2yQeN0hO1kL9O1Mv0X.8N9gY8M3R.X4L5a1b2c3',
  'Super Administrator',
  'superadmin@clinic.com',
  'Super Admin',
  1
);
