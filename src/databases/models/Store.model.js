import mongoose from "mongoose";
const { Schema, model } = mongoose;

const StoreSchema = new Schema(
  {
    name: { type: String, required: true },
    salePoint: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantityCartons: { type: Number, default: 0, min: 0 },
      },
    ],
    type: {
      type: String,
      enum: ["principal", "secondaire"],
      default: "principal",
    },
  },
  { timestamps: true },
);

// --- RÈGLE CRITIQUE : Index unique combiné ---
// Empêche d'avoir deux 'principal' ou deux 'secondaire' pour le même salePoint
StoreSchema.index({ salePoint: 1, type: 1 }, { unique: true });

export const Store = model("Store", StoreSchema);
