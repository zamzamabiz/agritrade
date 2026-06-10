import bcrypt from "bcryptjs";
import sql from "../config/database.js";
import jwt from "jsonwebtoken";

export async function getAllUsers(req, res) {
  try {
    const users = await sql`SELECT * FROM users`;
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (!user.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, data: user[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
}

export async function createUser(req, res) {
  try {
    const { username, email, password, role, full_name } = req.body;
    const companyId = req.user && req.user.companyId;
    if (!username || !email || !password || !companyId)
      return res.status(400).json({ success: false, message: "Missing required fields or company context" });
    const hash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (username, email, password_hash, role, company_id, full_name)
      VALUES (${username}, ${email}, ${hash}, ${role || "user"}, ${companyId}, ${full_name || null})
      RETURNING *
    `;
    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, email, role, full_name } = req.body;
    const result = await sql`
      UPDATE users SET username = ${username}, email = ${email}, role = ${role}, full_name = ${full_name || null} WHERE id = ${id} RETURNING *
    `;
    if (!result.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const result = await sql`
      DELETE FROM users WHERE id = ${id} RETURNING *
    `;
    if (!result.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
}

export const changePassword = async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth)
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required",
    });
  }

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user with password hash
    const users = await sql`SELECT * FROM users WHERE id = ${decoded.id}`;
    const user = users[0];

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!isValidPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await sql`
            UPDATE users 
            SET password_hash = ${newPasswordHash}, updated_at = NOW()
            WHERE id = ${decoded.id}
        `;

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save user's preferred columns
export async function setPreferredColumns(req, res) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, message: 'No token provided' });
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { columns } = req.body;
    if (!Array.isArray(columns)) {
      return res.status(400).json({ success: false, message: 'Columns must be an array' });
    }
    await sql`UPDATE users SET preferred_columns = ${JSON.stringify(columns)} WHERE id = ${userId}`;
    res.json({ success: true, message: 'Preferred columns updated', columns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update preferred columns', error: error.message });
  }
}

// Get user's preferred columns
export async function getPreferredColumns(req, res) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, message: 'No token provided' });
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const result = await sql`SELECT preferred_columns FROM users WHERE id = ${userId}`;
    const columns = result[0]?.preferred_columns || [];
    res.json({ success: true, columns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get preferred columns', error: error.message });
  }
}