import express from "express";
import { GetDashboardStats } from "../controllers/Dashboard.controller.js";
// import { protect } from "../middleware/auth.middleware.js";

// 1. On déclare l'instance avec le nom dashboardRouter
const dashboardRouter = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Récupérer les statistiques globales (KPIs, Alertes, Graphique, Mouvements)
 * @access  Protégé
 */
// 2. CORRECTION : On utilise dashboardRouter (et non router)
dashboardRouter.get("/stats", GetDashboardStats);

// 3. On exporte la même instance
export default dashboardRouter;
