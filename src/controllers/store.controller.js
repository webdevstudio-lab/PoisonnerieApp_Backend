import mongoose from "mongoose";
import { Store, Product, StockHistory } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Créer un nouvel entrepôt / chambre froide
export const addStore = async (req, res) => {
  try {
    const { name, salePoint, type, items } = req.body;

    // Vérification si un store de ce type existe déjà pour ce point de vente
    const existingStore = await Store.findOne({ salePoint, type });
    if (existingStore) {
      return responseHandler.error(
        res,
        `Un dépôt de type ${type} existe déjà pour ce point de vente.`,
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
    return responseHandler.error(
      res,
      "Erreur lors de la création du dépôt",
      500,
      error.message,
    );
  }
};

// 2. Récupérer l'état de tous les stocks
export const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find()
      .populate("salePoint", "name location")
      .populate("items.product", "name category sellingPrice");

    return responseHandler.ok(res, stores);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Mettre à jour les infos générales
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

    return responseHandler.ok(res, updatedStore, "Dépôt mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error.message);
  }
};

// 4. Récupérer le stock d'un dépôt spécifique
export const getStoreById = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate("items.product")
      .populate("salePoint");

    if (!store) return responseHandler.notFound(res, "Dépôt introuvable");
    return responseHandler.ok(res, store);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 5. Supprimer un dépôt
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
        "Impossible de supprimer un dépôt contenant encore du stock",
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
 * TRANSFERER DU STOCK (Correction de la mise à jour des quantités)
 */
export const transferStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromStoreId, toStoreId, productId, quantityCartons } = req.body;
    const qty = Number(quantityCartons);
    const userId = req.user?._id;

    if (qty <= 0) throw new Error("La quantité doit être supérieure à 0.");

    // 1. Vérification et chargement
    const product = await Product.findById(productId).session(session);
    const sourceStore = await Store.findById(fromStoreId).session(session);
    const destStore = await Store.findById(toStoreId).session(session);

    if (!product || !sourceStore || !destStore)
      throw new Error("Produit ou Dépôt introuvable.");

    // 2. Débiter le stock source (Opérateur positionnel $)
    const sourceUpdate = await Store.updateOne(
      {
        _id: fromStoreId,
        "items.product": productId,
        "items.quantityCartons": { $gte: qty },
      },
      { $inc: { "items.$.quantityCartons": -qty } },
      { session },
    );

    if (sourceUpdate.modifiedCount === 0)
      throw new Error(
        "Stock insuffisant ou produit non trouvé dans le dépôt source.",
      );

    // 3. Créditer le stock destination
    const destUpdate = await Store.updateOne(
      { _id: toStoreId, "items.product": productId },
      { $inc: { "items.$.quantityCartons": qty } },
      { session },
    );

    // Si le produit n'existe pas encore dans le dépôt de destination, on l'ajoute
    if (destUpdate.matchedCount === 0) {
      await Store.updateOne(
        { _id: toStoreId },
        { $push: { items: { product: productId, quantityCartons: qty } } },
        { session },
      );
    }

    // 4. Historique
    const movementType =
      sourceStore.type === "secondaire" && destStore.type === "principal"
        ? "retour"
        : "transfert";
    const history = new StockHistory({
      product: productId,
      fromStore: fromStoreId,
      toStore: toStoreId,
      quantity: qty,
      type: movementType,
      description: `${movementType === "retour" ? "Retour" : "Transfert"} de ${qty} carton(s) de ${product.name} de ${sourceStore.name} vers ${destStore.name}`,
      userId: userId,
      date: new Date(),
    });

    await history.save({ session });
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
 * DECLARER UNE PERTE
 */
export const declareLoss = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params; // Store ID
    const { productId, quantityCartons, reason } = req.body;
    const qty = Number(quantityCartons);
    const userId = req.user?._id;

    if (qty <= 0) throw new Error("Quantité invalide.");

    const product = await Product.findById(productId).session(session);
    const store = await Store.findById(id).session(session);

    if (!product || !store) throw new Error("Produit ou Dépôt introuvable.");

    // Mettre à jour le stock (Soustraction)
    const updateResult = await Store.updateOne(
      {
        _id: id,
        "items.product": productId,
        "items.quantityCartons": { $gte: qty },
      },
      { $inc: { "items.$.quantityCartons": -qty } },
      { session },
    );

    if (updateResult.modifiedCount === 0)
      throw new Error("Stock insuffisant pour déclarer cette perte.");

    // Créer l'historique
    const history = new StockHistory({
      product: productId,
      fromStore: id,
      quantity: qty,
      type: "perte",
      description: `Perte : ${qty} carton(s) de ${product.name} (${store.name}). Motif: ${reason}`,
      userId: userId,
      date: new Date(),
    });

    await history.save({ session });
    await session.commitTransaction();

    return responseHandler.ok(res, null, `Perte enregistrée : ${reason}`);
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 400);
  } finally {
    session.endSession();
  }
};
