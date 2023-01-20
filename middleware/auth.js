const jwt = require('jsonwebtoken');

const notFoundHandler =
  ('*',
  (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);

    res.status(404);
    
    next(error);
  });

const auth = (req, res, next) => {
  try {
    const token = req.header('x-auth-token');

    if (!token)
      return res
        .status(401)
        .json({ message: 'No authentication token, access denied.' });

    const verified = jwt.verify(token, process.env.secretKey);

    if (!verified)
      return res
        .status(401)
        .json({ message: 'Token verification failed, access denied.' });

    req.user = verified.id;
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  auth,
  notFoundHandler,
};