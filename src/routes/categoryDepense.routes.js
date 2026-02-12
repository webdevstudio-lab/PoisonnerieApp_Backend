import { Router } from "express";
import {
  addCategory,
  getAllCategories,
  deleteOneCategory,
} from "../controllers/categoryDepense.controller.js";

const categoryRouter = Router();

// Ajouter une catégorie : POST /api/categories
categoryRouter.post("/", addCategory);

// Récupérer toutes les catégories : GET /api/categories
categoryRouter.get("/", getAllCategories);

// Supprimer une catégorie : DELETE /api/categories/:id
categoryRouter.delete("/:id", deleteOneCategory);

export default categoryRouter;
