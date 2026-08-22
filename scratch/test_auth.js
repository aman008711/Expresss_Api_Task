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

async function testStage1() {
  const email = `testuser_${Date.now()}@gmail.com`;
  const password = "super-secret-password";

  try {
    console.log('--- TEST 1.1: Signup with missing password (expect 400) ---');
    let res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/signup',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    console.log('\n--- TEST 1.2: Signup with valid email and password (expect 201) ---');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/signup',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

    console.log('\n--- TEST 1.3: Login with correct credentials (expect 200) ---');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password });
    console.log('Status:', res.statusCode);
    console.log('Has access_token:', !!res.body.access_token);
    console.log('Has refresh_token:', !!res.body.refresh_token);

    console.log('\n--- TEST 1.4: Login with incorrect password (expect 401) ---');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password: 'wrong-password' });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);

  } catch (err) {
    console.error('Test run error:', err);
  }
}

testStage1();
