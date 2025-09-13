const errorHandler = (err, req, res, next) => {
  console.log(`Error occurred: ${err.message}`); // Debug
  console.log(`Request URL: ${req.originalUrl}`); // Debug
  console.log(`Request method: ${req.method}`); // Debug
  console.log(`Request headers:`, req.headers); // Debug

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = errorHandler;
