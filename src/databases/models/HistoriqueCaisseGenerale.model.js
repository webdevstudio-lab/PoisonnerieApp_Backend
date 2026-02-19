const mongoose = require("mongoose");

const historiqueCaisseGeneraleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ENTREE", "SORTIE"],
      required: true,
    },
    categorie: {
      type: String,
      enum: [
        "VERSEMENT_BOUTIQUE", // Argent reçu d'un point de vente
        "DEPENSE", // Frais fixes, loyers, etc.
        "DEPOTS", // Correction manuelle
        "RETRAIT", // Correction manuelle
      ],
      required: true,
    },
    montant: {
      type: Number,
      required: true,
    },
    soldeApresOperation: {
      type: Number,
      required: true,
    },
    // Référence optionnelle vers la boutique (si c'est un versement)
    boutiqueSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    // Référence optionnelle vers l'achat (si c'est une sortie)
    achatRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
    },
    description: {
      type: String,
      required: true, // Ex: "Versement journalier Boutique Cocody"
    },
    effectuePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateOperation: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const HistoriqueCaisseGenerale = mongoose.model(
  "HistoriqueCaisseGenerale",
  historiqueCaisseGeneraleSchema,
);
