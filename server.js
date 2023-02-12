require('colors');

const express = require('express'),
  app = express(),
  dotenv = require('dotenv'),
  cors = require('cors'),
  userRoutes = require('./apis/userHandler'),
  uploadRoutes = require('./apis/uploadHandler'),
  connectDB = require('./config/db'),
  morgan = require('morgan'),
  error = require('./middleware/error');

dotenv.config({ path: 'config/config.env' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use(error);

const PORT = process.env.PORT || 5000,
  ENVIRONMENT = process.env.NODE_ENV,
  server = app.listen(PORT, () =>
    console.log(
      `Server started running in ${ENVIRONMENT} mode on PORT ${PORT}`.blue.bold,
    ),
  );

connectDB();

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red.bold);

  server.close(() => process.exit(1));
});
