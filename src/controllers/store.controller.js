import mongoose from "mongoose";
import {
  Store,
  Product,
  StockHistory,
  Sale,
  TransferSale,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

/**
 * 1. CRÉER UN NOUVEAU DÉPÔT
 */
export const addStore = async (req, res) => {
  try {
    const { name, salePoint, type, items } = req.body;

    const existingStore = await Store.findOne({ salePoint, type });
    if (existingStore) {
      return responseHandler.error(
        res,
        `Un dépôt de type ${type} existe déjà.`,
        400,
      );
    }

    const newStore = new Store({
      name,
      salePoint,
      type,
      items: items || [],
    });

    await newStore.save();
    return responseHandler.created(res, newStore, "Dépôt créé avec succès");
  } catch (error) {
    return responseHandler.error(res, "Erreur création", 500, error.message);
  }
};

/**
 * 2. RÉCUPÉRER TOUS LES DÉPÔTS (Populate mis à jour)
 */
export const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find()
      .populate("salePoint", "name location")
      .populate("items.product", "name category sellingPrice purchasePrice"); // <--- AJOUTÉ

    return responseHandler.ok(res, stores);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur récupération",
      500,
      error.message,
    );
  }
};

/**
 * 3. RÉCUPÉRER UN DÉPÔT SPÉCIFIQUE (Crucial pour StorageDetails)
 */
export const getStoreById = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate({
        path: "items.product",
        select: "name category sellingPrice purchasePrice unit", // <--- AJOUTÉ
      })
      .populate("salePoint");

    if (!store) return responseHandler.notFound(res, "Dépôt introuvable");
    return responseHandler.ok(res, store);
  } catch (error) {
    return responseHandler.error(res, "Erreur détails", 500, error.message);
  }
};

/**
 * Récupérer le stock à partir de l'ID de la boutique
 */
export const getStoreBySalePoint = async (req, res) => {
  try {
    const { salePointId } = req.params;
    const store = await Store.findOne({
      salePoint: salePointId,
      type: "secondaire",
    }).populate("items.product", "name category sellingPrice purchasePrice"); // <--- AJOUTÉ

    if (!store) {
      return responseHandler.error(res, "Aucun stock trouvé", 404);
    }

    return responseHandler.ok(res, store);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur récupération",
      500,
      error.message,
    );
  }
};

/**
 * 4. METTRE À JOUR LES INFOS DU DÉPÔT
 */
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedStore = await Store.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    ).populate("salePoint", "name location");

    if (!updatedStore)
      return responseHandler.notFound(res, "Dépôt introuvable");
    return responseHandler.ok(res, updatedStore, "Mise à jour réussie");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error.message);
  }
};

/**
 * 5. SUPPRIMER UN DÉPÔT
 */
export const deleteStore = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return responseHandler.notFound(res, "Dépôt introuvable");

    const totalStock = store.items.reduce(
      (acc, item) => acc + item.quantityCartons,
      0,
    );
    if (totalStock > 0) {
      return responseHandler.error(
        res,
        "Le dépôt doit être vide avant suppression",
        400,
      );
    }

    await Store.findByIdAndDelete(req.params.id);
    return responseHandler.ok(res, null, "Dépôt supprimé");
  } catch (error) {
    return responseHandler.error(res, "Erreur suppression", 500, error.message);
  }
};

/**
 * 6. TRANSFERT MULTI-PRODUITS
 */
export const transferStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromStoreId, toStoreId, products } = req.body;
    const userId = req.user?._id;

    if (!products || products.length === 0)
      throw new Error("Aucun produit sélectionné.");

    const sourceStore = await Store.findById(fromStoreId).session(session);
    const destStore = await Store.findById(toStoreId).session(session);

    if (!sourceStore || !destStore) throw new Error("Dépôts introuvables.");

    let totalTransferAmount = 0;
    const transferItemsForSale = [];
    const historyEntries = [];

    for (const item of products) {
      const { productId, qty } = item;
      const quantity = Number(qty);
      if (quantity <= 0) continue;

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error(`Produit ${productId} non trouvé.`);

      // Débit Source
      const sourceUpdate = await Store.updateOne(
        {
          _id: fromStoreId,
          "items.product": productId,
          "items.quantityCartons": { $gte: quantity },
        },
        { $inc: { "items.$.quantityCartons": -quantity } },
        { session },
      );
      if (sourceUpdate.modifiedCount === 0)
        throw new Error(`Stock insuffisant : ${product.name}`);

      // Crédit Destination
      const destUpdate = await Store.updateOne(
        { _id: toStoreId, "items.product": productId },
        { $inc: { "items.$.quantityCartons": quantity } },
        { session },
      );
      if (destUpdate.matchedCount === 0) {
        await Store.updateOne(
          { _id: toStoreId },
          {
            $push: { items: { product: productId, quantityCartons: quantity } },
          },
          { session },
        );
      }

      // Calcul Dette (Basé sur SellingPrice)
      if (sourceStore.type === "principal" && destStore.type === "secondaire") {
        const subTotal = quantity * product.sellingPrice;
        totalTransferAmount += subTotal;
        transferItemsForSale.push({
          product: productId,
          quantityCartons: quantity,
          unitPrice: product.sellingPrice,
          subTotal: subTotal,
        });
      }

      historyEntries.push({
        product: productId,
        fromStore: fromStoreId,
        toStore: toStoreId,
        quantity: quantity,
        type: sourceStore.type === "secondaire" ? "retour" : "transfert",
        description: `Mouvement de ${quantity} ctn de ${product.name}`,
        userId,
        date: new Date(),
      });
    }

    const savedHistories = await StockHistory.insertMany(historyEntries, {
      session,
    });

    if (
      sourceStore.type === "principal" &&
      destStore.type === "secondaire" &&
      totalTransferAmount > 0
    ) {
      const newTransferSale = new TransferSale({
        salePoint: destStore.salePoint,
        stockMovementId: savedHistories[0]._id,
        items: transferItemsForSale,
        totalAmount: totalTransferAmount,
      });
      await newTransferSale.save({ session });

      await Sale.findByIdAndUpdate(
        destStore.salePoint,
        { $inc: { totalDebtToOwner: totalTransferAmount } },
        { session },
      );
    }

    await session.commitTransaction();
    return responseHandler.ok(res, null, "Transfert effectué avec succès");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 400);
  } finally {
    session.endSession();
  }
};

/**
 * 7. DÉCLARER UNE PERTE
 */
export const declareLoss = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { productId, quantityCartons, reason } = req.body;
    const qty = Number(quantityCartons);

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error("Produit introuvable.");

    const updateResult = await Store.updateOne(
      {
        _id: id,
        "items.product": productId,
        "items.quantityCartons": { $gte: qty },
      },
      { $inc: { "items.$.quantityCartons": -qty } },
      { session },
    );

    if (updateResult.modifiedCount === 0) throw new Error("Stock insuffisant.");

    await new StockHistory({
      product: productId,
      fromStore: id,
      quantity: qty,
      type: "perte",
      description: `PERTE: ${qty} ctn (${reason})`,
      userId: req.user?._id,
      date: new Date(),
    }).save({ session });

    await session.commitTransaction();
    return responseHandler.ok(res, null, "Perte enregistrée");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 400);
  } finally {
    session.endSession();
  }
};
