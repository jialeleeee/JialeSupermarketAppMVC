const Order = require('../models/Order');

const OrderController = {

    // ⭐ USER ORDER HISTORY (Newest first)
    userHistory(req, res) {
        const user = req.session.user;

        if (!user) return res.redirect('/login');

        Order.getOrdersByUser(user.id, (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error");
            }

            const grouped = {};

            // Group rows by orderId
            rows.forEach(r => {
                if (!grouped[r.orderId]) {
                    grouped[r.orderId] = {
                        id: r.orderId,
                        total: parseFloat(r.totalAmount),   // use totalAmount correctly
                        createdAt: r.createdAt,
                        items: []
                    };
                }

                grouped[r.orderId].items.push({
                    name: r.productName,
                    quantity: r.quantity,
                    price: parseFloat(r.price)
                });
            });

            // ⭐ Sort orders by date (Newest → Oldest)
            let orders = Object.values(grouped).sort((a, b) => {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            // ⭐ Add per-user order numbering
            orders.forEach((order, index) => {
                order.orderNumber = orders.length - index;   // 1, 2, 3 for each user
            });

            res.render('orderHistory', {
                user,
                orders
            });
        });
    },

    // ⭐ ADMIN ORDER NOTIFICATIONS (Newest first)
    adminNotifications(req, res) {
        const user = req.session.user;

        if (!user || user.role !== 'admin') {
            return res.redirect('/shopping');
        }

        Order.getAllOrdersWithUser((err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error");
            }

            const formatted = rows.map(r => ({
                orderId: r.orderId,
                username: r.username,
                items: r.items,
                total: parseFloat(r.totalAmount),
                createdAt: r.createdAt
            }));

            // ⭐ Sort newest → oldest
            formatted.sort((a, b) => {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            res.render('adminnotifications', {
                user,
                orders: formatted
            });
        });
    }
};

module.exports = OrderController;
