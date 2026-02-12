import { Schema, model } from "mongoose";

const SaleSchema = new Schema(
  {
    name: { type: String, required: true },
    location: { type: String },
    // Uniquement le stock "ouvert" pour la vente au détail/client
    displayStock: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        cartons: { type: Number, default: 0, min: 0 }, // Cartons entiers dans le frigo
        kilograms: { type: Number, default: 0, min: 0 }, // Détail (ex: 5.5 kg restants)
      },
    ],
    solde: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Sale = model("Sale", SaleSchema);
