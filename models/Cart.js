/**
 * Cart Model (MySQL)
 * Tables: cart, cart_items
 */

const Cart = {

    // Get active cart for user; if none exists, create one
    getOrCreateCart(userId, callback) {
        const db = require('../db');

        db.query(`SELECT * FROM cart WHERE userId = ?`, [userId], (err, results) => {
            if (err) return callback(err);

            if (results.length > 0) {
                return callback(null, results[0]); // existing cart
            }

            // Create new cart
            db.query(`INSERT INTO cart (userId) VALUES (?)`, [userId], (err, result) => {
                if (err) return callback(err);

                db.query(`SELECT * FROM cart WHERE id = ?`, [result.insertId], (err, results2) => {
                    if (err) return callback(err);
                    return callback(null, results2[0]);
                });
            });
        });
    },

    // Get a single cart item
    getCartItem(cartId, productId, callback) {
        const db = require('../db');
        const sql = `
            SELECT *
            FROM cart_items
            WHERE cartId = ? AND productId = ?
        `;
        db.query(sql, [cartId, productId], (err, results) => {
            if (err) return callback(err);
            callback(null, results.length > 0 ? results[0] : null);
        });
    },

    // Add product to cart
    addItem(cartId, productId, quantity, callback) {
        const db = require('../db');

        db.query(
            `SELECT * FROM cart_items WHERE cartId = ? AND productId = ?`,
            [cartId, productId],
            (err, results) => {
                if (err) return callback(err);

                if (results.length > 0) {
                    const newQty = results[0].quantity + quantity;
                    db.query(
                        `UPDATE cart_items SET quantity = ? WHERE id = ?`,
                        [newQty, results[0].id],
                        callback
                    );
                } else {
                    db.query(
                        `INSERT INTO cart_items (cartId, productId, quantity) VALUES (?, ?, ?)`,
                        [cartId, productId, quantity],
                        callback
                    );
                }
            }
        );
    },

    // Get all items in cart
    getCartItems(cartId, callback) {
        const db = require('../db');
        const sql = `
            SELECT ci.id,
                   ci.productId,
                   ci.quantity,
                   p.productName,
                   p.price,
                   p.image,
                   p.quantity AS stock
            FROM cart_items ci
            JOIN products p ON ci.productId = p.id
            WHERE ci.cartId = ?
        `;
        db.query(sql, [cartId], callback);
    },

    // Update cart quantity
    updateQuantity(itemId, quantity, callback) {
        const db = require('../db');
        db.query(
            `UPDATE cart_items SET quantity = ? WHERE id = ?`,
            [quantity, itemId],
            callback
        );
    },

    // Delete item
    deleteItem(itemId, callback) {
        const db = require('../db');
        db.query(`DELETE FROM cart_items WHERE id = ?`, [itemId], callback);
    }
};

module.exports = Cart;
