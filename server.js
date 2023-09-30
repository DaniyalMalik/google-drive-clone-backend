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

dotenv.config({ path: 'config/.env' });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use(error);

app.get('/', async (req, res, next) => {
  try {
    let promise = new Promise((resolve, reject) =>
      setTimeout(() => {
        resolve('resolved');
        console.log('here!');
      }, 10000),
    );

    promise;

    res.json({
      success: true,
      message: 'Success',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

const PORT = process.env.PORT || 5000,
  ENVIRONMENT = process.env.NODE_ENV,
  server = app.listen(PORT, () =>
    console.log(
      `Server started running in ${ENVIRONMENT} mode on PORT ${PORT}`.blue.bold,
    ),
  );

connectDB();
