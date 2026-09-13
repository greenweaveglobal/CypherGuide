import fs from 'fs';
async function test() {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', new Blob([fs.readFileSync('package.json')]), 'package.json');
  
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  console.log(await res.text());
}
test();
