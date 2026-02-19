import { Router } from "express";
import {
  GetCaisse,
  VersementCaisse,
  RetraitCaisse,
  GetAllHistorique,
} from "../controllers/caisse.controller.js";

const caisseRouter = Router();

caisseRouter.get("/", GetCaisse);

caisseRouter.get("/historique", GetAllHistorique);

caisseRouter.post("/versement", VersementCaisse);

caisseRouter.post("/retrait", RetraitCaisse);

export default caisseRouter;
