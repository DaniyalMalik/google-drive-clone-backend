const jwt = require('jsonwebtoken'),
  auth = (req, res, next) => {
    try {
      const token = req.header('x-auth-token');

      if (!token)
        return res.json({ message: 'No authentication token, access denied.' });

      const verified = jwt.verify(token, process.env.JWT_SECRET);

      if (!verified)
        return res.json({
          message: 'Token verification failed, access denied.',
        });

      req.user = verified.id;

      next();
    } catch (error) {
      next(error);
    }
  };

module.exports = {
  auth,
};
