const mongoose = require("mongoose");

const caisseGeneraleSchema = new mongoose.Schema(
  {
    soldeActuel: {
      type: Number,
      default: 0,
      required: true,
    },
    totalEntrees: {
      type: Number,
      default: 0,
    },
    totalSorties: {
      type: Number,
      default: 0,
    },
    derniereMiseAJour: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const CaisseGenerale = mongoose.model(
  "CaisseGenerale",
  caisseGeneraleSchema,
);
