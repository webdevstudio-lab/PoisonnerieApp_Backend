import { Router } from "express";
import {
  addVersement,
  getAllVersements,
  getVersementById,
  updateVersement,
  deleteVersement,
} from "../controllers/versement.controller.js";

const versementRouter = Router();

// Routes de base pour les versements
versementRouter.get("/", getAllVersements);
versementRouter.post("/", addVersement);

// Routes spécifiques avec ID
versementRouter.get("/:id", getVersementById);
versementRouter.put("/:id", updateVersement);
versementRouter.delete("/:id", deleteVersement);

export default versementRouter;
