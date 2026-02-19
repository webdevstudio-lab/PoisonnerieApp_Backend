import { Product } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Ajouter un produit au catalogue global
export const addProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      weightPerCarton,
      lowStockThreshold,
      sellingPrice,
      purchasePrice,
    } = req.body;

    const existingProduct = await Product.findOne({ name: name.trim() });
    if (existingProduct) {
      return responseHandler.error(res, "Ce produit existe déjà", 400);
    }

    const newProduct = new Product({
      name: name.trim(),
      category,
      weightPerCarton: Number(weightPerCarton),
      purchasePrice: Number(purchasePrice || 0), // <--- AJOUTÉ
      sellingPrice: Number(sellingPrice || 0),
      lowStockThreshold: Number(lowStockThreshold || 5),
    });

    await newProduct.save();
    return responseHandler.created(
      res,
      newProduct,
      "Produit ajouté au catalogue",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de l'ajout",
      500,
      error.message,
    );
  }
};

// 2. Récupérer tous les produits
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    return responseHandler.ok(res, products);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Récupérer UN produit
export const getOneProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return responseHandler.notFound(res, "Produit introuvable");
    return responseHandler.ok(res, product);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 4. Mise à jour (incluant le prix d'achat et de vente)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) return responseHandler.notFound(res, "Produit introuvable");
    return responseHandler.ok(res, product, "Référence produit mise à jour");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la mise à jour",
      500,
      error.message,
    );
  }
};

// 5. Supprimer
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return responseHandler.notFound(res, "Produit introuvable");
    return responseHandler.ok(res, null, "Produit supprimé du catalogue");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la suppression",
      500,
      error.message,
    );
  }
};
