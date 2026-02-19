import { Router } from "express";
import {
  addVenteJour,
  getVentesByStore,
  updateVenteJour,
  deleteVenteJour,
  getVenteStats,
} from "../controllers/venteJour.controller.js";

const venteJourRouter = Router();

// --- CRÉATION ---
// Enregistrer une nouvelle vente
venteJourRouter.post("/", addVenteJour);

// --- LECTURE ---
// Récupérer les ventes par boutique (stock secondaire)
venteJourRouter.get("/store/:storeId", getVentesByStore);

// Récupérer les ventes par point de vente (alias utilisant la même logique de filtre)
venteJourRouter.get("/point/:salePointId", getVentesByStore);

// --- MODIFICATION ---
// Mettre à jour une vente (ajustement stock et solde inclus)
venteJourRouter.patch("/:id", updateVenteJour);

// --- SUPPRESSION ---
// Supprimer une vente (restauration stock et solde incluse)
venteJourRouter.delete("/:id", deleteVenteJour);

venteJourRouter.get("/stats/:salePointId", getVenteStats);

export default venteJourRouter;
