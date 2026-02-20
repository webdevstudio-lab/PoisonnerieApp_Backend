import {
  CaisseGenerale,
  Depense,
  HistoriqueCaisseGenerale,
  VenteJour,
  Store,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

export const GetDashboardStats = async (req, res) => {
  try {
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    const now = new Date();

    // Dates pour les KPIs (Début du mois en cours)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Plage de dates pour le graphique (Année entière)
    const startOfSelectedYear = new Date(selectedYear, 0, 1);
    const endOfSelectedYear = new Date(selectedYear, 11, 31, 23, 59, 59);

    const [
      caisse,
      depensesMois,
      ventesMois,
      alertesStock,
      derniersMouvements,
      evolutionVentes,
      evolutionDepenses,
    ] = await Promise.all([
      // 1. Solde actuel de la caisse
      CaisseGenerale.findOne().select("soldeActuel"),

      // 2. Total dépenses du mois en cours
      Depense.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // 3. Total ventes du mois en cours
      VenteJour.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }, // Changé totalJournalier -> totalAmount
      ]),

      // 4. Alertes de stock
      Store.find()
        .populate("salePoint", "name")
        .populate("items.product", "name lowStockThreshold")
        .lean(),

      // 5. Historique récent
      HistoriqueCaisseGenerale.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("effectuePar", "name")
        .populate("boutiqueSource", "name"),

      // 6. Évolution des ventes (Annuelle)
      VenteJour.aggregate([
        {
          $match: {
            date: { $gte: startOfSelectedYear, $lte: endOfSelectedYear },
          },
        },
        {
          $group: {
            _id: { month: { $month: "$date" } },
            total: { $sum: "$totalAmount" }, // Changé totalJournalier -> totalAmount
          },
        },
      ]),

      // 7. Évolution des dépenses (Annuelle)
      Depense.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfSelectedYear, $lte: endOfSelectedYear },
          },
        },
        {
          $group: {
            _id: { month: { $month: "$createdAt" } },
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    // Formatage des alertes stock
    const alertesFormatees = [];
    alertesStock.forEach((store) => {
      store.items.forEach((item) => {
        if (
          item.product &&
          item.quantityCartons <= item.product.lowStockThreshold
        ) {
          alertesFormatees.push({
            boutique: store.salePoint?.name || "Inconnue",
            produit: item.product.name,
            quantite: item.quantityCartons,
            seuil: item.product.lowStockThreshold,
          });
        }
      });
    });

    // Formatage du graphique (12 mois)
    const moisLabels = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Août",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];

    const graphiqueData = moisLabels.map((label, index) => {
      const monthNum = index + 1;
      const ventePourMois = evolutionVentes.find(
        (v) => v._id.month === monthNum,
      );
      const depensePourMois = evolutionDepenses.find(
        (d) => d._id.month === monthNum,
      );

      return {
        name: label,
        ventes: ventePourMois ? ventePourMois.total : 0,
        depenses: depensePourMois ? depensePourMois.total : 0,
      };
    });

    // Calcul des montants KPIs
    const totalVentesMois = ventesMois[0]?.total || 0;
    const totalDepensesMois = depensesMois[0]?.total || 0;

    return responseHandler.ok(res, {
      kpis: {
        soldeCaisse: caisse?.soldeActuel || 0,
        ventesMois: totalVentesMois,
        depensesMois: totalDepensesMois,
        beneficeNet: totalVentesMois - totalDepensesMois,
      },
      alertes: alertesFormatees.slice(0, 5),
      mouvements: derniersMouvements,
      graphique: graphiqueData,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return responseHandler.error(res, "Erreur Dashboard", 500, error.message);
  }
};
