import { Router } from "express";
import {
  addVenteJour,
  getHistoryByPoint,
  updateVenteDuJour,
  deleteVenteDuJour,
  deleteAllVenteDuJour,
} from "../controllers/venteJour.controller.js";

const venteDuJourRouter = Router();

// --- Routes pour les bilans de vente ---

// Enregistrer un nouveau bilan (fin de journée ou partiel)
venteDuJourRouter.post("/", addVenteJour);

// Récupérer l'historique des bilans d'un point de vente spécifique
// Usage: /api/ventes/point/ID_DU_POINT
venteDuJourRouter.get("/point/:pointId", getHistoryByPoint);

// Modifier un bilan existant (réajuste automatiquement les stocks)
venteDuJourRouter.put("/:id", updateVenteDuJour);

// Supprimer un bilan précis (restaure les stocks)
venteDuJourRouter.delete("/:id", deleteVenteDuJour);

// Supprimer TOUS les bilans (Attention : action irréversible)
venteDuJourRouter.delete("/danger/all", deleteAllVenteDuJour);

export default venteDuJourRouter;
