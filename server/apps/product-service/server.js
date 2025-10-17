import dotenv from 'dotenv';
import app from './src/app.js';
import { connectRabbitMQ } from './src/utils/rabbitmq.js';

dotenv.config();

const PORT = process.env.PORT || 3002;

app.listen(PORT, async () => {
  console.log(`Product Service running on port ${PORT}`);
  await connectRabbitMQ();
});
