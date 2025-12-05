/**
 * Function-based User model (MVC)
 * Uses db from ../db.
 * Table fields: id, username, email, password, address, contact, role
 */

const User = {
    // Create new user
    create(user, callback) {
        const db = require('../db');
        const sql = `
            INSERT INTO users (username, email, password, address, contact, role)
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;
        const params = [
            user.username,
            user.email,
            user.password,
            user.address,
            user.contact,
            user.role
        ];
        db.query(sql, params, (err, result) => callback(err, result));
    },

    // Get a user by email (used for login)
    getByEmail(email, callback) {
        const db = require('../db');
        const sql = `SELECT * FROM users WHERE email = ?`;
        db.query(sql, [email], (err, results) =>
            callback(err, results && results[0] ? results[0] : null)
        );
    },

    // Get user by ID
    getById(id, callback) {
        const db = require('../db');
        const sql = `SELECT * FROM users WHERE id = ?`;
        db.query(sql, [id], (err, results) =>
            callback(err, results && results[0] ? results[0] : null)
        );
    },

    // Update profile fields: username, email, contact, address
    updateProfile(id, profile, callback) {
        const db = require('../db');
        const sql = `
            UPDATE users SET username = ?, email = ?, contact = ?, address = ?
            WHERE id = ?
        `;
        const params = [profile.username, profile.email, profile.contact, profile.address, id];
        db.query(sql, params, (err, result) => callback(err, result));
    },

    // Change password (stores SHA1 hash)
    changePassword(id, newPassword, callback) {
        const db = require('../db');
        const sql = `UPDATE users SET password = SHA1(?) WHERE id = ?`;
        db.query(sql, [newPassword, id], (err, result) => callback(err, result));
    }
};

module.exports = User;
