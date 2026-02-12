import { Router } from "express";
import {
  addProduct,
  getAllProducts,
  getOneProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";

const productRouter = Router();

productRouter.post("/", addProduct);
productRouter.get("/", getAllProducts);
productRouter.get("/:id", getOneProduct);
productRouter.patch("/:id", updateProduct);
productRouter.delete("/:id", deleteProduct);

export default productRouter;
