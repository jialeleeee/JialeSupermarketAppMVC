const Cart = require('../models/Cart');
const Order = require('../models/Order');
const db = require('../db');

const PaymentController = {

    // GET /payment
    showPaymentPage(req, res) {
        const user = req.session.user;

        let selectedIds = [];
        let selectedItemsRaw = '';

        if (req.query.selectedItems) {
            selectedItemsRaw = req.query.selectedItems;
            try {
                selectedIds = JSON.parse(req.query.selectedItems);
            } catch (e) {
                selectedIds = [];
            }
        }

        Cart.getOrCreateCart(user.id, (err, cart) => {
            if (err) throw err;

            Cart.getCartItems(cart.id, (err, items) => {
                if (err) throw err;

                // filter selected items only
                let filtered = items;
                if (selectedIds.length > 0) {
                    filtered = items.filter(i => selectedIds.includes(String(i.id)));
                }

                let total = 0;
                filtered.forEach(i => total += i.quantity * i.price);

                res.render('payment', {
                    user,
                    items: filtered,
                    total,
                    selectedItemsRaw
                });
            });
        });
    },

    // POST /payment
    processPayment(req, res) {
        const user = req.session.user;
        const paymentMethod = req.body.paymentMethod;
        const selectedItemsRaw = req.body.selectedItems || '';

        // Credit card validation
        if (paymentMethod === 'Credit Card') {
            const digits = (req.body.cardNumber || '').replace(/\D/g, '');
            if (digits.length !== 16) {
                return res.status(400).send('Invalid credit card number (must be 16 digits).');
            }
        }

        let selectedIds = [];
        if (selectedItemsRaw) {
            try {
                selectedIds = JSON.parse(selectedItemsRaw);
            } catch (e) {
                selectedIds = [];
            }
        }

        // Load user cart
        Cart.getOrCreateCart(user.id, (err, cart) => {
            if (err) throw err;

            Cart.getCartItems(cart.id, (err, items) => {
                if (err) throw err;

                // Items being purchased
                let toProcess = items;
                if (selectedIds.length > 0) {
                    toProcess = items.filter(i => selectedIds.includes(String(i.id)));
                }

                if (toProcess.length === 0) {
                    return res.redirect('/cart');
                }

                // Calculate total
                let total = 0;
                toProcess.forEach(i => total += i.quantity * i.price);

                // Create order
                Order.createOrder(user.id, total, paymentMethod, (err, orderId) => {
                    if (err) throw err;

                    let done = 0;

                    toProcess.forEach(item => {
                        // Add order items
                        Order.addOrderItem(
                            orderId,
                            item.productId,
                            item.quantity,
                            item.price,
                            (err2) => {
                                if (err2) throw err2;

                                // Update stock
                                db.query(
                                    'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                                    [item.quantity, item.productId],
                                    (err3) => {
                                        if (err3) throw err3;

                                        done++;

                                        if (done === toProcess.length) {
                                            // Delete purchased items from cart
                                            const ids = toProcess.map(i => i.id);
                                            db.query(
                                                'DELETE FROM cart_items WHERE id IN (?)',
                                                [ids],
                                                (err4) => {
                                                    if (err4) throw err4;

                                                    // 🌟 Redirect to success page and include orderId so user can view receipt
                                                    res.redirect('/payment-success?orderId=' + orderId);
                                                }
                                            );
                                        }
                                    }
                                );
                            }
                        );
                    });
                });
            });
        });
    }
};

module.exports = PaymentController;
