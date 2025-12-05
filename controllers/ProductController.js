const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const fs = require('fs');
const path = require('path');

function ensureImageFilename(product) {
  if (!product) return product;
  // sanitize and use basename only (avoid stray paths)
  const raw = product.image ? String(product.image).trim() : '';
  const file = raw ? path.basename(raw) : '';
  const imgPath = file ? path.join(__dirname, '..', 'public', 'images', file) : '';
  try {
    if (file && fs.existsSync(imgPath)) {
      product.image = file;
    } else {
      product.image = 'bgproduct.png';
    }
  } catch (e) {
    product.image = 'bgproduct.png';
  }
  return product;
}

const ProductController = {

  // ---------------------------------------------------
  // LIST ALL PRODUCTS (ADMIN & USER VIEW)
  // ---------------------------------------------------
  listAll(req, res) {
    const user = req.session?.user || null;

    // ---------- ADMIN INVENTORY VIEW ----------
    if (user && user.role === 'admin') {
      const search = (req.query.search || '').trim();
      const categoryId = req.query.categoryId || '';
      const sort = req.query.sort || '';

      Category.getAll((err, categories) => {
        if (err) return res.status(500).send("Database error");

        Product.getAllFiltered(search, categoryId, sort, (err2, products) => {
          if (err2) return res.status(500).send("Database error");

          // normalize image filenames for the view
          products.forEach(p => ensureImageFilename(p));

          res.render('inventory', {
            products,
            user,
            categories,
            search,
            selectedCategoryId: categoryId,
            sort,
            orderCount: res.locals.orderCount || 0
          });
        });
      });

      return;
    }

    // ---------- USER SHOPPING VIEW ----------
    Category.getAll((err, categories) => {            
      if (err) return res.status(500).send("Database error");

      Product.getAll((err, products) => {             
        if (err) return res.status(500).send("Database error");

        // ⭐ ADD SUCCESS FLASH HERE
        const successMsg = (req.flash("success") || [])[0] || null;

        // normalize images for all products
        products.forEach(p => ensureImageFilename(p));

        if (!user) {
          return res.render('shopping', {
            products,
            user,
            categories,   
            success: successMsg,      // ⭐ SEND SUCCESS TO EJS
            added: req.query.added === "true",
            qty: req.query.qty || null,
            name: req.query.name || null,
            cartCount: 0,
            orderCount: res.locals.orderCount || 0
          });
        }

        Cart.getOrCreateCart(user.id, (err, cart) => {
          if (err) return res.status(500).send("Database error");

          Cart.getCartItems(cart.id, (err, items) => {
            if (err) return res.status(500).send("Database error");

            res.render('shopping', {
              products,
              user,
              categories,
              success: successMsg,      // ⭐ SEND SUCCESS TO EJS
              added: req.query.added === "true",
              qty: req.query.qty || null,
              name: req.query.name || null,
              cartCount: items.length,
              orderCount: res.locals.orderCount || 0
            });
          });
        });
      });
    });
  },

  // ---------------------------------------------------
  // GET PRODUCT DETAILS
  // ---------------------------------------------------
  getById(req, res) {
    const productId = req.params.id;

    Product.getById(productId, (err, product) => {
      if (err) return res.status(500).send("Database error");
      if (!product) return res.status(404).send("Product not found");

      // ensure product.image is a safe existing filename
      ensureImageFilename(product);

      res.render('productDetails', {
        user: req.session.user,
        product,
        orderCount: res.locals.orderCount || 0
      });
    });
  },

  // ---------------------------------------------------
  // SHOW ADD PRODUCT FORM
  // ---------------------------------------------------
  showAddForm(req, res) {
    Category.getAll((err, categories) => {
      if (err) return res.status(500).send("Database error");

      res.render('addProduct', {
        categories,
        user: req.session.user,
        orderCount: res.locals.orderCount || 0
      });
    });
  },

  // ---------------------------------------------------
  // ADD PRODUCT (POST)
  // ---------------------------------------------------
  add(req, res) {
    const { productName, quantity, price, categoryId } = req.body;
    const image = req.file ? req.file.filename : null;

    const product = { productName, quantity, price, categoryId, image };

    Product.add(product, (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect('/inventory');
    });
  },

  // ---------------------------------------------------
  // SHOW UPDATE PRODUCT FORM
  // ---------------------------------------------------
  showUpdateForm(req, res) {
    const id = req.params.id;

    Product.getById(id, (err, product) => {
      if (err) return res.status(500).send("Database error");
      if (!product) return res.status(404).send("Product not found");

      Category.getAll((err2, categories) => {
        if (err2) return res.status(500).send("Database error");

        res.render('updateProduct', {
          product,
          categories,
          user: req.session.user,
          orderCount: res.locals.orderCount || 0
        });
      });
    });
  },

  // ---------------------------------------------------
  // UPDATE PRODUCT
  // ---------------------------------------------------
  update(req, res) {
    const id = req.params.id;
    const { productName, quantity, price, categoryId } = req.body;
    const image = req.file ? req.file.filename : req.body.existingImage;

    const product = { productName, quantity, price, categoryId, image };

    Product.update(id, product, (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect('/inventory');
    });
  },

  // ---------------------------------------------------
  // DELETE PRODUCT
  // ---------------------------------------------------
  delete(req, res) {
    Product.delete(req.params.id, (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect('/inventory');
    });
  },

  // ---------------------------------------------------
  // ⭐ BULK RESTOCK (AJAX VERSION)
  // ---------------------------------------------------
  bulkRestock(req, res) {
    const ids = req.body.ids;
    const amount = parseInt(req.body.amount);

    if (!ids || ids.length === 0) {
        return res.json({ success: false, message: "No products selected." });
    }

    Product.bulkRestock(ids, amount, (err) => {
        if (err) return res.json({ success: false, message: "Database error" });

        return res.json({ success: true, message: "Restock successful!" });
    });
  },

  // ---------------------------------------------------
  // SHOW BULK RESTOCK PAGE (GET)
  // ---------------------------------------------------
  showBulkRestock(req, res) {
    const user = req.session?.user || null;
    Product.getAll((err, products) => {
      if (err) return res.status(500).send('Database error');

      res.render('bulkRestock', {
        products,
        user,
        orderCount: res.locals.orderCount || 0
      });
    });
  }

};

module.exports = ProductController;
