const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          body: parsed
        });
      });
    });

    req.on('error', (err) => { reject(err); });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAllTests() {
  try {
    console.log('--- 1. GET /public/info ---');
    let res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/public/info',
      method: 'GET'
    });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    console.log('\n--- 2. GET /protected/profile without token ---');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/protected/profile',
      method: 'GET'
    });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    console.log('\n--- 3. GET /protected/profile with tampered token ---');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/protected/profile',
      method: 'GET',
      headers: { 'Authorization': 'Bearer NOT_A_REAL_TOKEN' }
    });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

  } catch (err) {
    console.error('Test run failed:', err);
  }
}

runAllTests();
