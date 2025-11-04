require('dotenv').config();
const config = require('./config');
const app = require('./app');
const { startPaymentConsumer } = require('./consumers/payment.consumer');

const port = config.PORT || 3003;

app.listen(port, () => {
  console.log(`order-service listening ${port}`);
});

startPaymentConsumer().catch((error) => {
  console.error('[order-service] Failed to start payment consumer:', error);
});
