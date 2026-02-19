import { Schema, model } from "mongoose";

const SaleSchema = new Schema(
  {
    name: { type: String, required: true },
    location: { type: String },
    displayStock: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        cartons: { type: Number, default: 0, min: 0 },
        kilograms: { type: Number, default: 0, min: 0 },
      },
    ],
    solde: { type: Number, default: 0 }, // Argent actuellement en caisse boutique

    // NOUVEAU : Ce que la boutique doit au propriétaire (Dette de transfert)
    totalDebtToOwner: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Sale = model("Sale", SaleSchema);
