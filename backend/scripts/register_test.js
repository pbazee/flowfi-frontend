const axios = require('axios');

(async () => {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      email: 'testtenant@example.com',
      password: 'password123',
      name: 'Test Owner',
      business_name: 'Test Venue',
      phone: '0712345678',
      plan_id: 'starter'
    }, { timeout: 20000 });
    console.log(JSON.stringify(res.data, null, 2));
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('ERROR_RESPONSE', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
