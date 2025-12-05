const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const app = express();

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION - application will exit');
    console.error(err && err.stack ? err.stack : err);
    setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION - application will exit');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    setTimeout(() => process.exit(1), 100);
});

// Controllers
const UserController = require('./controllers/UserController');
const ProductController = require('./controllers/ProductController');
const CartController = require('./controllers/CartController');
const PaymentController = require('./controllers/PaymentController');
const OrderController = require('./controllers/OrderController');


const Order = require('./models/Order');

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// View Engine + Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());   // ⭐ Required for AJAX JSON

// Sessions
app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
    })
);

app.use(flash());

// ⭐ Make user available everywhere
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ⭐ Admin notification badge
app.use((req, res, next) => {
    res.locals.orderCount = 0;

    if (!req.session.user || req.session.user.role !== 'admin') {
        return next();
    }

    Order.getAllOrdersWithUser((err, rows) => {
        if (err) {
            console.error("Notification badge error:", err);
            return next();
        }

        res.locals.orderCount = rows.length;
        next();
    });
});

/* -------------------------
   HOME PAGE
-------------------------- */
app.get('/', (req, res) => {
    res.render('index');
});

/* -------------------------
   USER ROUTES
-------------------------- */
app.get('/register', UserController.showRegister);
app.post('/register', UserController.register);

app.get('/login', UserController.showLogin);
app.post('/login', UserController.login);

app.get('/logout', UserController.logout);

app.post(
    '/update-address',
    UserController.checkAuthenticated,
    UserController.updateAddress
);

// User profile updates
app.post(
    '/user/update-profile',
    UserController.checkAuthenticated,
    UserController.updateProfile
);

app.post(
    '/user/change-password',
    UserController.checkAuthenticated,
    UserController.changePassword
);

// Profile page
app.get(
    '/user/profile',
    UserController.checkAuthenticated,
    UserController.showProfile
);

/* -------------------------
   PRODUCT ROUTES
-------------------------- */
app.get(
    '/inventory',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.listAll
);

app.get(
    '/shopping',
    UserController.checkAuthenticated,
    ProductController.listAll
);

app.get(
    '/product/:id',
    UserController.checkAuthenticated,
    ProductController.getById
);

app.get(
    '/addProduct',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.showAddForm
);

app.post(
    '/addProduct',
    upload.single('image'),
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.add
);

app.get(
    '/updateProduct/:id',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.showUpdateForm
);

app.post(
    '/updateProduct/:id',
    upload.single('image'),
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.update
);

app.get(
    '/deleteProduct/:id',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.delete
);

/* -------------------------
   CART ROUTES
-------------------------- */
app.get(
    '/cart',
    UserController.checkAuthenticated,
    CartController.viewCart
);

app.post(
    '/add-to-cart/:id',
    UserController.checkAuthenticated,
    CartController.addToCart
);

app.post(
    '/cart/update/:itemId',
    UserController.checkAuthenticated,
    CartController.updateQuantity
);

app.post(
    '/cart/delete/:itemId',
    UserController.checkAuthenticated,
    CartController.deleteItem
);

app.post(
    '/cart/checkout',
    UserController.checkAuthenticated,
    CartController.checkoutSelected
);

// -------------------------
// CART API (JSON) - used by cart drawer
// -------------------------
// Cart drawer API removed — using existing form-based routes

/* -------------------------
   PAYMENT ROUTES
-------------------------- */
app.get(
    '/payment',
    UserController.checkAuthenticated,
    PaymentController.showPaymentPage
);

app.post(
    '/payment',
    UserController.checkAuthenticated,
    PaymentController.processPayment
);

/* -------------------------
   ORDER HISTORY
-------------------------- */
app.get(
    '/orders',
    UserController.checkAuthenticated,
    OrderController.userHistory
);

/* -------------------------
   ADMIN ORDER NOTIFICATIONS
-------------------------- */
app.get(
    '/admin/orders',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    OrderController.adminNotifications
);

