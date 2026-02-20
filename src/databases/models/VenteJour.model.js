import { Schema, model } from "mongoose";

const VenteJourSchema = new Schema(
  {
    salePoint: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    vendeur: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // --- LOGIQUE DE CRÉDIT ---
    isCredit: {
      type: Boolean,
      default: false,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      // Requis seulement si c'est une vente à crédit
      required: function () {
        return this.isCredit === true;
      },
    },
    // ------------------------
    date: {
      type: Date,
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
        unitPrice: { type: Number, required: true },
        subTotal: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    observation: { type: String },
  },
  { timestamps: true },
);

export const VenteJour = model("VenteJour", VenteJourSchema);
