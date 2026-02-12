import { Router } from "express";
import {
  addStore,
  getAllStores,
  getStoreById,
  updateStore,
  deleteStore,
  transferStock, // Importation ajoutée
  declareLoss, // Importation ajoutée
} from "../controllers/store.controller.js";

const storeRouter = Router();

// Routes Standards
storeRouter.post("/", addStore);
storeRouter.get("/", getAllStores);
storeRouter.get("/:id", getStoreById);
storeRouter.patch("/:id", updateStore);
storeRouter.delete("/:id", deleteStore);

// Routes Spécifiques aux mouvements de stock
storeRouter.post("/transfer", transferStock); // POST /api/stores/transfer
storeRouter.post("/:id/loss", declareLoss); // POST /api/stores/:id/loss

export default storeRouter;
