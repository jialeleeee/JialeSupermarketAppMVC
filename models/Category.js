// models/Category.js
const Category = {
    getAll(callback) {
        const db = require('../db');
        const sql = "SELECT * FROM categories ORDER BY name";
        db.query(sql, callback);
    }
};

module.exports = Category;
