const express = require('express'),
  app = express(),
  dotenv = require('dotenv'),
  cors = require('cors'),
  userRoutes = require('./apis/userHandler'),
  connectDB = require('./config/db'),
  colors = require('colors'),
  morgan = require('morgan'),
  error = require('./middleware/error');

dotenv.config({ path: 'config/config.env' });

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Z-Key',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/auth', userRoutes);
app.use(error);

const PORT = process.env.PORT || 5000;
const ENVIRONMENT = process.env.NODE_ENV;

const server = app.listen(PORT, () =>
  console.log(
    `Server started running in ${ENVIRONMENT} mode on PORT ${PORT}`.blue.bold,
  ),
);

connectDB();

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red.bold);

  server.close(() => process.exit(1));
});
