import mongoose from "mongoose";
import { Client, ClientTransaction } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Ajouter un client (avec plafond de crédit)
export const addClient = async (req, res) => {
  try {
    const { name, phone, creditLimit } = req.body;
    const sanitizedName = name.trim();

    const existingClient = await Client.findOne({
      name: { $regex: new RegExp(`^${sanitizedName}$`, "i") },
    });

    if (existingClient) {
      return responseHandler.error(res, "Ce client existe déjà", 400);
    }

    const newClient = new Client({
      name: sanitizedName,
      phone,
      creditLimit: Number(creditLimit) || 0,
      currentDebt: 0,
      isRestricted: false,
    });

    await newClient.save();
    return responseHandler.created(
      res,
      newClient,
      "Client enregistré avec succès",
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

// 2. Récupérer tous les clients (Triés par dette décroissante)
export const getAllClient = async (req, res) => {
  try {
    const clients = await Client.find().sort({ currentDebt: -1, name: 1 });
    return responseHandler.ok(res, clients);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Récupérer un client par ID avec son historique récent
export const getOneClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    if (!client) return responseHandler.notFound(res, "Client introuvable");

    const history = await ClientTransaction.find({ client: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("recordedBy", "name");

    return responseHandler.ok(res, { client, history });
  } catch (error) {
    return responseHandler.error(res, "Erreur serveur", 500, error.message);
  }
};

// 4. Mettre à jour les infos et restrictions
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, creditLimit, isRestricted, restrictionReason } =
      req.body;

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          phone,
          creditLimit: Number(creditLimit),
          isRestricted,
          restrictionReason,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedClient)
      return responseHandler.notFound(res, "Client introuvable");
    return responseHandler.ok(res, updatedClient, "Profil client mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error.message);
  }
};

// 5. ENREGISTRER UN VERSEMENT (Remboursement de dette)
export const recordPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { clientId, amount, description } = req.body;
    const paymentAmount = Number(amount);

    if (paymentAmount <= 0)
      throw new Error("Le montant doit être supérieur à 0");

    // 1. Mettre à jour la dette
    const client = await Client.findByIdAndUpdate(
      clientId,
      { $inc: { currentDebt: -paymentAmount } },
      { session, new: true },
    );

    if (!client) throw new Error("Client introuvable");

    // 2. Créer l'historique de transaction
    const transaction = new ClientTransaction({
      client: clientId,
      type: "REMBOURSEMENT",
      amount: paymentAmount,
      balanceAfter: client.currentDebt,
      description: description || `Versement de ${paymentAmount} FCFA`,
      recordedBy: req.user?._id,
    });

    await transaction.save({ session });
    await session.commitTransaction();

    return responseHandler.ok(res, client, "Versement enregistré avec succès");
  } catch (error) {
    await session.abortTransaction();
    return responseHandler.error(res, error.message, 400);
  } finally {
    session.endSession();
  }
};

// 6. Supprimer un client
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(id);
    if (client && client.currentDebt > 0) {
      return responseHandler.error(
        res,
        "Impossible de supprimer un client ayant une dette active",
        400,
      );
    }

    await Client.findByIdAndDelete(req.params.id);
    return responseHandler.ok(res, null, "Client supprimé");
  } catch (error) {
    return responseHandler.error(res, "Erreur suppression", 500, error.message);
  }
};
