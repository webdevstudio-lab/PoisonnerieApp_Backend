import { Router } from "express";
import {
  addUser,
  updateUser,
  getOneUser,
  getAllUser,
  deleteUser,
  resetPasswordUser,
  updateMyPassword,
} from "../controllers/user.controller.js";

// Importe ici ton middleware de vérification JWT quand il sera prêt
// import { verifyToken } from "../middlewares/auth.middleware.js";

const userRoutes = Router();

// --- Routes Publiques (ou à protéger par Admin) ---
userRoutes.post("/", addUser);
userRoutes.get("/", getAllUser);
userRoutes.get("/:id", getOneUser);

// --- Routes de Modification ---
userRoutes.patch("/:id", updateUser);
userRoutes.delete("/:id", deleteUser);

// --- Routes Spéciales Sécurité ---
userRoutes.patch("/reset-password/:id", resetPasswordUser); // Pour l'Admin
userRoutes.patch("/update-my-password", updateMyPassword); // Pour l'utilisateur connecté

export default userRoutes;
