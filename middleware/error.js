const errorHandler = (err, req, res, next) => {
  console.log(err.stack.red);

  res.json({ success: false, error: err.message || 'Server Error' });
};

module.exports = errorHandler;
