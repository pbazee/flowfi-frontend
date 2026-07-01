const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('http://localhost:5000/api/platform/content', { timeout: 10000 });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERROR_RESPONSE', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
