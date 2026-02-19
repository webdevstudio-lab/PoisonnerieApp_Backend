import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ClientTransactionSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    type: {
      type: String,
      enum: ["ACHAT_CREDIT", "ACHAT_ESPECES", "REMBOURSEMENT"],
      required: true,
    },
    amount: { type: Number, required: true },
    // Solde du client au moment de la transaction (pour audit)
    balanceAfter: { type: Number, required: true },
    description: { type: String },
    // Référence vers la vente si applicable
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const ClientTransaction = model(
  "ClientTransaction",
  ClientTransactionSchema,
);
