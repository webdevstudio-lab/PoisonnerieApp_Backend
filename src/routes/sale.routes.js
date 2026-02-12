import { Router } from "express";
import {
  addSale,
  getAllSale,
  getOneSale,
  updateSale,
  deleteSale,
} from "../controllers/sale.controller.js";

const router = Router();

router.post("/", addSale);
router.get("/", getAllSale);
router.get("/:id", getOneSale);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;
