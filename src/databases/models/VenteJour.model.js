import { Schema, model } from "mongoose";

const VenteJourSchema = new Schema(
  {
    salePoint: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    vendeur: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      default: () => new Date().toLocaleDateString("fr-FR"),
    },
    // Le tableau des produits vendus durant la journée
    inventorySold: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: String,
        // Vente en cartons entiers
        cartonsSold: { type: Number, default: 0 },
        priceCartons: { type: Number, default: 0 },
        // Vente au détail (kilogrammes)
        kgSold: { type: Number, default: 0 },
        priceKg: { type: Number, default: 0 },
        // Total pour ce produit précis (facultatif car calculable)
        subTotal: { type: Number, default: 0 },
      },
    ],
    totalDayCash: { type: Number, required: true }, // Argent total encaissé
    totalDayCredit: { type: Number, default: 0 }, // Montant total des dettes clients du jour
    observation: { type: String }, // Pour signaler des pertes ou soucis
  },
  { timestamps: true },
);

export const VenteJour = model("VenteJour", VenteJourSchema);
