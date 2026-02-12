import mongoose from "mongoose";
const { Schema, model } = mongoose;

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String },
    category: {
      type: String,
      enum: ["grossiste", "revendeur", "autres"],
      required: true,
    },

    balance: { type: Number, default: 0 },
    // Catalogue des produits avec prix d'achat
    productCatalog: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        pricePurchase: {
          type: Number,
          required: true,
          min: 0,
        }, // Prix auquel VOUS achetez chez ce fournisseur
        potentialMargin: {
          type: Number,
        }, // Différence entre votre prix de vente fixe et cet achat
      },
    ],
  },
  { timestamps: true },
);

// Middleware pour calculer la marge potentielle avant sauvegarde
SupplierSchema.pre("save", async function () {
  const Product = mongoose.model("Product");

  for (let item of this.productCatalog) {
    const productInfo = await Product.findById(item.product);

    if (productInfo) {
      // Marge = Prix de vente (dans Product) - Prix d'achat (chez ce Supplier)
      item.potentialMargin = productInfo.sellingPrice - item.pricePurchase;
    }
  }
});

export const Supplier = model("Supplier", SupplierSchema);
