const db = require('../database.js');

class UserModel {
  static findByUsername(username) {
    try {
      const stmt = db.prepare('SELECT id, username, password, full_name as name, role, created_at FROM users WHERE LOWER(username) = LOWER(?)');
      return stmt.get(username);
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  static findById(id) {
    try {
      const stmt = db.prepare('SELECT id, username, full_name as name, role, created_at FROM users WHERE id = ?');
      return stmt.get(id);
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw error;
    }
  }

  static create({ username, password, name, role }) {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, password, name || username, role || 'Receptionist');
      return {
        id: info.lastInsertRowid,
        username,
        name: name || username,
        role: role || 'Receptionist'
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
}

module.exports = UserModel;
