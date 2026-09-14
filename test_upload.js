const fs = require('fs');

async function test() {
  const buf = fs.readFileSync('package.json');
  const blob = new Blob([buf], {type: 'text/plain'});
  
  // Test void.cat
  try {
    const res = await fetch('https://void.cat/upload', {
      method: 'POST',
      body: blob
    });
    console.log('void.cat:', res.status, await res.text());
  } catch (e) {
    console.log('void.cat error:', e.message);
  }
}
test();
