import { Router } from "express";
import {
  addClient,
  getAllClient,
  getOneClient,
  updateClient,
  deleteClient,
} from "../controllers/client.controller.js";

const clientRouter = Router();

clientRouter.post("/", addClient);
clientRouter.get("/", getAllClient);
clientRouter.get("/:id", getOneClient);
clientRouter.patch("/:id", updateClient);
clientRouter.delete("/:id", deleteClient);

export default clientRouter;
