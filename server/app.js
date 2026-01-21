require('dotenv').config();
require('./config/db');

const express = require('express');
const cors = require('cors');

const idxRoutes = require('./routes');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', idxRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'Aetheria Chronicles API is running'
  });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

