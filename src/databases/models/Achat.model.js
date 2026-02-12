import mongoose from "mongoose";
const { Schema, model } = mongoose;

const PurchaseSchema = new Schema(
  {
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    destinedStore: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    depenseId: {
      type: Schema.Types.ObjectId,
      ref: "Depense",
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPurchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        productName: {
          type: String,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: "Non spécifié",
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

/**
 * MIDDLEWARE : Validation, Calcul Total et Mise à jour du prix de référence Produit
 */
PurchaseSchema.pre("validate", async function () {
  try {
    const Product = mongoose.model("Product");
    const Store = mongoose.model("Store");

    // 1. Vérification du store
    const targetStore = await Store.findById(this.destinedStore);
    if (!targetStore || targetStore.type !== "principal") {
      throw new Error(
        "L'achat ne peut être effectué que vers un stock de type 'principal'.",
      );
    }

    let calculatedTotal = 0;

    // 2. Traitement des items
    await Promise.all(
      this.items.map(async (item) => {
        const productDoc = await Product.findById(item.product);
        if (!productDoc) {
          throw new Error(`Produit avec l'ID ${item.product} introuvable.`);
        }

        // A. Injection automatique du nom
        item.productName = productDoc.name;

        // B. Cumul pour le total de la facture
        calculatedTotal += item.quantity * item.unitPurchasePrice;

        // C. MISE À JOUR DU PRIX DE RÉFÉRENCE SUR LE PRODUIT
        // Cela permet au Header du stock de calculer la valeur d'achat actuelle
        productDoc.purchasePrice = item.unitPurchasePrice;
        await productDoc.save();
      }),
    );

    // 3. Mise à jour du total de l'achat
    this.totalAmount = calculatedTotal;
  } catch (error) {
    throw error;
  }
});

export const Purchase = model("Purchase", PurchaseSchema);
