import express from "express";
import dotenv from "dotenv";
import orderRoutes from "./routes/order.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});app.use("/api/orders", orderRoutes);

export default app;


