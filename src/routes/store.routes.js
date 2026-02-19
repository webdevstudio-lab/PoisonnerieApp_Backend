import { Router } from "express";
import {
  addStore,
  getAllStores,
  getStoreById,
  getStoreBySalePoint, // Nouvelle méthode ajoutée
  updateStore,
  deleteStore,
  transferStock,
  declareLoss,
} from "../controllers/store.controller.js";

const storeRouter = Router();

// --- Routes Standards ---
storeRouter.post("/", addStore);
storeRouter.get("/", getAllStores);

// ATTENTION : Place la route spécifique AVANT la route avec :id
// pour éviter que "by-salepoint" soit confondu avec un ID de dépôt.
storeRouter.get("/by-salepoint/:salePointId", getStoreBySalePoint);

storeRouter.get("/:id", getStoreById);
storeRouter.patch("/:id", updateStore);
storeRouter.delete("/:id", deleteStore);

// --- Routes Spécifiques aux mouvements de stock ---
storeRouter.post("/transfer", transferStock);
storeRouter.post("/:id/loss", declareLoss);

export default storeRouter;
