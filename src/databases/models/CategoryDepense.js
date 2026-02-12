import { Schema, model } from "mongoose";

const CategoryDepenseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: { type: String },
    color: { type: String, default: "#0AC4E0" }, // Pour personnaliser l'affichage
  },
  { timestamps: true },
);

export const CategoryDepense = model("CategoryDepense", CategoryDepenseSchema);
