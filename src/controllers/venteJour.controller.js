import { VenteJour, Sale } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

export const addVenteJour = async (req, res) => {
  try {
    const { salePoint, vendeur, inventorySold, totalDayCash, totalDayCredit } =
      req.body;

    // 1. Vérifier si le point de vente existe
    const pointDeVente = await Sale.findById(salePoint);
    if (!pointDeVente) {
      return responseHandler.notFound(res, "Point de vente introuvable");
    }

    // 2. Créer l'enregistrement de la vente
    const nouvelleVente = new VenteJour({
      salePoint,
      vendeur,
      inventorySold,
      totalDayCash,
      totalDayCredit,
    });

    // 3. Mise à jour dynamique du stock pour chaque produit envoyé
    for (const item of inventorySold) {
      const stockIndex = pointDeVente.displayStock.findIndex(
        (s) => s.product.toString() === item.product.toString(),
      );

      if (stockIndex !== -1) {
        // Soustraction des cartons et des kilogrammes
        pointDeVente.displayStock[stockIndex].cartons -= item.cartonsSold || 0;
        pointDeVente.displayStock[stockIndex].kilograms -= item.kgSold || 0;
      } else {
        // Note: Si le produit n'est pas en stock, on pourrait renvoyer une erreur
        // ou simplement ignorer, ici on continue pour ne pas bloquer la saisie.
        console.warn(
          `Produit ${item.productName} non trouvé dans le stock du point de vente.`,
        );
      }
    }

    // 4. Mise à jour de la dette du point de vente envers l'admin
    // Chaque cash encaissé réduit ce que le point de vente "doit" en stock à l'admin
    pointDeVente.dette -= totalDayCash || 0;

    // 5. Sauvegarde en base de données
    await pointDeVente.save();
    await nouvelleVente.save();

    return responseHandler.created(
      res,
      nouvelleVente,
      "Bilan de vente enregistré et stock mis à jour",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de l'enregistrement du bilan",
      500,
      error.message,
    );
  }
};

// Récupérer l'historique des bilans pour un point de vente
export const getHistoryByPoint = async (req, res) => {
  try {
    const history = await VenteJour.find({ salePoint: req.params.pointId })
      .populate("vendeur", "name")
      .sort({ createdAt: -1 });

    return responseHandler.ok(res, history);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// --- METTRE À JOUR UN BILAN (avec réajustement de stock) ---
export const updateVenteDuJour = async (req, res) => {
  try {
    const { id } = req.params;
    const { inventorySold, totalDayCash, totalDayCredit } = req.body;

    const oldVente = await VenteJour.findById(id);
    if (!oldVente) return responseHandler.notFound(res, "Bilan introuvable");

    const pointDeVente = await Sale.findById(oldVente.salePoint);

    // 1. Annuler l'impact de l'ancienne vente sur le stock et la dette
    for (const oldItem of oldVente.inventorySold) {
      const stockItem = pointDeVente.displayStock.find(
        (s) => s.product.toString() === oldItem.product.toString(),
      );
      if (stockItem) {
        stockItem.cartons += oldItem.cartonsSold;
        stockItem.kilograms += oldItem.kgSold;
      }
    }
    pointDeVente.dette += oldVente.totalDayCash; // On rend l'argent à la dette avant de soustraire le nouveau

    // 2. Appliquer les nouvelles valeurs (Nouvelle soustraction)
    for (const newItem of inventorySold) {
      const stockItem = pointDeVente.displayStock.find(
        (s) => s.product.toString() === newItem.product.toString(),
      );
      if (stockItem) {
        stockItem.cartons -= newItem.cartonsSold;
        stockItem.kilograms -= newItem.kgSold;
      }
    }
    pointDeVente.dette -= totalDayCash;

    // 3. Sauvegarder les changements
    const updatedVente = await VenteJour.findByIdAndUpdate(
      id,
      { inventorySold, totalDayCash, totalDayCredit },
      { new: true },
    );
    await pointDeVente.save();

    return responseHandler.ok(res, updatedVente, "Bilan et stocks mis à jour");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la mise à jour",
      500,
      error.message,
    );
  }
};

// --- SUPPRIMER UN BILAN SPÉCIFIQUE ---
export const deleteVenteDuJour = async (req, res) => {
  try {
    const vente = await VenteJour.findById(req.params.id);
    if (!vente) return responseHandler.notFound(res, "Bilan introuvable");

    // Optionnel : Restaurer le stock avant suppression
    const pointDeVente = await Sale.findById(vente.salePoint);
    if (pointDeVente) {
      for (const item of vente.inventorySold) {
        const stockItem = pointDeVente.displayStock.find(
          (s) => s.product.toString() === item.product.toString(),
        );
        if (stockItem) {
          stockItem.cartons += item.cartonsSold;
          stockItem.kilograms += item.kgSold;
        }
      }
      pointDeVente.dette += vente.totalDayCash;
      await pointDeVente.save();
    }

    await VenteJour.findByIdAndDelete(req.params.id);
    return responseHandler.ok(res, null, "Bilan supprimé et stock restauré");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de suppression",
      500,
      error.message,
    );
  }
};

// --- SUPPRIMER TOUS LES BILANS (Nettoyage de base de données) ---
export const deleteAllVenteDuJour = async (req, res) => {
  try {
    await VenteJour.deleteMany({});
    return responseHandler.ok(res, null, "Tous les bilans ont été supprimés");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors du nettoyage",
      500,
      error.message,
    );
  }
};
