import { Router } from "express";
import {
  getAllStockHistory,
  getOneStockHistory,
} from "../controllers/stockHistory.controller.js";

const historyStockRouter = Router();

historyStockRouter.get("/", getAllStockHistory);
historyStockRouter.get("/:id", getOneStockHistory);

export default historyStockRouter;
