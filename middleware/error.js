const errorHandler = (err, req, res, next) => {
  console.log(err, 'err');

  res.json({ success: false, message: err.message || 'Server Error' });
};

module.exports = errorHandler;
