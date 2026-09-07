const https = require('https');

const paths = [
  '/admin/audit-log',
  '/admin/help-requests',
  '/admin/dashboard',
  '/admin/attendance',
  '/admin/rewards',
];

async function check() {
  console.log('Testing Vite frontend responses...');
  for (const p of paths) {
    await new Promise((resolve, reject) => {
      https.get('https://localhost:5173' + p, { rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log(`  ${p} -> HTTP ${res.statusCode} (HTML length: ${data.length}, root present: ${data.includes('id="root"')})`);
          resolve();
        });
      }).on('error', reject);
    });
  }
}

check().catch(console.error);
