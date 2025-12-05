const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const f = path.join(__dirname, '..', 'views', 'invoice.ejs');
const src = fs.readFileSync(f, 'utf8');
try {
  ejs.compile(src, {filename: f});
  console.log('compiled OK');
} catch (err) {
  console.error('compile error:');
  console.error(err.stack);
}
