import { Schema, model } from "mongoose";

const DepenseSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Liaison avec la catégorie
    category: {
      type: Schema.Types.ObjectId,
      ref: "CategoryDepense",
      required: true,
    },
    // Liaison avec l'utilisateur qui a effectué la dépense
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assure-toi que ton modèle User s'appelle bien "User"
      required: true,
    },
    note: { type: String }, // Pour des détails supplémentaires
  },
  { timestamps: true },
);

export const Depense = model("Depense", DepenseSchema);
