// const express = require('express');
// const router = express.Router();

// // route test health
// router.get('/test', (req, res) => {
//   res.json({ status: 'ok', service: 'order-service', message: 'Test route works!' });
// });

// module.exports = router;



const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Test route gọi User service với JWT
router.get('/user/:id', async (req, res) => {
  try {
    // Tạo JWT hợp lệ dùng cùng secret với User service
    const token = jwt.sign({ service: 'order-service' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Gọi User service
    const response = await axios.get(`http://user-service:4001/users/${req.params.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
