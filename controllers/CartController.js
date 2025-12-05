const Cart = require('../models/Cart');
const Product = require('../models/Product');

const CartController = {

    // ⭐ View cart page with cart count
    viewCart(req, res) {
        const user = req.session.user;

        Cart.getOrCreateCart(user.id, (err, cart) => {
            if (err) throw err;

            Cart.getCartItems(cart.id, (err, items) => {
                if (err) throw err;

                let total = 0;
                items.forEach(i => total += i.price * i.quantity);

                // ⭐ Count distinct items for navbar badge (number of products)
                const cartCount = items.length;

                res.render('cart', { 
                    cartItems: items,
                    total,
                    user,
                    cartCount
                });
            });
        });
    },

    // ⭐ Add to cart
    addToCart(req, res) {
        const productId = parseInt(req.params.id);
        const quantity = parseInt(req.body.quantity) || 1;
        const user = req.session.user;

        Product.getById(productId, (err, product) => {
            if (err) throw err;
            if (!product) return res.status(404).send("Product not found");

            Cart.getOrCreateCart(user.id, (err, cart) => {
                if (err) throw err;

                Cart.getCartItem(cart.id, productId, (err, existingItem) => {
                    if (err) throw err;

                    let newQty = existingItem ? existingItem.quantity + quantity : quantity;

                    if (newQty > product.quantity) newQty = product.quantity;

                    const finalDelta = existingItem
                        ? newQty - existingItem.quantity
                        : newQty;

                    Cart.addItem(cart.id, productId, finalDelta, (err) => {
                        if (err) throw err;

                        // ⭐ Redirect back to shopping with message
                        res.redirect(
                            `/shopping?added=true&qty=${newQty}&name=${encodeURIComponent(product.productName)}`
                        );
                    });
                });
            });
        });
    },

    // ⭐ Update quantity
    updateQuantity(req, res) {
        const itemId = req.params.itemId;
        const delta = parseInt(req.body.delta);

        const db = require('../db');

        const sql = `
            SELECT ci.quantity AS cartQty, 
                   p.quantity AS stock
            FROM cart_items ci
            JOIN products p ON p.id = ci.productId
            WHERE ci.id = ?
        `;

        db.query(sql, [itemId], (err, results) => {
            if (err) throw err;
            if (results.length === 0) return res.redirect('/cart');

            let cartQty = results[0].cartQty;
            let stock = results[0].stock;

            let newQty = cartQty + delta;

            if (newQty < 1) newQty = 1;
            if (newQty > stock) newQty = stock;

            Cart.updateQuantity(itemId, newQty, (err) => {
                if (err) throw err;
                res.redirect('/cart');
            });
        });
    },

    // ⭐ Delete item
    deleteItem(req, res) {
        Cart.deleteItem(req.params.itemId, (err) => {
            if (err) throw err;
            res.redirect('/cart');
        });
    },

    // ⭐ Checkout SELECTED items
    checkoutSelected(req, res) {

        let selectedIds = req.body.selectedItems;

        if (!selectedIds) {
            return res.send("No items were selected for checkout.");
        }

        selectedIds = JSON.parse(selectedIds);

        if (selectedIds.length === 0) {
            return res.send("No items were selected for checkout.");
        }

        const db = require('../db');

        const sql = `
            SELECT ci.id, ci.quantity, p.productName, p.price
            FROM cart_items ci
            JOIN products p ON p.id = ci.productId
            WHERE ci.id IN (?)
        `;

        db.query(sql, [selectedIds], (err, items) => {
            if (err) throw err;

            let total = 0;
            items.forEach(i => total += i.price * i.quantity);

            // ⭐ Count distinct items for navbar badge (number of products)
            const cartCount = items.length;

            res.render("checkout", {
                items,
                total,
                user: req.session.user,
                cartCount
            });
        });
    }
};

module.exports = CartController;
