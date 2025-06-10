const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dailyStockScheduler = require("./utils/dailyStockScheduler");

const app = express();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const frontendUrlWithProtocol = frontendUrl.startsWith('http') ? frontendUrl : `http://${frontendUrl}`;

app.use(cors({
  origin: [frontendUrlWithProtocol, 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(bodyParser.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/daily-stock", require("./routes/dailyStock"));
app.use("/api/activity-cleanup", require("./routes/activity-cleanup"));

dailyStockScheduler.setupScheduler();

module.exports = app;