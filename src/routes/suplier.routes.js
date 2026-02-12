import { Router } from "express";
import {
  // Gestion Fournisseur
  addFournisseur,
  getAllFournisseur,
  getOneFournisseur,
  updateFournisseur,
  deleteFournisseur,
  // Gestion Catalogue Produits
  addFournisseurProduct,
  getAllFournisseurProduct,
  getOneFournisseurProduct,
  updateFournisseurProduct,
  deleteFournisseurProduct,
} from "../controllers/suplier.controller.js";

const suplierRouter = Router();

// --- Routes de base du Fournisseur ---
suplierRouter.post("/", addFournisseur);
suplierRouter.get("/", getAllFournisseur);
suplierRouter.get("/:id", getOneFournisseur);
suplierRouter.patch("/:id", updateFournisseur);
suplierRouter.delete("/:id", deleteFournisseur);

// --- Routes du Catalogue Produits par Fournisseur ---

// Ajouter un produit au catalogue d'un fournisseur
suplierRouter.post("/:supplierId/products", addFournisseurProduct);

// Récupérer tout le catalogue d'un fournisseur
suplierRouter.get("/:supplierId/products", getAllFournisseurProduct);

// Récupérer, modifier ou supprimer un produit spécifique du catalogue
suplierRouter.get("/:supplierId/products/:productId", getOneFournisseurProduct);
suplierRouter.patch(
  "/:supplierId/products/:productId",
  updateFournisseurProduct,
);
suplierRouter.delete(
  "/:supplierId/products/:productId",
  deleteFournisseurProduct,
);

export default suplierRouter;
