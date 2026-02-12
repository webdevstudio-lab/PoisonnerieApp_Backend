import { Supplier, Product } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

/** * ==========================================
 * PARTIE 1 : GESTION DES FOURNISSEURS (Base)
 * ==========================================
 */

// 1. Ajouter un fournisseur
export const addFournisseur = async (req, res) => {
  try {
    const { name, contact, category, balance } = req.body;
    const existing = await Supplier.findOne({ name: name.trim() });
    if (existing)
      return responseHandler.error(res, "Ce fournisseur existe déjà", 400);

    const newSupplier = new Supplier({
      name: name.trim(),
      contact,
      category,
      balance: Number(balance) || 0, // Possibilité d'initialiser un solde
    });

    await newSupplier.save();
    return responseHandler.created(
      res,
      newSupplier,
      "Fournisseur créé avec succès",
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

// 2. Récupérer tous les fournisseurs
export const getAllFournisseur = async (req, res) => {
  try {
    // On inclut la balance dans la liste pour voir les dettes d'un coup d'oeil
    const suppliers = await Supplier.find()
      .select("-productCatalog")
      .sort({ name: 1 });
    return responseHandler.ok(res, suppliers);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Récupérer un fournisseur par ID
export const getOneFournisseur = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier)
      return responseHandler.notFound(res, "Fournisseur introuvable");
    return responseHandler.ok(res, supplier);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 4. Mettre à jour un fournisseur (y compris son solde manuellement)
export const updateFournisseur = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!supplier)
      return responseHandler.notFound(res, "Fournisseur introuvable");

    // On save pour recalculer les marges si les produits ont été touchés dans le body
    await supplier.save();

    return responseHandler.ok(res, supplier, "Fournisseur mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error.message);
  }
};

// 5. Supprimer un fournisseur
export const deleteFournisseur = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier)
      return responseHandler.notFound(res, "Fournisseur introuvable");
    return responseHandler.ok(res, null, "Fournisseur supprimé définitivement");
  } catch (error) {
    return responseHandler.error(res, "Erreur suppression", 500, error.message);
  }
};

/** * ==================================================
 * PARTIE 2 : GESTION DU CATALOGUE PRODUITS/PRIX
 * ==================================================
 */

// 6. Ajouter un produit au catalogue (Calcule potentialMargin auto)
export const addFournisseurProduct = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { productId, pricePurchase } = req.body;

    const supplier = await Supplier.findById(supplierId);
    if (!supplier)
      return responseHandler.notFound(res, "Fournisseur introuvable");

    const alreadyExists = supplier.productCatalog.some(
      (p) => p.product.toString() === productId,
    );
    if (alreadyExists)
      return responseHandler.error(res, "Produit déjà présent", 400);

    supplier.productCatalog.push({
      product: productId,
      pricePurchase: Number(pricePurchase),
    });

    // Le middleware .pre("save") va chercher le sellingPrice du produit et calculer la marge
    await supplier.save();

    return responseHandler.ok(res, supplier, "Produit ajouté au catalogue");
  } catch (error) {
    return responseHandler.error(res, "Erreur catalogue", 500, error.message);
  }
};

// 7. Récupérer tout le catalogue détaillé
export const getAllFournisseurProduct = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.supplierId).populate(
      "productCatalog.product",
      "name category weightPerCarton sellingPrice",
    );
    if (!supplier)
      return responseHandler.notFound(res, "Fournisseur introuvable");

    return responseHandler.ok(res, supplier.productCatalog);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur récupération",
      500,
      error.message,
    );
  }
};

// 8. Mettre à jour le prix d'achat (Recalcule la marge)
export const updateFournisseurProduct = async (req, res) => {
  try {
    const { supplierId, productId } = req.params;
    const { pricePurchase } = req.body;

    const supplier = await Supplier.findById(supplierId);
    const item = supplier.productCatalog.find(
      (p) => p.product.toString() === productId,
    );

    if (!item) return responseHandler.notFound(res, "Produit non trouvé");

    item.pricePurchase = Number(pricePurchase);
    await supplier.save(); // Déclenche le calcul de potentialMargin

    return responseHandler.ok(res, supplier, "Prix et marge mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur", 500, error.message);
  }
};

// 9. Supprimer un produit du catalogue
export const deleteFournisseurProduct = async (req, res) => {
  try {
    const { supplierId, productId } = req.params;
    const supplier = await Supplier.findById(supplierId);

    supplier.productCatalog = supplier.productCatalog.filter(
      (p) => p.product.toString() !== productId,
    );
    await supplier.save();

    return responseHandler.ok(res, null, "Produit retiré du catalogue");
  } catch (error) {
    return responseHandler.error(res, "Erreur", 500, error.message);
  }
};

// 10. Récupérer un produit spécifique du catalogue d'un fournisseur
export const getOneFournisseurProduct = async (req, res) => {
  try {
    const { supplierId, productId } = req.params;

    // On récupère le fournisseur et on peuple les détails du produit
    const supplier = await Supplier.findById(supplierId).populate(
      "productCatalog.product",
      "name category weightPerCarton sellingPrice",
    );

    if (!supplier) {
      return responseHandler.notFound(res, "Fournisseur introuvable");
    }

    // On cherche l'item spécifique dans le catalogue
    const productItem = supplier.productCatalog.find(
      (p) => p.product._id.toString() === productId,
    );

    if (!productItem) {
      return responseHandler.notFound(
        res,
        "Ce produit n'est pas référencé chez ce fournisseur",
      );
    }

    return responseHandler.ok(res, productItem);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la récupération du produit fournisseur",
      500,
      error.message,
    );
  }
};
