import { Router } from "express";
import {
  addClient,
  getAllClient,
  getOneClient,
  updateClient,
  deleteClient,
  recordPayment, // Nouvelle fonction ajoutée au contrôleur
} from "../controllers/client.controller.js";

const clientRouter = Router();

// --- ROUTES DE GESTION DES PROFILS ---

// Ajouter un nouveau client
clientRouter.post("/", addClient);

// Récupérer la liste de tous les clients
clientRouter.get("/", getAllClient);

// Récupérer un client spécifique (Détails + Historique des transactions)
clientRouter.get("/:id", getOneClient);

// Mettre à jour les infos, plafonds de crédit ou restreindre un client
clientRouter.patch("/:id", updateClient);

// Supprimer un client (uniquement si dette = 0)
clientRouter.delete("/:id", deleteClient);

// --- ROUTES DE GESTION FINANCIÈRE ---

/**
 * Enregistrer un versement (Remboursement de dette)
 * POST /api/clients/payment
 * Body: { clientId, amount, description }
 */
clientRouter.post("/payment", recordPayment);

export default clientRouter;
