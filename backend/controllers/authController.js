import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Register a new user (signup)
export const register = async (req, res) => {
    const { username, password, email, full_name, company_id, company_name, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    try {
        const existing = await sql`SELECT 1 FROM users WHERE username = ${username}`;
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }

        let companyId = company_id ? Number(company_id) : null;
        if (!companyId && company_name) {
            const name = company_name.trim();
            const found = await sql`SELECT id FROM company WHERE name = ${name}`;
            if (found.length) {
                companyId = found[0].id;
            } else {
                const created = await sql`INSERT INTO company (name) VALUES (${name}) RETURNING id`;
                companyId = created[0].id;
            }
        }
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'company_id or company_name is required to register' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const userRole = role || 'user';
        const inserted = await sql`
          INSERT INTO users (company_id, username, password_hash, email, full_name, role)
          VALUES (${companyId}, ${username}, ${password_hash}, ${email}, ${full_name}, ${userRole})
          RETURNING id, company_id, username, email, full_name, role, created_at
        `;
        const user = inserted[0];
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Login
export const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    try {
        const users = await sql`SELECT * FROM users WHERE username = ${username}`;
        const user = users[0];
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        const payload = { id: Number(user.id), username: user.username, company_id: Number(user.company_id), role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        res.json({ 
            success: true,
            token, 
            refreshToken,
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email, 
                full_name: user.full_name,
                company_id: user.company_id,
                role: user.role
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Refresh token endpoint
export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        // Optionally, you can check if the user still exists or is active
        const users = await sql`SELECT * FROM users WHERE id = ${Number(decoded.id)}`;
        const user = users[0];
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        const payload = { id: Number(user.id), username: user.username, company_id: Number(user.company_id), role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ success: true, token });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
};

// Get current user profile
export const getProfile = async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, message: 'No token provided' });
    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const users = await sql`SELECT id, username, email, full_name, company_id, role, created_at FROM users WHERE id = ${Number(decoded.id)}`;
        const user = users[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
       
        // Fetch company details
        const companies = await sql`SELECT id, name, address, phone, email, website, created_at FROM company WHERE id = ${Number(user.company_id)}`;
        const company = companies[0] || null;
        res.json({ success: true, user, company });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Update user profile
export const updateProfile = async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, message: 'No token provided' });
    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const { email, full_name } = req.body;
        
        const updated = await sql`
            UPDATE users 
            SET email = ${email}, full_name = ${full_name}, updated_at = NOW()
            WHERE id = ${Number(decoded.id)}
            RETURNING id, username, email, full_name, updated_at
        `;
        
        const user = updated[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
