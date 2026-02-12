import { Router } from "express";
import {
  addAchat,
  getAllAchat,
  getOneAchat,
  updateAchat,
  deleteAchat,
  deleteOneProductAchat,
} from "../controllers/achat.controller.js";

const achatRouter = Router();

// Routes de base
achatRouter.get("/", getAllAchat);
achatRouter.post("/", addAchat);
achatRouter.get("/:id", getOneAchat);
achatRouter.put("/:id", updateAchat);
achatRouter.delete("/:id", deleteAchat);

// Route spécifique pour retirer un produit d'un achat multi-ligne
achatRouter.delete("/:achatId/product/:productId", deleteOneProductAchat);

export default achatRouter;
