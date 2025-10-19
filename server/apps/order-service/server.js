// import dotenv from 'dotenv';
// import app from './src/app.js';
// import { connectRabbitMQ } from './src/utils/rabbitmq.js';

// dotenv.config();

// const PORT = process.env.PORT || 3003;

// app.listen(PORT, async () => {
//   console.log(`Order Service running on port ${PORT}`);
//   await connectRabbitMQ();
// });

// server.js
import dotenv from "dotenv";
import app from "./src/app.js";
import { connectRabbitMQ } from "./src/utils/rabbitmq.js";
import pool from "./src/db/index.js";

dotenv.config();

const PORT = process.env.PORT || 3003;

const waitForPostgres = async () => {
  let connected = false;
  while (!connected) {
    try {
      await pool.query("SELECT 1");
      console.log("Connected to Postgres");
      connected = true;
    } catch (err) {
      console.log("Waiting for Postgres at orderdb:5432...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

const startServer = async () => {
  await waitForPostgres();

  try {
    await connectRabbitMQ();
    console.log("RabbitMQ connected");
  } catch (error) {
    console.error("RabbitMQ not ready yet:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
};

startServer();
