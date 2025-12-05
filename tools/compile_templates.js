const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const viewsDir = path.join(__dirname, '..', 'views');

function walk(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith('.ejs')) files.push(full);
  });
  return files;
}

const files = walk(viewsDir);
let failed = false;
files.forEach(f => {
  try {
    const src = fs.readFileSync(f, 'utf8');
    ejs.compile(src, {filename: f});
    console.log('[OK] ', path.relative(viewsDir, f));
  } catch (err) {
    failed = true;
    console.error('[ERROR]', path.relative(viewsDir, f));
    console.error(err && err.message);
  }
});
if (failed) process.exit(2);
else process.exit(0);
