import mongoose from "mongoose";
const { Schema, model } = mongoose;

const StockHistorySchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Le dépôt qui donne ou qui subit l'action
    fromStore: {
      type: Schema.Types.ObjectId,
      ref: "Store",
    },
    // Le dépôt qui reçoit (utile pour les transferts/retours)
    toStore: {
      type: Schema.Types.ObjectId,
      ref: "Store",
    },
    quantity: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["transfert", "retour", "perte", "ajustement", "achat", "vente"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const StockHistory = model("StockHistory", StockHistorySchema);
