import {
  CaisseGenerale,
  Depense,
  Product,
  Sale,
  HistoriqueCaisseGenerale,
  VenteJour,
  Store,
} from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

export const GetDashboardStats = async (req, res) => {
  try {
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    const now = new Date();

    // Dates pour les KPIs (Mois en cours)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Plage de dates pour le graphique (L'année sélectionnée entière)
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
      CaisseGenerale.findOne().select("soldeActuel"),

      Depense.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      VenteJour.aggregate([
        { $match: { date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$totalJournalier" } } },
      ]),

      Store.find()
        .populate("salePoint", "name")
        .populate("items.product", "name lowStockThreshold")
        .lean(),

      HistoriqueCaisseGenerale.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("effectuePar", "name")
        .populate("boutiqueSource", "name"),

      VenteJour.aggregate([
        {
          $match: {
            date: { $gte: startOfSelectedYear, $lte: endOfSelectedYear },
          },
        },
        {
          $group: {
            _id: { month: { $month: "$date" } },
            total: { $sum: "$totalJournalier" },
          },
        },
      ]),

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

    // Formatage du graphique pour les 12 mois de l'année sélectionnée
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
      return {
        name: label,
        ventes:
          evolutionVentes.find((v) => v._id.month === monthNum)?.total || 0,
        depenses:
          evolutionDepenses.find((d) => d._id.month === monthNum)?.total || 0,
      };
    });

    return responseHandler.ok(res, {
      kpis: {
        soldeCaisse: caisse?.soldeActuel || 0,
        ventesMois: ventesMois[0]?.total || 0,
        depensesMois: depensesMois[0]?.total || 0,
        beneficeNet:
          (ventesMois[0]?.total || 0) - (depensesMois[0]?.total || 0),
      },
      alertes: alertesFormatees.slice(0, 5),
      mouvements: derniersMouvements,
      graphique: graphiqueData,
    });
  } catch (error) {
    return responseHandler.error(res, "Erreur Dashboard", 500, error.message);
  }
};
