import mongoose from "mongoose";
import {
  Sale,
  Store,
  StockHistory,
  Product,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Ajouter un point de vente
export const addSale = async (req, res) => {
  try {
    const { name, location, solde } = req.body;

    if (!name || !location) {
      return responseHandler.error(
        res,
        "Le nom et l'emplacement sont obligatoires",
        400,
      );
    }

    const existingSale = await Sale.findOne({ name: name.trim() });
    if (existingSale) {
      return responseHandler.error(res, "Ce point de vente existe déjà", 400);
    }

    const newSalePoint = new Sale({
      name: name.trim(),
      location,
      displayStock: [],
      solde: Number(solde) || 0,
    });

    await newSalePoint.save();
    return responseHandler.created(
      res,
      newSalePoint,
      "Point de vente créé avec succès",
    );
  } catch (error) {
    return responseHandler.error(res, "Erreur création", 500, error.message);
  }
};

// 2. Récupérer tous les points de vente
export const getAllSale = async (req, res) => {
  try {
    const salePoints = await Sale.find()
      .populate("displayStock.product", "name category sellingPrice")
      .sort({ createdAt: -1 });
    return responseHandler.ok(res, salePoints);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur récupération",
      500,
      error.message,
    );
  }
};

// 3. Récupérer un point de vente par ID (Détails, Stock Réserve & Historique)
export const getOneSale = async (req, res) => {
  try {
    const { id } = req.params;

    // On récupère le point de vente et on peuple son stock vitrine
    const salePoint = await Sale.findById(id).populate(
      "displayStock.product",
      "name category sellingPrice",
    );

    if (!salePoint)
      return responseHandler.notFound(res, "Point de vente introuvable");

    // On récupère le stock secondaire associé (Réserve) avec les prix de vente
    const secondaryStore = await Store.findOne({
      salePoint: id,
      type: "secondaire",
    }).populate("items.product", "name category sellingPrice");

    // On récupère l'historique lié au store secondaire
    const history = secondaryStore
      ? await StockHistory.find({
          $or: [
            { fromStore: secondaryStore._id },
            { toStore: secondaryStore._id },
          ],
        })
          .populate("product", "name")
          .populate("userId", "name")
          .sort({ date: -1 })
          .limit(20)
      : [];

    return responseHandler.ok(res, {
      ...salePoint._doc,
      secondaryStore: secondaryStore || { items: [] },
      history,
    });
  } catch (error) {
    return responseHandler.error(res, "Erreur serveur", 500, error.message);
  }
};

// 4. Mettre à jour les informations
export const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedSale = await Sale.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!updatedSale)
      return responseHandler.notFound(res, "Point de vente introuvable");
    return responseHandler.ok(res, updatedSale, "Point de vente mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error.message);
  }
};

// 5. Supprimer un point de vente
export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    // Sécurité : ne pas supprimer si des stocks y sont encore rattachés
    const linkedStores = await Store.countDocuments({ salePoint: id });
    if (linkedStores > 0) {
      return responseHandler.error(
        res,
        `Action impossible : ${linkedStores} dépôt(s) sont encore liés à ce point de vente.`,
        400,
      );
    }

    const salePoint = await Sale.findByIdAndDelete(id);
    if (!salePoint)
      return responseHandler.notFound(res, "Point de vente introuvable");

    return responseHandler.ok(
      res,
      null,
      "Point de vente supprimé définitivement",
    );
  } catch (error) {
    return responseHandler.error(res, "Erreur suppression", 500, error.message);
  }
};

// 6. ENREGISTRER UNE VENTE (Transactionnel : Stock + Caisse + Historique)
export const recordNewSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { salePointId, productId, quantityCartons, totalAmount } = req.body;
    const userId = req.user?._id; // Récupéré via ton middleware d'auth

    // 1. Déduire du stock secondaire (Réserve de la boutique)
    const secondaryStore = await Store.findOne({
      salePoint: salePointId,
      type: "secondaire",
    }).session(session);

    if (!secondaryStore)
      throw new Error("Stock réserve introuvable pour cette boutique.");

    const stockUpdate = await Store.updateOne(
      {
        _id: secondaryStore._id,
        "items.product": productId,
        "items.quantityCartons": { $gte: Number(quantityCartons) },
      },
      { $inc: { "items.$.quantityCartons": -Number(quantityCartons) } },
      { session },
    );

    if (stockUpdate.modifiedCount === 0)
      throw new Error(
        "Stock insuffisant en boutique pour finaliser cette vente.",
      );

    // 2. Augmenter le solde de la caisse du point de vente
    await Sale.findByIdAndUpdate(
      salePointId,
      { $inc: { solde: Number(totalAmount) } },
      { session },
    );

    // 3. Créer l'entrée dans l'historique
    const product = await Product.findById(productId);
    const history = new StockHistory({
      product: productId,
      fromStore: secondaryStore._id,
      quantity: Number(quantityCartons),
      type: "perte", // Considéré comme une sortie de stock définitif
      description: `VENTE : ${quantityCartons} ctn de ${product?.name || "Produit"}`,
      userId: userId || null, // Évite le plantage si pas d'user connecté
    });
    await history.save({ session });

    await session.commitTransaction();
    return responseHandler.ok(
      res,
      null,
      "Vente enregistrée et stock mis à jour",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 400);
  } finally {
    session.endSession();
  }
};
