import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  setPreferredColumns,
  getPreferredColumns,
} from "../controllers/userController.js";

const router = express.Router();

router.post('/preferred-columns', setPreferredColumns); // POST /api/users/preferred-columns
router.get('/preferred-columns', getPreferredColumns); // GET /api/users/preferred-columns

router.get("/", getAllUsers); // GET /api/users
router.get("/:id", getUserById); // GET /api/users/:id
router.post("/", createUser); // POST /api/users
router.put("/:id", updateUser); // PUT /api/users/:id
router.delete("/:id", deleteUser); // DELETE /api/users/:id

router.post("/change-password", changePassword); // POST /api/users/change-password

export default router;
