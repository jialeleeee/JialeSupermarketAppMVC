const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'views', 'invoice.ejs');
const s = fs.readFileSync(f,'utf8');
const regex = /<%[\s\S]*?%>/g;
let m; let i=0;
while ((m = regex.exec(s)) !== null) {
  console.log('TAG', ++i, 'start', m.index, 'len', m[0].length);
  console.log(m[0]);
  console.log('---');
}
console.log('total tags', i);
