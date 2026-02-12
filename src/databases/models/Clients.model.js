import { Schema, model } from "mongoose";

const ClientSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    totalCredit: { type: Number, default: 0 },
    // ... reste de ton schéma
  },
  { timestamps: true },
);

// L'erreur vient sûrement d'ici. Assure-toi d'avoir "export const Client"
export const Client = model("Client", ClientSchema);
