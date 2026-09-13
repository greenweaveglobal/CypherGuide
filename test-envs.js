import fs from 'fs';
async function test() {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync('package.json')]), 'package.json');
  
  const res = await fetch('https://envs.sh', {
    method: 'POST',
    body: formData,
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
