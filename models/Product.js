// models/Product.js
const db = require('../db');

const Product = {

    getAll(callback) {
        const sql = `
            SELECT p.*, c.name AS categoryName
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
        `;
        db.query(sql, callback);
    },

    getAllFiltered(search, categoryId, sort, callback) {
        let sql = `
            SELECT p.*, c.name AS categoryName
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
            WHERE 1 = 1
        `;
        const params = [];

        if (search) {
            sql += ` AND p.productName LIKE ?`;
            params.push(`%${search}%`);
        }

        if (categoryId) {
            sql += ` AND p.categoryId = ?`;
            params.push(categoryId);
        }

        if (sort === "qty_asc") sql += ` ORDER BY p.quantity ASC`;
        else if (sort === "qty_desc") sql += ` ORDER BY p.quantity DESC`;

        db.query(sql, params, callback);
    },

    getById(id, callback) {
        const sql = `
            SELECT p.*, c.name AS categoryName
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
            WHERE p.id = ?
        `;
        db.query(sql, [id], (err, results) => {
            callback(err, results.length ? results[0] : null);
        });
    },

    add(product, callback) {
        const sql = `
            INSERT INTO products (productName, quantity, price, image, categoryId)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.query(sql, [
            product.productName,
            product.quantity,
            product.price,
            product.image,
            product.categoryId
        ], callback);
    },

    update(id, product, callback) {
        const sql = `
            UPDATE products
            SET productName=?, quantity=?, price=?, image=?, categoryId=?
            WHERE id=?
        `;
        db.query(sql, [
            product.productName,
            product.quantity,
            product.price,
            product.image,
            product.categoryId,
            id
        ], callback);
    },

    delete(id, callback) {
        db.query(`DELETE FROM products WHERE id = ?`, [id], callback);
    },

    // ⭐ BULK DELETE (already exists)
    bulkDelete(ids, callback) {
        const placeholder = ids.map(() => '?').join(',');
        db.query(`DELETE FROM products WHERE id IN (${placeholder})`, ids, callback);
    },

    // ⭐ BULK RESTOCK
    bulkRestock(ids, amount, callback) {
        const placeholder = ids.map(() => '?').join(',');
        const sql = `
            UPDATE products
            SET quantity = quantity + ?
            WHERE id IN (${placeholder})
        `;
        db.query(sql, [amount, ...ids], callback);
    }
};

module.exports = Product;