/* -------------------------
   ADMIN DASHBOARD + PAGES
-------------------------- */
app.get(
    '/admin',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        const db = require('./db');

        // Gather dashboard summary counts
        db.query("SELECT COUNT(*) AS totalUsers FROM users", (uErr, uRows) => {
            if (uErr) {
                console.error('Error fetching total users:', uErr);
                return res.status(500).send('Database error');
            }

            db.query("SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'", (aErr, aRows) => {
                if (aErr) {
                    console.error('Error fetching admin count:', aErr);
                    return res.status(500).send('Database error');
                }

                db.query("SELECT COUNT(*) AS productCount, SUM(CASE WHEN quantity <= 20 THEN 1 ELSE 0 END) AS lowStockCount FROM products", (pErr, pRows) => {
                    if (pErr) {
                        console.error('Error fetching product stats:', pErr);
                        return res.status(500).send('Database error');
                    }

                    db.query("SELECT COUNT(*) AS totalOrders, IFNULL(SUM(totalAmount),0) AS totalRevenue FROM orders", (oErr, oRows) => {
                        if (oErr) {
                            console.error('Error fetching order stats:', oErr);
                            return res.status(500).send('Database error');
                        }

                        // Fetch recent orders (top 5 most recent) to show on the dashboard
                        Order.getAllOrdersWithUser((ordErr, ordRows) => {
                            if (ordErr) {
                                console.error('Error fetching recent orders for admin dashboard:', ordErr);
                                ordRows = [];
                            }

                            // Also fetch recent customers (non-admin users) for quick manage table
                            db.query("SELECT id, username, email, contact, address FROM users WHERE role <> 'admin' ORDER BY id DESC LIMIT 10", (cErr, cRows) => {
                                if (cErr) {
                                    console.error('Error fetching recent customers for admin dashboard:', cErr);
                                    cRows = [];
                                }

                                res.render('admin', {
                                    user: req.session.user,
                                    messages: req.flash('success'),
                                    errors: req.flash('error'),
                                    hideNavLinks: true, // dashboard should show empty navbar
                                    totalUsers: (uRows && uRows[0] && uRows[0].totalUsers) || 0,
                                    adminCount: (aRows && aRows[0] && aRows[0].adminCount) || 0,
                                    productCount: (pRows && pRows[0] && pRows[0].productCount) || 0,
                                    lowStockCount: (pRows && pRows[0] && pRows[0].lowStockCount) || 0,
                                    totalOrders: (oRows && oRows[0] && oRows[0].totalOrders) || 0,
                                    totalRevenue: (oRows && oRows[0] && oRows[0].totalRevenue) || 0,
                                    recentOrders: (ordRows || []).slice(0,5),
                                    recentCustomers: (cRows || [])
                                });
                            });
                        });
                    });
                });
            });
        });
    }
);

app.get(
    '/admin/users',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        const db = require('./db');
        db.query("SELECT id, username, email, role, contact, address, createdAt FROM users ORDER BY createdAt DESC", (err, rows) => {
            if (err) {
                console.error('Error fetching users for admin users page:', err);
                return res.status(500).send('Database error');
            }

            res.render('adminUsers', { user: req.session.user, users: rows || [] });
        });
    }
);

// Delete user (POST)
app.post(
    '/admin/users/delete/:id',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        const db = require('./db');
        const id = req.params.id;

        // Prevent deleting self
        if (req.session.user && String(req.session.user.id) === String(id)) {
            req.flash('error', 'You cannot delete your own account.');
            return res.redirect('/admin/users');
        }

        // Check target user's role
        db.query('SELECT role FROM users WHERE id = ?', [id], (err, rows) => {
            if (err) {
                console.error('Error checking user before delete:', err);
                req.flash('error', 'Database error');
                return res.redirect('/admin/users');
            }

            if (!rows || rows.length === 0) {
                req.flash('error', 'User not found');
                return res.redirect('/admin/users');
            }

            const role = rows[0].role;
            if (role === 'admin') {
                req.flash('error', 'Cannot delete an admin account');
                return res.redirect('/admin/users');
            }

            // Try to add `active` column (if it doesn't exist) and then soft-delete.
            // Avoid falling back to a hard DELETE because that fails with FK constraints.
            const addActiveColumnAndSoftDelete = () => {
                db.query("ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1", (altErr) => {
                    if (altErr) {
                        // If the column already exists, ignore the error and proceed.
                        // MySQL duplicate column error code is 1060 (ER_DUP_FIELDNAME).
                        if (altErr.errno === 1060 || altErr.code === 'ER_DUP_FIELDNAME') {
                            // proceed to soft-delete
                        } else {
                            console.error('Error adding active column:', altErr);
                            req.flash('error', 'Database error while preparing user deletion');
                            return res.redirect('/admin/users');
                        }
                    }

                    // Perform soft-delete
                    db.query('UPDATE users SET active = 0 WHERE id = ?', [id], (updErr, result) => {
                        if (updErr) {
                            console.error('Error soft-deleting user:', updErr);
                            req.flash('error', 'Database error while deleting user');
                            return res.redirect('/admin/users');
                        }

                        if (result && result.affectedRows && result.affectedRows > 0) {
                            req.flash('success', 'User deleted (deactivated) successfully');
                            return res.redirect('/admin/users');
                        }

                        req.flash('error', 'User not found or already deleted');
                        return res.redirect('/admin/users');
                    });
                });
            };

            addActiveColumnAndSoftDelete();
        });
    }
);

