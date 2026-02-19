import { Schema, model } from "mongoose";

const OwnerPaymentSchema = new Schema(
  {
    // Le point de vente qui donne l'argent
    salePoint: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    // Le montant du versement
    amount: {
      type: Number,
      required: true,
      min: [0, "Le montant ne peut pas être négatif"],
    },
    // Lien direct avec l'historique de la caisse générale pour la traçabilité
    caisseHistoryRef: {
      type: Schema.Types.ObjectId,
      ref: "HistoriqueCaisseGenerale",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["Espèces", "Chèque", "Virement", "Mobile Money"],
      default: "Espèces",
    },
    // La personne qui valide la réception à la caisse générale
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["COMPLETE", "ANNULE"],
      default: "COMPLETE",
    },
  },
  { timestamps: true },
);

export const OwnerPayment = model("OwnerPayment", OwnerPaymentSchema);
