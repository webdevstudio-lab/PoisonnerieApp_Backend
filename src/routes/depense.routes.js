import { Router } from "express";
import {
  addDepense,
  getMyDepenses,
  updateDepense,
  deleteDepense,
  getDepensesStats,
} from "../controllers/depense.controller.js";

const depenseRouter = Router();

// Ajouter une dépense : POST /api/depenses
depenseRouter.post("/", addDepense);

// Récupérer mes dépenses : GET /api/depenses
depenseRouter.get("/", getMyDepenses);

// Mettre à jour une dépense : PATCH /api/depenses/:id
depenseRouter.patch("/:id", updateDepense);

// Supprimer une dépense : DELETE /api/depenses/:id
depenseRouter.delete("/:id", deleteDepense);

depenseRouter.get("/stats", getDepensesStats); // Nouveau

export default depenseRouter;
