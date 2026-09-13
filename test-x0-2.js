import fs from 'fs';
async function test() {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync('test.png')]), 'test.png');
  
  const res = await fetch('https://x0.at', {
    method: 'POST',
    body: formData,
  });
  console.log(res.status);
  const url = await res.text();
  console.log(url);
  
  const res2 = await fetch(url.trim());
  console.log(res2.status);
  console.log(res2.headers.get('content-type'));
}
test();
