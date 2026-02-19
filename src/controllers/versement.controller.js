import mongoose from "mongoose";
import {
  OwnerPayment,
  CaisseGenerale,
  HistoriqueCaisseGenerale,
  Sale,
} from "../databases/index.database.js"; // Ajuste les chemins
import responseHandler from "../utils/responseHandler.js";

/**
 * 1. AJOUTER UN VERSEMENT
 */
export const addVersement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { salePointId, amount, paymentMethod, date, note } = req.body;
    const receivedBy = req.user?._id;
    const valAmount = Number(amount);

    // 1. Déduction du solde de la boutique
    const updatedSalePoint = await Sale.findByIdAndUpdate(
      salePointId,
      { $inc: { solde: -valAmount } },
      { session, new: true },
    );
    if (!updatedSalePoint) throw new Error("Point de vente introuvable.");

    // 2. Mise à jour de la Caisse Générale
    const caisse = await CaisseGenerale.findOneAndUpdate(
      {}, // On récupère l'unique caisse
      {
        $inc: { soldeActuel: valAmount, totalEntrees: valAmount },
        $set: { derniereMiseAJour: new Date() },
      },
      { session, upsert: true, new: true },
    );

    // 3. Création de l'historique de caisse
    const history = new HistoriqueCaisseGenerale({
      type: "ENTREE",
      categorie: "VERSEMENT_BOUTIQUE",
      montant: valAmount,
      soldeApresOperation: caisse.soldeActuel,
      boutiqueSource: salePointId,
      description: note || `Versement de la boutique ${updatedSalePoint.name}`,
      effectuePar: receivedBy,
      dateOperation: date || new Date(),
    });
    await history.save({ session });

    // 4. Enregistrement du versement
    const newVersement = new OwnerPayment({
      salePoint: salePointId,
      amount: valAmount,
      paymentMethod,
      date: date || new Date(),
      receivedBy,
      note,
      caisseHistoryRef: history._id,
    });
    await newVersement.save({ session });

    await session.commitTransaction();
    return responseHandler.created(
      res,
      newVersement,
      "Versement effectué avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 2. MODIFIER UN VERSEMENT (CORRECTION COMPTABLE)
 */
export const updateVersement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amount: newAmount, paymentMethod, note, date } = req.body;
    const valNewAmount = Number(newAmount);

    const oldVersement = await OwnerPayment.findById(id).session(session);
    if (!oldVersement) throw new Error("Versement introuvable");

    const diff = valNewAmount - oldVersement.amount;

    if (diff !== 0) {
      // Ajuster le solde de la boutique (on retire la différence)
      await Sale.findByIdAndUpdate(
        oldVersement.salePoint,
        { $inc: { solde: -diff } },
        { session },
      );

      // Ajuster la caisse générale
      const caisse = await CaisseGenerale.findOneAndUpdate(
        {},
        { $inc: { soldeActuel: diff, totalEntrees: diff } },
        { session, new: true },
      );

      // Créer une trace de rectification dans l'historique
      const rectifHistory = new HistoriqueCaisseGenerale({
        type: diff > 0 ? "ENTREE" : "SORTIE",
        categorie: "DEPOTS",
        montant: Math.abs(diff),
        soldeApresOperation: caisse.soldeActuel,
        description: `Rectification versement #${id.slice(-4)} (Ancien: ${oldVersement.amount}, Nouveau: ${valNewAmount})`,
        effectuePar: req.user?._id,
      });
      await rectifHistory.save({ session });
    }

    oldVersement.amount = valNewAmount;
    oldVersement.paymentMethod = paymentMethod || oldVersement.paymentMethod;
    oldVersement.note = note || oldVersement.note;
    oldVersement.date = date || oldVersement.date;
    await oldVersement.save({ session });

    await session.commitTransaction();
    return responseHandler.ok(res, oldVersement, "Versement mis à jour");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 3. SUPPRIMER UN VERSEMENT (ANNULATION)
 */
export const deleteVersement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const versement = await OwnerPayment.findById(id).session(session);
    if (!versement) throw new Error("Versement introuvable");

    // 1. Restituer le montant au point de vente
    await Sale.findByIdAndUpdate(
      versement.salePoint,
      { $inc: { solde: versement.amount } },
      { session },
    );

    // 2. Retirer de la caisse générale
    const caisse = await CaisseGenerale.findOneAndUpdate(
      {},
      {
        $inc: {
          soldeActuel: -versement.amount,
          totalEntrees: -versement.amount,
        },
      },
      { session, new: true },
    );

    // 3. Historique d'annulation
    await new HistoriqueCaisseGenerale({
      type: "SORTIE",
      categorie: "RETRAIT",
      montant: versement.amount,
      soldeApresOperation: caisse.soldeActuel,
      description: `ANNULATION Versement #${id.slice(-4)} - Montant restitué à la boutique`,
      effectuePar: req.user?._id,
    }).save({ session });

    await OwnerPayment.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    return responseHandler.ok(res, null, "Versement annulé et fonds restitués");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 500);
  } finally {
    session.endSession();
  }
};

/**
 * 4. GET ALL & GET ONE
 */
export const getAllVersements = async (req, res) => {
  try {
    const data = await OwnerPayment.find()
      .populate("salePoint", "name location")
      .populate("receivedBy", "name")
      .sort({ date: -1 });
    return responseHandler.ok(res, data);
  } catch (error) {
    return responseHandler.error(res, error.message);
  }
};

export const getVersementById = async (req, res) => {
  try {
    const data = await OwnerPayment.findById(req.params.id)
      .populate("salePoint", "name")
      .populate("receivedBy", "name");
    if (!data) return responseHandler.notFound(res, "Versement introuvable");
    return responseHandler.ok(res, data);
  } catch (error) {
    return responseHandler.error(res, error.message);
  }
};
