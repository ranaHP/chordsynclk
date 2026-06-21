import jwt from "jsonwebtoken";

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name, isAdmin: !!user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function authOptional(req, _res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch { /* ignore */ }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Forbidden" });
  next();
}
