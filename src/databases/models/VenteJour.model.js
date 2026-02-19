import { Schema, model } from "mongoose";

const VenteJourSchema = new Schema(
  {
    salePoint: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    store: {
      // La boutique (stock secondaire) concernée
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    vendeur: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date, // Changé en Date pour faciliter les requêtes par période
      default: Date.now,
    },
    inventorySold: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        cartonsSold: { type: Number, required: true },
        unitPrice: { type: Number, required: true }, // Prix de vente au moment de la transaction
        subTotal: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true }, // Somme totale des subTotals
    observation: { type: String },
  },
  { timestamps: true },
);

export const VenteJour = model("VenteJour", VenteJourSchema);
