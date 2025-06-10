const logApiRequests = (req, res, next) => {
  const originalSend = res.send;
  
  req.requestTimestamp = new Date();
  
  res.send = function(body) {
    const responseTimestamp = new Date();
    const processingTime = responseTimestamp - req.requestTimestamp;
    
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${processingTime}ms`);
    
    return originalSend.call(this, body);
  };
  
  next();
};

module.exports = { logApiRequests };