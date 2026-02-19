import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    // Plafond maximum autorisé pour ce client
    creditLimit: { type: Number, default: 0 },
    // Dette actuelle (somme des achats à crédit - remboursements)
    currentDebt: { type: Number, default: 0 },
    // Si true, le client ne peut plus prendre à crédit peu importe son solde
    isRestricted: { type: Boolean, default: false },
    // Pour bloquer le client avec un message spécifique
    restrictionReason: { type: String },
  },
  { timestamps: true },
);

// Virtual pour vérifier si le client a dépassé son plafond
ClientSchema.virtual("isOverLimit").get(function () {
  return this.currentDebt > this.creditLimit;
});

export const Client = model("Client", ClientSchema);
