import {
  Store,
  Purchase,
  Depense,
  CategoryDepense,
  CaisseGenerale,
  HistoriqueCaisseGenerale,
  Product,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

/**
 * 1. ENREGISTRER UN NOUVEL ACHAT
 * Utilise unitPurchasePrice pour le calcul de sortie de caisse.
 */
export const addAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplierId, storeId, items, description, buyerId } = req.body;
    const finalBuyerId = req.user?._id || buyerId;

    // Calcul du total basé sur les prix d'achat fournis
    const totalAchat = items.reduce(
      (acc, item) =>
        acc + Number(item.quantity) * Number(item.unitPurchasePrice),
      0,
    );

    const caisse = await CaisseGenerale.findOne().session(session);
    if (!caisse || caisse.soldeActuel < totalAchat) {
      throw new Error(
        `Solde caisse insuffisant (${caisse?.soldeActuel || 0} FCFA disponibles)`,
      );
    }

    // Création de l'achat
    const newPurchase = new Purchase({
      supplier: supplierId,
      destinedStore: storeId,
      items: items.map((item) => ({
        product: item.productId,
        quantity: Number(item.quantity),
        unitPurchasePrice: Number(item.unitPurchasePrice),
      })),
      buyer: finalBuyerId,
      description: description || "Ravitaillement",
    });
    await newPurchase.save({ session });

    // Mouvement Caisse (SORTIE)
    caisse.soldeActuel -= totalAchat;
    caisse.totalSorties += totalAchat;
    await caisse.save({ session });

    await new HistoriqueCaisseGenerale({
      type: "SORTIE",
      categorie: "DEPENSE",
      montant: totalAchat,
      soldeApresOperation: caisse.soldeActuel,
      achatRef: newPurchase._id,
      description: `Achat marchandises - RÉF: ${newPurchase._id.toString().slice(-6).toUpperCase()}`,
      effectuePar: finalBuyerId,
    }).save({ session });

    // Mise à jour des Stocks (Uniquement quantités)
    for (const item of items) {
      const resUpdate = await Store.updateOne(
        { _id: storeId, "items.product": item.productId },
        { $inc: { "items.$.quantityCartons": Number(item.quantity) } },
        { session },
      );
      if (resUpdate.matchedCount === 0) {
        await Store.updateOne(
          { _id: storeId },
          {
            $push: {
              items: {
                product: item.productId,
                quantityCartons: Number(item.quantity),
              },
            },
          },
          { session },
        );
      }
    }

    // Création de la Dépense Financière
    const category = await CategoryDepense.findOneAndUpdate(
      { name: "ACHAT DE MARCHANDISES" },
      { $setOnInsert: { color: "#EF4444" } },
      { upsert: true, new: true, session },
    );

    const newDepense = await new Depense({
      label: `Achat Marchandises`,
      amount: totalAchat,
      category: category._id,
      user: finalBuyerId,
      note: `ACHAT RÉF: ${newPurchase._id.toString().slice(-6).toUpperCase()}`,
    }).save({ session });

    newPurchase.depenseId = newDepense._id;
    await newPurchase.save({ session });

    await session.commitTransaction();
    return responseHandler.created(
      res,
      newPurchase,
      "Achat enregistré avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 2. RÉCUPÉRER TOUS LES ACHATS
 */
export const getAllAchat = async (req, res) => {
  try {
    const achats = await Purchase.find()
      .populate("supplier buyer destinedStore")
      .sort({ createdAt: -1 });
    return responseHandler.ok(res, achats);
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
 * 3. DÉTAILS D'UN ACHAT
 */
export const getOneAchat = async (req, res) => {
  try {
    const achat = await Purchase.findById(req.params.id).populate(
      "supplier items.product buyer destinedStore",
    );
    if (!achat) return responseHandler.notFound(res, "Achat introuvable");
    return responseHandler.ok(res, achat);
  } catch (error) {
    return responseHandler.error(res, "Erreur détails", 500, error.message);
  }
};

/**
 * 4. MISE À JOUR (MODIFICATION)
 */
export const updateAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { items, destinedStore } = req.body;
    const oldPurchase = await Purchase.findById(id).session(session);
    if (!oldPurchase) throw new Error("Achat introuvable");

    const caisse = await CaisseGenerale.findOne().session(session);

    // Annulation financier et stock ancien
    const oldTotal = oldPurchase.items.reduce(
      (acc, i) => acc + i.quantity * i.unitPurchasePrice,
      0,
    );
    for (const item of oldPurchase.items) {
      await Store.updateOne(
        { _id: oldPurchase.destinedStore, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": -item.quantity } },
        { session },
      );
    }

    // Préparation nouveau calcul
    const newItems = items.map((i) => ({
      product: i.product?._id || i.product,
      quantity: Number(i.quantity),
      unitPurchasePrice: Number(i.unitPurchasePrice),
    }));
    const newTotal = newItems.reduce(
      (acc, i) => acc + i.quantity * i.unitPurchasePrice,
      0,
    );

    // Ajustement Caisse
    const diff = newTotal - oldTotal;
    if (caisse.soldeActuel < diff) throw new Error("Solde caisse insuffisant");
    caisse.soldeActuel -= diff;
    await caisse.save({ session });

    // Application nouveau stock
    oldPurchase.items = newItems;
    oldPurchase.destinedStore = destinedStore || oldPurchase.destinedStore;
    await oldPurchase.save({ session });

    for (const item of newItems) {
      await Store.updateOne(
        { _id: oldPurchase.destinedStore, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": item.quantity } },
        { session },
      );
    }

    await session.commitTransaction();
    return responseHandler.ok(res, oldPurchase, "Achat mis à jour");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 5. SUPPRIMER UN ACHAT COMPLET
 */
export const deleteAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const achat = await Purchase.findById(req.params.id).session(session);
    if (!achat) throw new Error("Achat introuvable");

    const caisse = await CaisseGenerale.findOne().session(session);
    const totalARestituer = achat.items.reduce(
      (acc, i) => acc + i.quantity * i.unitPurchasePrice,
      0,
    );

    // Restitution
    caisse.soldeActuel += totalARestituer;
    await caisse.save({ session });

    for (const item of achat.items) {
      await Store.updateOne(
        { _id: achat.destinedStore, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": -item.quantity } },
        { session },
      );
    }

    if (achat.depenseId)
      await Depense.findByIdAndDelete(achat.depenseId, { session });
    await Purchase.findByIdAndDelete(req.params.id, { session });

    await session.commitTransaction();
    return responseHandler.ok(
      res,
      null,
      "Achat supprimé, stock et caisse rétablis",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 6. RETIRER UN SEUL PRODUIT D'UN ACHAT
 */
export const deleteOneProductAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { achatId, productId } = req.params;
    const achat = await Purchase.findById(achatId).session(session);
    if (!achat) throw new Error("Achat introuvable");

    const itemIndex = achat.items.findIndex(
      (p) => p.product.toString() === productId,
    );
    if (itemIndex === -1) throw new Error("Produit non trouvé dans cet achat");

    const item = achat.items[itemIndex];
    const amountToRestituer = item.quantity * item.unitPurchasePrice;

    // Restitution Caisse
    const caisse = await CaisseGenerale.findOne().session(session);
    caisse.soldeActuel += amountToRestituer;
    await caisse.save({ session });

    // Mise à jour stock
    await Store.updateOne(
      { _id: achat.destinedStore, "items.product": productId },
      { $inc: { "items.$.quantityCartons": -item.quantity } },
      { session },
    );

    achat.items.splice(itemIndex, 1);
    await achat.save({ session });

    await session.commitTransaction();
    return responseHandler.ok(res, achat, "Produit retiré avec succès");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};
