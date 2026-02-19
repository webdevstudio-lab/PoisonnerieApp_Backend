import {
  VenteJour,
  Store,
  Product,
  StockHistory,
  Sale,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

/**
 * 1. AJOUTER UNE VENTE DU JOUR
 */
export const addVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, storeId, salePointId, date, observation } = req.body;
    const sellerId = req.user?._id;

    if (!items || !Array.isArray(items) || items.length === 0)
      throw new Error("Aucun produit sélectionné.");

    let totalVente = 0;
    const inventorySold = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      const qty = Math.abs(Number(item.cartonsSold));

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error(`Produit introuvable : ${productId}`);

      const subTotal = qty * product.sellingPrice;
      totalVente += subTotal;

      inventorySold.push({
        product: product._id,
        cartonsSold: qty,
        unitPrice: product.sellingPrice,
        subTotal: subTotal,
      });

      // Déduction du stock avec vérification de disponibilité
      const updatedStore = await Store.findOneAndUpdate(
        {
          _id: storeId,
          "items.product": product._id,
          "items.quantityCartons": { $gte: qty },
        },
        { $inc: { "items.$.quantityCartons": -qty } },
        { session, new: true },
      );

      if (!updatedStore)
        throw new Error(`Stock insuffisant pour le produit : ${product.name}`);

      await new StockHistory({
        product: product._id,
        fromStore: storeId,
        quantity: qty,
        type: "vente",
        description: `Vente journalière du ${new Date(date || Date.now()).toLocaleDateString()}`,
        userId: sellerId,
      }).save({ session });
    }

    const newVenteJour = new VenteJour({
      salePoint: salePointId,
      store: storeId,
      vendeur: sellerId,
      date: date || new Date(),
      inventorySold,
      totalAmount: totalVente,
      observation,
    });

    await newVenteJour.save({ session });

    // Mise à jour du solde de la boutique
    await Sale.findByIdAndUpdate(
      salePointId,
      { $inc: { solde: totalVente } },
      { session },
    );

    await session.commitTransaction();

    const populatedVente = await VenteJour.findById(newVenteJour._id)
      .populate("vendeur", "name")
      .populate("salePoint", "name")
      .populate("inventorySold.product", "name");

    return responseHandler.created(
      res,
      populatedVente,
      "Vente enregistrée avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 2. MODIFIER UNE VENTE DU JOUR (CORRECTION FATALE)
 * Méthode : Restitution totale de l'ancienne vente -> Vérification nouvelle vente -> Application
 */
/**
 * 2. MODIFIER UNE VENTE DU JOUR (CORRECTIF SÉCURITÉ STOCK)
 */
export const updateVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { items, storeId, salePointId, observation, date } = req.body;
    const userId = req.user?._id;

    const oldVente = await VenteJour.findById(id).session(session);
    if (!oldVente) throw new Error("Vente introuvable");

    const targetStoreId = storeId || oldVente.store;
    const targetSalePointId = salePointId || oldVente.salePoint;

    // --- ETAPE 1 : RÉCUPÉRER L'ÉTAT ACTUEL DU STOCK ---
    const currentStore = await Store.findById(targetStoreId).session(session);
    if (!currentStore) throw new Error("Entrepôt introuvable");

    // --- ETAPE 2 : CALCULER LE STOCK VIRTUEL (Stock actuel + Restitution) ---
    // On crée une copie de travail du stock pour simuler la modification
    let virtualStock = [...currentStore.items];

    // On restitue virtuellement les anciens articles
    for (const oldItem of oldVente.inventorySold) {
      const stockIdx = virtualStock.findIndex(
        (s) => s.product.toString() === oldItem.product.toString(),
      );
      if (stockIdx !== -1) {
        virtualStock[stockIdx].quantityCartons += oldItem.cartonsSold;
      }
    }

    // --- ETAPE 3 : VÉRIFIER LA FAISABILITÉ DE LA NOUVELLE VENTE ---
    let newTotalVente = 0;
    const newInventorySold = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      const qty = Math.abs(Number(item.cartonsSold));

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error(`Produit introuvable en base`);

      // Vérification dans le stock virtuel
      const vStockItem = virtualStock.find(
        (s) => s.product.toString() === productId.toString(),
      );

      if (!vStockItem || vStockItem.quantityCartons < qty) {
        throw new Error(
          `Stock insuffisant pour ${product.name}. Disponible après restitution : ${vStockItem ? vStockItem.quantityCartons : 0}`,
        );
      }

      // Mise à jour du stock virtuel pour les items suivants (au cas où le même produit est cité 2 fois)
      vStockItem.quantityCartons -= qty;

      const subTotal = qty * product.sellingPrice;
      newTotalVente += subTotal;

      newInventorySold.push({
        product: product._id,
        cartonsSold: qty,
        unitPrice: product.sellingPrice,
        subTotal: subTotal,
      });
    }

    // --- ETAPE 4 : SI TOUT EST OK, APPLIQUER RÉELLEMENT ---

    // A. Appliquer la restitution réelle sur le Store
    for (const oldItem of oldVente.inventorySold) {
      await Store.updateOne(
        { _id: oldVente.store, "items.product": oldItem.product },
        { $inc: { "items.$.quantityCartons": oldItem.cartonsSold } },
        { session },
      );
    }

    // B. Appliquer les nouvelles déductions sur le Store
    for (const newItem of newInventorySold) {
      await Store.updateOne(
        { _id: targetStoreId, "items.product": newItem.product },
        { $inc: { "items.$.quantityCartons": -newItem.cartonsSold } },
        { session },
      );
    }

    // C. Ajuster le solde de la boutique (Ancien vs Nouveau)
    const diffSolde = newTotalVente - oldVente.totalAmount;
    await Sale.findByIdAndUpdate(
      targetSalePointId,
      { $inc: { solde: diffSolde } },
      { session },
    );

    // D. Mettre à jour le document de vente
    oldVente.inventorySold = newInventorySold;
    oldVente.totalAmount = newTotalVente;
    oldVente.observation = observation || oldVente.observation;
    oldVente.date = date || oldVente.date;
    oldVente.store = targetStoreId;
    oldVente.salePoint = targetSalePointId;

    await oldVente.save({ session });

    await session.commitTransaction();

    const result = await VenteJour.findById(id)
      .populate("vendeur", "name")
      .populate("salePoint", "name")
      .populate("inventorySold.product", "name");

    return responseHandler.ok(res, result, "Mise à jour sécurisée réussie");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 3. SUPPRIMER UNE VENTE DU JOUR
 */
