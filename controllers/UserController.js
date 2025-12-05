const User = require('../models/User');

const UserController = {

    // GET /register
    showRegister(req, res) {
        res.render('register', {
            messages: req.flash('error'),
            formData: req.flash('formData')[0]
        });
    },

    // POST /register
    register(req, res) {
        const { username, email, password, address, contact } = req.body;

        if (!username || !email || !password || !address || !contact) {
            req.flash('error', 'All fields are required.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        if (password.length < 6) {
            req.flash('error', 'Password should be at least 6 characters long.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        const user = { 
            username, 
            email, 
            password, 
            address, 
            contact, 
            role: "user"
        };

        User.create(user, (err, result) => {
            if (err) {
                console.error('Error creating user:', err);
                return res.status(500).send('Database error');
            }

            req.flash('success', 'Registration successful! Please log in.');
            return res.redirect('/login');
        });
    },

    // GET /login
    showLogin(req, res) {
        res.render('login', {
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    },

    // POST /login
    login(req, res) {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/login');
        }

        User.getByEmail(email, (err, user) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).send('Database error');
            }

            if (!user) {
                req.flash('error', 'Invalid email or password.');
                return res.redirect('/login');
            }

            const db = require('../db');
            db.query(
                `SELECT * FROM users WHERE email = ? AND password = SHA1(?)`,
                [email, password],
                (err, results) => {
                    if (err) throw err;

                    if (results.length === 0) {
                        req.flash('error', 'Invalid email or password.');
                        return res.redirect('/login');
                    }

                    // If the account has been deactivated (soft-deleted), block login
                    if (typeof results[0].active !== 'undefined' && Number(results[0].active) === 0) {
                        req.flash('error', 'This account has been deactivated.');
                        return res.redirect('/login');
                    }

                    req.session.user = results[0];

                    // ⭐ ADDED SUCCESS POPUP
                    req.flash("success", "Successfully logged in!");

                    if (req.session.user.role === 'user') {
                        return res.redirect('/shopping');
                    } else {
                        // Admins go to admin dashboard
                        return res.redirect('/admin');
                    }
                }
            );
        });
    },

    // GET /logout
    logout(req, res) {
        req.session.destroy();
        res.redirect('/login');
    },

    // Middleware: Require Login
    checkAuthenticated(req, res, next) {
        if (req.session.user) return next();
        req.flash('error', 'Please log in to continue');
        return res.redirect('/login');
    },

    // Middleware: Require Admin
    checkAdmin(req, res, next) {
        if (req.session.user && req.session.user.role === 'admin') return next();
        req.flash('error', 'Access denied');
        return res.redirect('/shopping');
    },

    // POST /update-address
    updateAddress(req, res) {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const newAddress = req.body.address;
        const selectedItems = req.body.selectedItems || '';

        const db = require('../db');
        db.query(
            'UPDATE users SET address = ? WHERE id = ?',
            [newAddress, req.session.user.id],
            (err) => {
                if (err) {
                    console.error('Error updating address:', err);
                    return res.status(500).send('Database error');
                }

                req.session.user.address = newAddress;

                let redirectUrl = '/payment';
                if (selectedItems) {
                    redirectUrl += '?selectedItems=' + encodeURIComponent(selectedItems);
                }
                res.redirect(redirectUrl);
            }
        );
    },

    // POST /user/update-profile
    updateProfile(req, res) {
        if (!req.session.user) return res.redirect('/login');

        const { username, email, contact, address } = req.body;
        const userId = req.session.user.id;

        // basic validation
        if (!username || !email) {
            req.flash('error', 'Username and email are required.');
            return res.redirect('back');
        }

        User.updateProfile(userId, { username, email, contact, address }, (err, result) => {
            if (err) {
                console.error('Error updating profile:', err);
                req.flash('error', 'Unable to update profile');
                return res.redirect('back');
            }

            // update session copy
            req.session.user.username = username;
            req.session.user.email = email;
            req.session.user.contact = contact;
            req.session.user.address = address;

            req.flash('success', 'Profile updated');
            return res.redirect('/user/profile');
        });
    },

    // POST /user/change-password
    changePassword(req, res) {
        if (!req.session.user) return res.redirect('/login');

        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!oldPassword || !newPassword || !confirmPassword) {
            req.flash('error', 'All password fields are required');
            return res.redirect('back');
        }
        if (newPassword.length < 6) {
            req.flash('error', 'New password must be at least 6 characters');
            return res.redirect('back');
        }
        if (newPassword !== confirmPassword) {
            req.flash('error', 'New password and confirmation do not match');
            return res.redirect('back');
        }

        const db = require('../db');
        const email = req.session.user.email;
        db.query('SELECT * FROM users WHERE id = ? AND password = SHA1(?)', [req.session.user.id, oldPassword], (err, rows) => {
            if (err) {
                console.error('Error checking old password:', err);
                req.flash('error', 'Database error');
                return res.redirect('back');
            }
            if (!rows || rows.length === 0) {
                req.flash('error', 'Old password is incorrect');
                return res.redirect('back');
            }

            User.changePassword(req.session.user.id, newPassword, (err2) => {
                if (err2) {
                    console.error('Error updating password:', err2);
                    req.flash('error', 'Unable to change password');
                    return res.redirect('back');
                }

                req.flash('success', 'Password changed successfully');
                return res.redirect('/user/profile');
            });
        });
    }

    // GET /user/profile
    , showProfile(req, res) {
        if (!req.session.user) return res.redirect('/login');
        const userId = req.session.user.id;
        User.getById(userId, (err, user) => {
            if (err) {
                console.error('Error loading profile:', err);
                return res.status(500).send('Database error');
            }
            res.render('profile', { user, messages: req.flash('success'), errors: req.flash('error') });
        });
    }
};

module.exports = UserController;
