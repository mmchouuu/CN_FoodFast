const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const usersRoutes = require('./routes/users.routes');
const requestId = require('./middlewares/requestId');
const errorHandler = require('./middlewares/errorHandler');
const health = require('./health');

const app = express();
app.use(bodyParser.json());
app.use(requestId);

// public routes
app.use('/api/users', usersRoutes);

// health
app.get('/health', health);

// default error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API Gateway listening on port ${config.port}`);
});
