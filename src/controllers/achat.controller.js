import {
  Store,
  Supplier,
  Purchase,
  Depense,
  CategoryDepense,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

/**
 * 1. ENREGISTRER UN NOUVEL ACHAT
 * - Crée l'achat, met à jour le stock, ajuste le solde fournisseur et crée une dépense.
 */
export const addAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplierId, storeId, items, description, buyerId } = req.body;
    const finalBuyerId = req.user?._id || buyerId;

    if (!finalBuyerId) throw new Error("ID acheteur manquant.");

    // Récupération des infos fournisseur et boutique pour le libellé
    const [supplier, store] = await Promise.all([
      Supplier.findById(supplierId).session(session),
      Store.findById(storeId).session(session),
    ]);

    // Gestion automatique de la catégorie de dépense
    const category = await CategoryDepense.findOneAndUpdate(
      { name: "ACHAT DE MARCHANDISES" },
      {
        $setOnInsert: { color: "#EF4444", description: "Achats marchandises" },
      },
      { upsert: true, new: true, session },
    );

    // Création de l'objet Achat
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

    // Création de la dépense financière liée
    const newDepense = new Depense({
      label: `Achat chez ${supplier?.name || "Fournisseur"}`,
      amount: newPurchase.totalAmount,
      category: category._id,
      user: finalBuyerId,
      note: `ACHAT #${newPurchase._id.toString().slice(-6).toUpperCase()}`,
      date: new Date(),
    });
    await newDepense.save({ session });

    // Lier la dépense à l'achat
    newPurchase.depenseId = newDepense._id;
    await newPurchase.save({ session });

    // Mise à jour des stocks (Logic Upsert)
    for (const item of items) {
      const updateRes = await Store.updateOne(
        { _id: storeId, "items.product": item.productId },
        { $inc: { "items.$.quantityCartons": Number(item.quantity) } },
        { session },
      );

      if (updateRes.matchedCount === 0) {
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

    // Mise à jour du solde dû au fournisseur
    await Supplier.findByIdAndUpdate(
      supplierId,
      { $inc: { balance: newPurchase.totalAmount } },
      { session },
    );

    await session.commitTransaction();
    return responseHandler.created(
      res,
      newPurchase,
      "Achat enregistré avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(
      res,
      "Erreur lors de l'achat",
      500,
      error.message,
    );
  } finally {
    session.endSession();
  }
};

/**
 * 2. RÉCUPÉRER TOUS LES ACHATS (Liste globale)
 */
