import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    usermane: { type: String, required: true, unique: true },
    contact: { type: String, unique: true },
    solde: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ["admin", "gestionnaire_stock", "vendeur"],
      default: "vendeur",
    },
    assignedSalePoint: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    }, // Le point de vente lié au vendeur
  },
  { timestamps: true },
);

export const User = model("User", UserSchema);
