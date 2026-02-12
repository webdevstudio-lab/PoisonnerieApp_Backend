import { Client } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Ajouter un client
export const addClient = async (req, res) => {
  try {
    const { name, phone, totalCredit } = req.body;

    // On transforme le nom en minuscule pour la cohérence des recherches
    const sanitizedName = name.toLowerCase().trim();

    // Vérification si le client existe déjà par son nom (optionnel, selon ton besoin)
    const existingClient = await Client.findOne({ name: sanitizedName });
    if (existingClient) {
      return responseHandler.error(res, "Ce client existe déjà", 400);
    }

    const newClient = new Client({
      name: sanitizedName,
      phone,
      totalCredit: totalCredit || 0,
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
      "Erreur lors de l'ajout du client",
      500,
      error.message,
    );
  }
};

// 2. Récupérer tous les clients (Triés par nom)
export const getAllClient = async (req, res) => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    return responseHandler.ok(res, clients);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération des clients",
      500,
      error.message,
    );
  }
};

// 3. Récupérer un client par son ID
export const getOneClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return responseHandler.notFound(res, "Client introuvable");

    return responseHandler.ok(res, client);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 4. Mettre à jour les infos d'un client
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, totalCredit } = req.body;

    const updatedData = {
      phone,
      totalCredit,
    };

    if (name) updatedData.name = name.toLowerCase().trim();

    const client = await Client.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });

    if (!client) return responseHandler.notFound(res, "Client introuvable");

    return responseHandler.ok(res, client, "Infos client mises à jour");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de mise à jour",
      500,
      error.message,
    );
  }
};

// 5. Supprimer un client
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return responseHandler.notFound(res, "Client introuvable");

    return responseHandler.ok(
      res,
      null,
      "Client supprimé de la base de données",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de suppression",
      500,
      error.message,
    );
  }
};
