const db = require('../db');

const Order = {

    // -------------------------------------------------------
    // Create a new order
    // -------------------------------------------------------
    createOrder(userId, totalAmount, paymentMethod, callback) {
        const sql = `
            INSERT INTO orders (userId, totalAmount, paymentMethod, createdAt, status)
            VALUES (?, ?, ?, NOW(), 'Pending')
        `;
        db.query(sql, [userId, totalAmount, paymentMethod], (err, result) => {
            if (err) return callback(err);
            callback(null, result.insertId);
        });
    },

    // -------------------------------------------------------
    // Add a product into an order (order_items)
    // -------------------------------------------------------
    addOrderItem(orderId, productId, quantity, price, callback) {
        const sql = `
            INSERT INTO order_items (orderId, productId, quantity, price)
            VALUES (?, ?, ?, ?)
        `;
        db.query(sql, [orderId, productId, quantity, price], callback);
    },

    // -------------------------------------------------------
    // Get all orders for a specific user  
    // (Used for orderHistory.ejs)
    // -------------------------------------------------------
    getOrdersByUser(userId, callback) {
        const sql = `
            SELECT 
                o.id AS orderId,
                o.totalAmount,
                o.paymentMethod,
                o.status,
                o.createdAt,
                oi.quantity,
                oi.price,
                p.productName
            FROM orders o
            JOIN order_items oi ON oi.orderId = o.id
            JOIN products p      ON p.id = oi.productId
            WHERE o.userId = ?
            ORDER BY o.createdAt DESC, o.id DESC
        `;
        db.query(sql, [userId], callback);
    },

    // -------------------------------------------------------
    // For admin notifications (FINAL FIXED VERSION)
    // Correctly displays totalAmount for each order
    // -------------------------------------------------------
    getAllOrdersWithUser(callback) {
        const sql = `
            SELECT 
                o.id AS orderId,
                o.totalAmount,
                o.paymentMethod,
                o.status,
                o.createdAt,
                u.username,
                u.address,
                (
                    SELECT 
                        GROUP_CONCAT(CONCAT(p.productName, ' (x', oi.quantity, ')') 
                        SEPARATOR ', ')
                    FROM order_items oi
                    JOIN products p ON p.id = oi.productId
                    WHERE oi.orderId = o.id
                ) AS items
            FROM orders o
            JOIN users u ON u.id = o.userId
            ORDER BY o.createdAt DESC
        `;
        db.query(sql, callback);
    }

    // -------------------------------------------------------
    // Get single order by id (with items)
    // -------------------------------------------------------
    , getOrderById(orderId, callback) {
        const sql = `
            SELECT 
                o.id AS orderId,
                o.userId,
                o.totalAmount,
                o.paymentMethod,
                o.status,
                o.createdAt,
                oi.quantity,
                oi.price,
                p.productName,
                u.username,
                u.address,
                u.contact
            FROM orders o
            JOIN order_items oi ON oi.orderId = o.id
            JOIN products p ON p.id = oi.productId
            LEFT JOIN users u ON u.id = o.userId
            WHERE o.id = ?
        `;
        db.query(sql, [orderId], callback);
    }

    // -------------------------------------------------------
    // Get total sales per product (quantity sold) for reports
    // Returns rows: { productId, productName, totalSold }
    // -------------------------------------------------------
    , getSalesByProduct(callback) {
        const sql = `
            SELECT p.id AS productId, p.productName, SUM(oi.quantity) AS totalSold
            FROM order_items oi
            JOIN products p ON p.id = oi.productId
            GROUP BY oi.productId
            ORDER BY totalSold DESC
        `;
        db.query(sql, callback);
    }

    // -------------------------------------------------------
    // Revenue per day for the last N days
    // Returns rows: { date, revenue }
    // -------------------------------------------------------
    , getRevenueByDay(days, callback) {
        const sql = `
            SELECT DATE(o.createdAt) AS date, 
                   SUM(oi.quantity * oi.price) AS revenue
            FROM orders o
            JOIN order_items oi ON oi.orderId = o.id
            WHERE o.createdAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(o.createdAt)
            ORDER BY DATE(o.createdAt) ASC
        `;
        db.query(sql, [days], callback);
    }

    // -------------------------------------------------------
    // Top selling products with revenue
    // Returns rows: { productId, productName, category, unitsSold, revenue }
    // -------------------------------------------------------
    , getTopSellingProducts(limit, callback) {
        const sql = `
            SELECT p.id AS productId, p.productName, c.name AS category,
                   SUM(oi.quantity) AS unitsSold,
                   SUM(oi.quantity * oi.price) AS revenue
            FROM order_items oi
            JOIN products p ON p.id = oi.productId
            LEFT JOIN categories c ON p.categoryId = c.id
            GROUP BY oi.productId
            ORDER BY unitsSold DESC
            LIMIT ?
        `;
        db.query(sql, [limit], callback);
    }

    // -------------------------------------------------------
    // Sales by category (revenue and units)
    // Returns rows: { categoryId, categoryName, revenue, unitsSold }
    // -------------------------------------------------------
    , getSalesByCategory(callback) {
        const sql = `
            SELECT c.id AS categoryId, c.name AS categoryName,
                   SUM(oi.quantity * oi.price) AS revenue,
                   SUM(oi.quantity) AS unitsSold
            FROM order_items oi
            JOIN products p ON p.id = oi.productId
            LEFT JOIN categories c ON p.categoryId = c.id
            GROUP BY c.id
            ORDER BY revenue DESC
        `;
        db.query(sql, callback);
    }

};

module.exports = Order;
