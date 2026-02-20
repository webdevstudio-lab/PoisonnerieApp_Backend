import {
  VenteJour,
  Store,
  Product,
  StockHistory,
  Sale,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

export const addVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      items,
      storeId,
      salePointId,
      date,
      observation,
      isCredit,
      clientId,
    } = req.body;
    const sellerId = req.user?._id;

    if (!items?.length) throw new Error("Aucun produit sélectionné.");

    let totalVente = 0;
    const inventorySold = [];

    // --- PHASE 1 : CALCUL ET DÉDUCTION STOCKS ---
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
        throw new Error(`Stock insuffisant pour : ${product.name}`);

      await new StockHistory({
        product: product._id,
        fromStore: storeId,
        quantity: qty,
        type: "vente",
        description: `Vente ${isCredit ? "CRÉDIT" : "CASH"} du ${new Date(date || Date.now()).toLocaleDateString()}`,
        userId: sellerId,
      }).save({ session });
    }

    // --- PHASE 2 : GESTION FINANCIÈRE (CRÉDIT VS CASH) ---
    if (isCredit) {
      if (!clientId) throw new Error("Client requis pour une vente à crédit.");
      const client = await Client.findById(clientId).session(session);

      if (!client) throw new Error("Client introuvable.");
      if (client.isRestricted)
        throw new Error(`Client bloqué: ${client.restrictionReason}`);
      if (client.currentDebt + totalVente > client.creditLimit) {
        throw new Error(
          `Limite de crédit dépassée (Max: ${client.creditLimit})`,
        );
      }

      await Client.findByIdAndUpdate(
        clientId,
        { $inc: { currentDebt: totalVente } },
        { session },
      );
      await Sale.findByIdAndUpdate(
        salePointId,
        { $inc: { impayer: totalVente } },
        { session },
      );
    } else {
      await Sale.findByIdAndUpdate(
        salePointId,
        { $inc: { solde: totalVente } },
        { session },
      );
    }

    // --- PHASE 3 : SAUVEGARDE ---
    const newVenteJour = new VenteJour({
      salePoint: salePointId,
      store: storeId,
      vendeur: sellerId,
      isCredit: !!isCredit,
      client: isCredit ? clientId : null,
      date: date || new Date(),
      inventorySold,
      totalAmount: totalVente,
      observation,
    });

    await newVenteJour.save({ session });
    await session.commitTransaction();

    const result = await VenteJour.findById(newVenteJour._id)
      .populate("vendeur", "name")
      .populate("client", "name")
      .populate("inventorySold.product", "name");

    return responseHandler.created(
      res,
      result,
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
 * 2. MODIFIER UNE VENTE (RECALCUL COMPLET)
 */
export const updateVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const {
      items,
      storeId,
      salePointId,
      observation,
      date,
      isCredit,
      clientId,
    } = req.body;

    const oldVente = await VenteJour.findById(id).session(session);
    if (!oldVente) throw new Error("Vente introuvable");

    // --- ÉTAPE 1 : ANNULER L'ANCIENNE VENTE (Stock + Finances) ---
    for (const item of oldVente.inventorySold) {
      await Store.updateOne(
        { _id: oldVente.store, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": item.cartonsSold } },
        { session },
      );
    }
    if (oldVente.isCredit) {
      await Client.findByIdAndUpdate(
        oldVente.client,
        { $inc: { currentDebt: -oldVente.totalAmount } },
        { session },
      );
      await Sale.findByIdAndUpdate(
        oldVente.salePoint,
        { $inc: { impayer: -oldVente.totalAmount } },
        { session },
      );
    } else {
      await Sale.findByIdAndUpdate(
        oldVente.salePoint,
        { $inc: { solde: -oldVente.totalAmount } },
        { session },
      );
    }

    // --- ÉTAPE 2 : APPLIQUER LA NOUVELLE VENTE (Logique similaire à addVenteJour) ---
    // Note: Pour simplifier, on recalcule tout sur la base des nouveaux items
    let newTotalVente = 0;
    const newInventorySold = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      const qty = Math.abs(Number(item.cartonsSold));
      const product = await Product.findById(productId).session(session);

      const subTotal = qty * product.sellingPrice;
      newTotalVente += subTotal;

      newInventorySold.push({
        product: product._id,
        cartonsSold: qty,
        unitPrice: product.sellingPrice,
        subTotal,
      });

      const updatedStore = await Store.findOneAndUpdate(
        {
          _id: storeId || oldVente.store,
          "items.product": product._id,
          "items.quantityCartons": { $gte: qty },
        },
        { $inc: { "items.$.quantityCartons": -qty } },
        { session, new: true },
      );
      if (!updatedStore)
        throw new Error(`Stock insuffisant pour ${product.name}`);
    }

    // --- ÉTAPE 3 : NOUVELLE GESTION FINANCIÈRE ---
    if (isCredit) {
      await Client.findByIdAndUpdate(
        clientId,
        { $inc: { currentDebt: newTotalVente } },
        { session },
      );
      await Sale.findByIdAndUpdate(
        salePointId,
        { $inc: { impayer: newTotalVente } },
        { session },
      );
    } else {
      await Sale.findByIdAndUpdate(
        salePointId,
        { $inc: { solde: newTotalVente } },
        { session },
      );
    }

    oldVente.inventorySold = newInventorySold;
    oldVente.totalAmount = newTotalVente;
    oldVente.isCredit = isCredit;
    oldVente.client = isCredit ? clientId : null;
    oldVente.observation = observation || oldVente.observation;
    oldVente.date = date || oldVente.date;

    await oldVente.save({ session });
    await session.commitTransaction();

    return responseHandler.ok(res, oldVente, "Mise à jour réussie");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 3. SUPPRIMER UNE VENTE
 */
export const deleteVenteJour = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const vente = await VenteJour.findById(id).session(session);
    if (!vente) throw new Error("Vente introuvable");

    for (const item of vente.inventorySold) {
      await Store.updateOne(
        { _id: vente.store, "items.product": item.product },
        { $inc: { "items.$.quantityCartons": item.cartonsSold } },
        { session },
      );
    }

    if (vente.isCredit) {
      await Client.findByIdAndUpdate(
        vente.client,
        { $inc: { currentDebt: -vente.totalAmount } },
        { session },
      );
      await Sale.findByIdAndUpdate(
        vente.salePoint,
        { $inc: { impayer: -vente.totalAmount } },
        { session },
      );
    } else {
      await Sale.findByIdAndUpdate(
        vente.salePoint,
        { $inc: { solde: -vente.totalAmount } },
        { session },
      );
    }

    await VenteJour.findByIdAndDelete(id, { session });
    await session.commitTransaction();

    return responseHandler.ok(res, null, "Vente supprimée et comptes ajustés");
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
