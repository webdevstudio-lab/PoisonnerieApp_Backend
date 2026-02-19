import { Schema, model } from "mongoose";

const TransferSaleSchema = new Schema(
  {
    salePoint: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    // Référence au mouvement de stock original
    stockMovementId: { type: Schema.Types.ObjectId, ref: "StockHistory" },

    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        quantityCartons: { type: Number, required: true },
        unitPrice: { type: Number, required: true }, // Prix de vente boutique à ce moment
        subTotal: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true }, // Total que la boutique doit pour ce transfert
  },
  { timestamps: true },
);

export const TransferSale = model("TransferSale", TransferSaleSchema);
