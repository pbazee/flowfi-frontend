const axios = require('axios');

(async () => {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@flowfi.co.ke',
      password: 'CHANGE_THIS_IMMEDIATELY',
    }, { timeout: 10000 });
    console.log(JSON.stringify(res.data));
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('ERROR_RESPONSE', JSON.stringify(err.response.data));
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
