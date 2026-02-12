import { StockHistory } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// 1. Récupérer tout l'historique (avec filtres optionnels)
export const getAllStockHistory = async (req, res) => {
  try {
    // On récupère les données et on "remplit" les références
    const history = await StockHistory.find()
      .populate("product", "name category")
      .populate("fromStore", "name type")
      .populate("toStore", "name type")
      .populate("userId", "name role") // Pour savoir qui a fait l'action
      .sort({ date: -1 }); // Le plus récent en premier

    return responseHandler.ok(res, history);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la récupération de l'historique",
      500,
      error.message,
    );
  }
};

// 2. Récupérer un mouvement spécifique par son ID
export const getOneStockHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const movement = await StockHistory.findById(id)
      .populate("product")
      .populate("fromStore")
      .populate("toStore")
      .populate("userId", "name");

    if (!movement) {
      return responseHandler.notFound(res, "Mouvement introuvable");
    }

    return responseHandler.ok(res, movement);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};
