import { Router } from "express";
import { login, logout, getMe } from "../controllers/auth.controller.js";

const authRoutes = Router();

// Route publique : on envoie le username et password
authRoutes.post("/login", login);

// Route publique : efface les cookies
authRoutes.post("/logout", logout);

// Route protégée : nécessite d'être connecté (verifyToken)
authRoutes.get("/me", getMe);

export default authRoutes;