app.get(
    '/admin/refunds',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        res.render('adminRefunds', { user: req.session.user });
    }
);

// View customers' orders
app.get(
    '/admin/customers-orders',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        const db = require('./db');

        // Fetch orders and list of customers (non-admin users) in parallel
        Order.getAllOrdersWithUser((err, rows) => {
            if (err) {
                console.error('Error fetching orders for admin customers-orders:', err);
                return res.status(500).send('Database error');
            }

            db.query("SELECT id, username FROM users WHERE role <> 'admin' ORDER BY username", (uErr, users) => {
                if (uErr) {
                    console.error('Error fetching users for admin customers-orders:', uErr);
                    return res.status(500).send('Database error');
                }

                res.render('adminCustomersOrders', {
                    user: req.session.user,
                    orders: rows || [],
                    customers: users || []
                });
            });
        });
    }
);

// View sales reports
app.get(
    '/admin/sales-reports',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    (req, res) => {
        const Order = require('./models/Order');

        // revenue for last 30 days
        Order.getRevenueByDay(30, (err, revenueRows) => {
            if (err) {
                console.error('Error fetching revenue by day:', err);
                return res.status(500).send('Database error');
            }

            // top products (limit 10)
            Order.getTopSellingProducts(10, (err2, topRows) => {
                if (err2) {
                    console.error('Error fetching top products:', err2);
                    return res.status(500).send('Database error');
                }

                // sales by category
                Order.getSalesByCategory((err3, catRows) => {
                    if (err3) {
                        console.error('Error fetching sales by category:', err3);
                        return res.status(500).send('Database error');
                    }

                    res.render('adminSalesReports', {
                        user: req.session.user,
                        revenue: revenueRows || [],
                        topProducts: topRows || [],
                        categorySales: catRows || []
                    });
                });
            });
        });
    }
);
/* -------------------------
   PAYMENT SUCCESS
-------------------------- */
app.get(
    '/payment-success',
    UserController.checkAuthenticated,
    (req, res) => {
        const orderId = req.query.orderId;
        res.render('paymentSuccess', { orderId });
    }
);

/* -------------------------
     INVOICE
-------------------------- */
app.get(
    '/invoice',
    UserController.checkAuthenticated,
    (req, res) => {
        return res.redirect('/orders');
    }
);

app.get(
    '/invoice/:id',
    UserController.checkAuthenticated,
    (req, res) => {
        const id = req.params.id;

        Order.getOrderById(id, (err, rows) => {
            if (err) {
                console.error('Order lookup error:', err);
                return res.status(500).send('Database error');
            }

            if (!rows || rows.length === 0) {
                return res.status(404).send('Order not found');
            }

            const orderInfo = {
                id: rows[0].orderId,
                date: rows[0].createdAt,
                paymentMethod: rows[0].paymentMethod,
                subtotal: parseFloat(rows[0].totalAmount) || 0,
                total: parseFloat(rows[0].totalAmount) || 0,
                items: rows.map(r => ({
                    productName: r.productName,
                    price: parseFloat(r.price),
                    quantity: r.quantity
                }))
            };

            res.render('invoice', {
                user: req.session.user || null,
                order: orderInfo
            });
        });
    }
);

/* -------------------------
   ⭐ BULK RESTOCK (POST ONLY)
-------------------------- */
app.post(
    '/inventory/bulk-restock',
    UserController.checkAuthenticated,
    UserController.checkAdmin,
    ProductController.bulkRestock
);


/* -------------------------
   START SERVER
-------------------------- */
// Session & Feedback middleware: make flash messages accessible in all views
// Adds `messages` (success) and `errors` (error) arrays on `res.locals` for templates
app.use((req, res, next) => {
    try {
        res.locals.messages = req.flash('success') || [];
        res.locals.errors = req.flash('error') || [];
    } catch (e) {
        // If flash is not available for some reason, ensure locals exist
        res.locals.messages = res.locals.messages || [];
        res.locals.errors = res.locals.errors || [];
    }
    next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
