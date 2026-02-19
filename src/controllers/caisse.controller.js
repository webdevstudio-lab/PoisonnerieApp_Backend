import {
  CaisseGenerale,
  HistoriqueCaisseGenerale,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

/**
 * 1. GetCaisse : Afficher le solde et les infos de la caisse
 */
export const GetCaisse = async (req, res) => {
  try {
    let caisse = await CaisseGenerale.findOne();

    // Initialisation si inexistante
    if (!caisse) {
      caisse = await CaisseGenerale.create({
        soldeActuel: 0,
        totalEntrees: 0,
        totalSorties: 0,
      });
    }

    return responseHandler.ok(res, caisse);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la récupération de la caisse",
      500,
      error.message,
    );
  }
};

/**
 * 2. VersementCaisse : Ravitaillement manuel (Dépôts)
 */
export const VersementCaisse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { montant, description } = req.body;
    const userId = req.user?._id; // ID de l'utilisateur connecté

    if (!montant || montant <= 0)
      throw new Error("Le montant du versement doit être supérieur à 0");

    // Récupérer la caisse
    let caisse = await CaisseGenerale.findOne().session(session);
    if (!caisse) throw new Error("Caisse non trouvée");

    // Mise à jour des calculs
    caisse.soldeActuel += Number(montant);
    caisse.totalEntrees += Number(montant);
    caisse.derniereMiseAJour = new Date();
    await caisse.save({ session });

    // Enregistrement dans l'historique
    const historique = new HistoriqueCaisseGenerale({
      type: "ENTREE",
      categorie: "DEPOTS", // Selon ton enum
      montant: Number(montant),
      soldeApresOperation: caisse.soldeActuel,
      description: description || "Ravitaillement manuel de la caisse",
      effectuePar: userId,
    });
    await historique.save({ session });

    await session.commitTransaction();
    return responseHandler.ok(
      res,
      { caisse, historique },
      "Caisse ravitaillée avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(
      res,
      "Erreur lors du versement",
      500,
      error.message,
    );
  } finally {
    session.endSession();
  }
};

/**
 * 3. RetraitCaisse : Retirer de l'argent de la caisse
 */
export const RetraitCaisse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { montant, description } = req.body;
    const userId = req.user?._id;

    if (!montant || montant <= 0)
      throw new Error("Le montant du retrait doit être supérieur à 0");

    // Récupérer la caisse
    let caisse = await CaisseGenerale.findOne().session(session);
    if (!caisse) throw new Error("Caisse non trouvée");

    // Vérification du solde disponible
    if (caisse.soldeActuel < montant) {
      throw new Error(
        `Solde insuffisant. Disponible : ${caisse.soldeActuel} FCFA`,
      );
    }

    // Mise à jour des calculs
    caisse.soldeActuel -= Number(montant);
    caisse.totalSorties += Number(montant);
    caisse.derniereMiseAJour = new Date();
    await caisse.save({ session });

    // Enregistrement dans l'historique
    const historique = new HistoriqueCaisseGenerale({
      type: "SORTIE",
      categorie: "RETRAIT", // Selon ton enum
      montant: Number(montant),
      soldeApresOperation: caisse.soldeActuel,
      description: description || "Retrait manuel de la caisse",
      effectuePar: userId,
    });
    await historique.save({ session });

    await session.commitTransaction();
    return responseHandler.ok(
      res,
      { caisse, historique },
      "Retrait effectué avec succès",
    );
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(
      res,
      "Erreur lors du retrait",
      500,
      error.message,
    );
  } finally {
    session.endSession();
  }
};

/**
 * 4. GetAllHistorique : Récupérer tous les mouvements de la caisse
 * Supporte la pagination et les filtres par type/catégorie
 */
export const GetAllHistorique = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, categorie } = req.query;

    // Construction du filtre de recherche
    const filter = {};
    if (type) filter.type = type; // "ENTREE" ou "SORTIE"
    if (categorie) filter.categorie = categorie; // "VERSEMENT_BOUTIQUE", "DEPENSE", etc.

    // Calcul pour la pagination
    const skip = (Number(page) - 1) * Number(limit);

    const [historique, total] = await Promise.all([
      HistoriqueCaisseGenerale.find(filter)
        .populate("effectuePar", "name email") // Pour savoir qui a fait l'action
        .populate("boutiqueSource", "name") // Si c'est un versement boutique
        .populate({
          path: "achatRef",
          select: "description totalAmount",
          populate: { path: "supplier", select: "name" }, // Détail du fournisseur si achat
        })
        .sort({ createdAt: -1 }) // Le plus récent en premier
        .skip(skip)
        .limit(Number(limit)),

      HistoriqueCaisseGenerale.countDocuments(filter),
    ]);

    const pagination = {
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      itemsPerPage: Number(limit),
    };

    return responseHandler.ok(
      res,
      { historique, pagination },
      "Historique récupéré avec succès",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la récupération de l'historique",
      500,
      error.message,
    );
  }
};
