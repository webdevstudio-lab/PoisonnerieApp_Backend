import { Depense } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

// 1. Enregistrer une nouvelle dépense
export const addDepense = async (req, res) => {
  try {
    const { label, amount, category, date, note } = req.body;
    const userId = req.user._id;

    if (!userId) {
      return responseHandler.error(res, "Utilisateur non identifié", 401);
    }

    const newDepense = new Depense({
      label: label.trim(),
      amount: Number(amount),
      category,
      date: date || Date.now(),
      user: userId,
      note,
    });

    await newDepense.save();

    const populatedDepense = await Depense.findById(newDepense._id).populate(
      "category",
      "name color",
    );

    return responseHandler.created(
      res,
      populatedDepense,
      "Dépense enregistrée avec succès",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de l'enregistrement",
      500,
      error.message,
    );
  }
};

// 2. Récupérer les dépenses (TRIÉES PAR DATE CROISSANTE)
export const getMyDepenses = async (req, res) => {
  try {
    const userId = req.user._id;
    const { filter, date } = req.query;

    const baseDate = date ? new Date(date) : new Date();
    let startDate = new Date(baseDate);
    let endDate = new Date(baseDate);

    if (filter === "Jour") {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (filter === "Semaine") {
      // Calcul du lundi de la semaine de baseDate
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(new Date(baseDate).setDate(diff));
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (filter === "Mois") {
      // Début et fin du mois de baseDate
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (filter === "Année") {
      // Toute l'année de baseDate
      startDate = new Date(baseDate.getFullYear(), 0, 1);
      endDate = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const query = {
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    };

    const depenses = await Depense.find(query)
      .populate("category", "name color")
      .sort({ date: 1 });

    return responseHandler.ok(res, depenses);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Mettre à jour une dépense
export const updateDepense = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const depense = await Depense.findOneAndUpdate(
      { _id: id, user: userId },
      req.body,
      { new: true, runValidators: true },
    ).populate("category", "name color");

    if (!depense) {
      return responseHandler.notFound(
        res,
        "Dépense introuvable ou accès refusé",
      );
    }

    return responseHandler.ok(res, depense, "Dépense mise à jour");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de mise à jour",
      500,
      error.message,
    );
  }
};

// 4. Supprimer une dépense
export const deleteDepense = async (req, res) => {
  try {
    const userId = req.user._id;
    const depense = await Depense.findOneAndDelete({
      _id: req.params.id,
      user: userId,
    });

    if (!depense) {
      return responseHandler.notFound(
        res,
        "Dépense introuvable ou accès refusé",
      );
    }

    return responseHandler.ok(res, null, "Dépense supprimée");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de suppression",
      500,
      error.message,
    );
  }
};

// 5. Stats
export const getDepensesStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await Depense.aggregate([
      { $match: { user: userId } },
      {
        $facet: {
          aujourdhui: [
            { $match: { date: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          ceMois: [
            { $match: { date: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          parCategorie: [
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            {
              $lookup: {
                from: "categorydepenses",
                localField: "_id",
                foreignField: "_id",
                as: "catInfo",
              },
            },
            { $unwind: "$catInfo" },
            {
              $project: {
                name: "$catInfo.name",
                total: 1,
                color: "$catInfo.color",
              },
            },
          ],
        },
      },
    ]);

    const result = {
      daily: stats[0].aujourdhui[0]?.total || 0,
      monthly: stats[0].ceMois[0]?.total || 0,
      categories: stats[0].parCategorie || [],
    };

    return responseHandler.ok(res, result);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur calcul bilan",
      500,
      error.message,
    );
  }
};
