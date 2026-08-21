const jwt = require("jsonwebtoken");
const { isOnShift, outOfShiftMessage } = require("../utils/shiftAccess");
require("dotenv").config();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.sendStatus(403);
  }

  try {
    const shiftStatus = await isOnShift(user.id, user.role);
    if (!shiftStatus.allowed) {
      return res.status(403).json({
        code: "OUT_OF_SHIFT",
        message: outOfShiftMessage(shiftStatus.nextShift),
        nextShift: shiftStatus.nextShift
      });
    }
  } catch (error) {
    console.error("Shift check error:", error);
    return res.status(500).json({ message: "Server error checking shift" });
  }

  req.user = user;
  next();
};

function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