export const deleteVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const vente = await VenteJour.findById(id).session(session);
    if (!vente) throw new Error("Vente introuvable");

    // Restitution des stocks
    for (const item of vente.inventorySold) {
      await Store.updateOne(
        { _id: vente.store, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": item.cartonsSold } },
        { session },
      );

      await new StockHistory({
        product: item.product,
        fromStore: vente.store,
        quantity: item.cartonsSold,
        type: "retour",
        description: `Annulation vente #${id.slice(-6)}`,
        userId: req.user?._id,
      }).save({ session });
    }

    // Déduction du montant du solde de la boutique
    await Sale.findByIdAndUpdate(
      vente.salePoint,
      { $inc: { solde: -vente.totalAmount } },
      { session },
    );

    await VenteJour.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    return responseHandler.ok(res, null, "Vente supprimée avec succès");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 4. RÉCUPÉRER TOUTES LES VENTES
 */
export const getAllVentesJour = async (req, res) => {
  try {
    const ventes = await VenteJour.find()
      .populate("vendeur", "name")
      .populate("salePoint", "name")
      .populate("inventorySold.product", "name")
      .sort({ date: -1, createdAt: -1 });

    return responseHandler.ok(res, ventes);
  } catch (error) {
    return responseHandler.error(res, error.message, 500);
  }
};

/**
 * 5. RÉCUPÉRER LES VENTES D'UNE BOUTIQUE / POINT DE VENTE
 */
export const getVentesByStore = async (req, res) => {
  try {
    const id = req.params.storeId || req.params.salePointId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responseHandler.error(res, "ID invalide", 400);
    }

    const ventes = await VenteJour.find({
      $or: [{ store: id }, { salePoint: id }],
    })
      .populate("vendeur", "name")
      .populate("salePoint", "name")
      .populate("inventorySold.product", "name")
      .sort({ date: -1, createdAt: -1 });

    return responseHandler.ok(res, ventes);
  } catch (error) {
    return responseHandler.error(res, error.message, 500);
  }
};

/**
 * 6. RÉCUPÉRER UNE VENTE PAR SON ID
 */
export const getVenteById = async (req, res) => {
  try {
    const vente = await VenteJour.findById(req.params.id)
      .populate("vendeur", "name")
      .populate("salePoint", "name")
      .populate("inventorySold.product", "name");

    if (!vente) return responseHandler.notFound(res, "Vente introuvable");

    return responseHandler.ok(res, vente);
  } catch (error) {
    return responseHandler.error(res, error.message, 500);
  }
};

/**
 * OBTENIR LES STATS DE VENTES (Semaine, Mois, Année)
 */
export const getVenteStats = async (req, res) => {
  try {
    const { salePointId } = req.params;
    const { filter = "week" } = req.query;

    let dateLimit = new Date();
    dateLimit.setHours(0, 0, 0, 0); // On commence au début d'aujourd'hui

    if (filter === "week") {
      dateLimit.setDate(dateLimit.getDate() - 7);
    } else if (filter === "month") {
      dateLimit.setMonth(dateLimit.getMonth() - 1);
    } else {
      dateLimit.setFullYear(dateLimit.getFullYear() - 1);
    }

    const stats = await VenteJour.aggregate([
      {
        $match: {
          salePoint: new mongoose.Types.ObjectId(salePointId),
          // Utilisation de gte pour inclure aujourd'hui
          date: { $gte: dateLimit },
        },
      },
      {
        $group: {
          _id:
            filter === "year"
              ? { $month: "$date" }
              : filter === "week"
                ? { $dayOfWeek: "$date" }
                : { $dayOfMonth: "$date" },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // --- LOGIQUE DE REMPLISSAGE (Padding) ---
    // Pour éviter le message "Aucune vente" si une seule donnée existe
    const labelsWeek = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const labelsMonth = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Août",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];

    let formattedData = [];

    if (filter === "week") {
      // On génère les 7 derniers jours avec 0 par défaut
      formattedData = labelsWeek.map((label, index) => {
        const found = stats.find((s) => s._id === index + 1);
        return { name: label, total: found ? found.total : 0 };
      });
    } else if (filter === "year") {
      formattedData = labelsMonth.map((label, index) => {
        const found = stats.find((s) => s._id === index + 1);
        return { name: label, total: found ? found.total : 0 };
      });
    } else {
      // Pour le mois, on renvoie juste les jours existants ou un formatage simple
      formattedData = stats.map((s) => ({
        name: `Jour ${s._id}`,
        total: s.total,
      }));
    }

    return responseHandler.ok(res, formattedData);
  } catch (error) {
    return responseHandler.error(res, error.message, 500);
  }
};
