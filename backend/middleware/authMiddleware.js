import jwt from 'jsonwebtoken';
import sql from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const rows = await sql`
      SELECT id, username, company_id, role
      FROM users
      WHERE id = ${decoded.id}
      LIMIT 1
    `;
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    req.user = {
      id: user.id,
      username: user.username,
      companyId: user.company_id,
      role: user.role
    };
    res.locals.user = req.user;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export default authMiddleware;