export const getAllAchat = async (req, res) => {
  try {
    const achats = await Purchase.find()
      .populate("supplier", "name")
      .populate("buyer", "name")
      .populate("destinedStore", "name")
      .sort({ createdAt: -1 });
    return responseHandler.ok(res, achats);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
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
    const achat = await Purchase.findById(req.params.id)
      .populate("supplier", "name contact balance")
      .populate("items.product", "name category sellingPrice")
      .populate("buyer", "name")
      .populate("destinedStore", "name type");

    if (!achat) return responseHandler.notFound(res, "Achat introuvable");
    return responseHandler.ok(res, achat);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

/**
 * 4. MISE À JOUR MULTIPLE (Quantités, Prix, Items, Boutique, Description)
 * - Gère le transfert de stock si la boutique de destination change.
 */
export const updateAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { items, description, destinedStore } = req.body;

    // 1. Récupérer l'état actuel de l'achat avant modif
    const oldPurchase = await Purchase.findById(id).session(session);
    if (!oldPurchase) return responseHandler.notFound(res, "Achat introuvable");

    const oldTotal = oldPurchase.totalAmount;
    const oldStoreId = oldPurchase.destinedStore;
    // Déterminer la nouvelle boutique (si fournie, sinon garder l'ancienne)
    const newStoreId = destinedStore || oldStoreId;

    // A. ANNULER L'ANCIEN STOCK (sur l'ancienne boutique)
    for (const oldItem of oldPurchase.items) {
      await Store.updateOne(
        { _id: oldStoreId, "items.product": oldItem.product },
        { $inc: { "items.$.quantityCartons": -oldItem.quantity } },
        { session },
      );
    }

    // B. METTRE À JOUR LES DONNÉES DE L'ACHAT
    oldPurchase.items = items.map((item) => ({
      product: item.product?._id || item.product,
      quantity: Number(item.quantity),
      unitPurchasePrice: Number(item.unitPurchasePrice),
    }));

    if (description) oldPurchase.description = description;
    oldPurchase.destinedStore = newStoreId; // Mise à jour de la boutique

    // Sauvegarde (déclenche le middleware pre-save pour recalculer totalAmount)
    await oldPurchase.save({ session });

    // C. APPLIQUER LE NOUVEAU STOCK (sur la nouvelle boutique)
    for (const newItem of oldPurchase.items) {
      const updateRes = await Store.updateOne(
        { _id: newStoreId, "items.product": newItem.product },
        { $inc: { "items.$.quantityCartons": newItem.quantity } },
        { session },
      );

      // Si le produit n'existe pas encore dans la nouvelle boutique, on le crée
      if (updateRes.matchedCount === 0) {
        await Store.updateOne(
          { _id: newStoreId },
          {
            $push: {
              items: {
                product: newItem.product,
                quantityCartons: newItem.quantity,
              },
            },
          },
          { session },
        );
      }
    }

    // D. AJUSTER LES FINANCES
    const diffTotal = oldPurchase.totalAmount - oldTotal;

    // Ajuster solde fournisseur
    await Supplier.findByIdAndUpdate(
      oldPurchase.supplier,
      { $inc: { balance: diffTotal } },
      { session },
    );

    // Mettre à jour la dépense associée
    if (oldPurchase.depenseId) {
      const storeLabel = await Store.findById(newStoreId).select("name");
      await Depense.findByIdAndUpdate(
        oldPurchase.depenseId,
        {
          amount: oldPurchase.totalAmount,
          label: `Achat marchandises - ${storeLabel?.name || "Boutique"}`,
          note: `MODIFIÉ LE ${new Date().toLocaleDateString()} (Transfert Boutique incl.)`,
        },
        { session },
      );
    }

    await session.commitTransaction();
    return responseHandler.ok(
      res,
      oldPurchase,
      "Achat et stocks (transfert inclus) mis à jour",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(
      res,
      "Erreur mise à jour et transfert",
      500,
      error.message,
    );
  } finally {
    session.endSession();
  }
};

/**
 * 5. SUPPRIMER UN ACHAT COMPLET (Annulation)
 */
export const deleteAchat = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const achat = await Purchase.findById(req.params.id).session(session);
    if (!achat) return responseHandler.notFound(res, "Achat introuvable");

    // Retrait du stock et ajustement solde
    for (const item of achat.items) {
      await Store.updateOne(
        { _id: achat.destinedStore, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": -item.quantity } },
        { session },
      );
    }

    await Supplier.findByIdAndUpdate(
      achat.supplier,
      { $inc: { balance: -achat.totalAmount } },
      { session },
    );

    if (achat.depenseId)
      await Depense.findByIdAndDelete(achat.depenseId, { session });
    await Purchase.findByIdAndDelete(req.params.id, { session });

    await session.commitTransaction();
    return responseHandler.ok(res, null, "Achat annulé et stocks restaurés");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, "Erreur suppression", 500, error.message);
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
    if (!achat) return responseHandler.notFound(res, "Achat introuvable");

    const itemIndex = achat.items.findIndex(
      (p) => p.product.toString() === productId,
    );
    if (itemIndex === -1)
      return responseHandler.notFound(
        res,
        "Produit non présent dans cet achat",
      );

    const item = achat.items[itemIndex];
    const amountToSubtract = item.quantity * item.unitPurchasePrice;

    // Mise à jour Stock et Fournisseur
    await Store.updateOne(
      { _id: achat.destinedStore, "items.product": productId },
      { $inc: { "items.$.quantityCartons": -item.quantity } },
      { session },
    );
    await Supplier.findByIdAndUpdate(
      achat.supplier,
      { $inc: { balance: -amountToSubtract } },
      { session },
    );

    // Retrait de l'item du tableau
    achat.items.splice(itemIndex, 1);

    if (achat.items.length === 0) {
      // Si plus de produits, on supprime l'achat
      if (achat.depenseId)
        await Depense.findByIdAndDelete(achat.depenseId, { session });
      await Purchase.findByIdAndDelete(achatId, { session });
    } else {
      await achat.save({ session });
      if (achat.depenseId) {
        await Depense.findByIdAndUpdate(
          achat.depenseId,
          { amount: achat.totalAmount },
          { session },
        );
      }
    }

    await session.commitTransaction();
    return responseHandler.ok(res, achat, "Produit retiré de l'achat");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, "Erreur", 500, error.message);
  } finally {
    session.endSession();
  }
};
