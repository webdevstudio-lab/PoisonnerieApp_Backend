import { CategoryDepense, Depense } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

// Ajouter une catégorie
export const addCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const sanitizedName = name.toUpperCase().trim();

    const existing = await CategoryDepense.findOne({ name: sanitizedName });
    if (existing)
      return responseHandler.error(res, "Cette catégorie existe déjà", 400);

    const newCategory = new CategoryDepense({
      name: sanitizedName,
      description,
      color,
    });
    await newCategory.save();

    return responseHandler.created(res, newCategory, "Catégorie créée");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la création",
      500,
      error.message,
    );
  }
};

// Supprimer UNE SEULE catégorie
export const deleteOneCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Cette ligne provoquait l'erreur 500 car Depense n'était pas importé
    const isUsed = await Depense.findOne({ category: id });

    if (isUsed) {
      // Renvoie une erreur 400 (Client Error) propre
      return responseHandler.error(
        res,
        "Impossible de supprimer : cette catégorie est liée à des dépenses existantes.",
        400,
      );
    }

    const category = await CategoryDepense.findByIdAndDelete(id);

    if (!category) {
      return responseHandler.notFound(res, "Catégorie introuvable");
    }

    return responseHandler.ok(res, null, "Catégorie supprimée avec succès");
  } catch (error) {
    // Si l'import manque, JS jette une ReferenceError ici
    return responseHandler.error(
      res,
      "Erreur lors de la suppression de la catégorie",
      500,
      error.message,
    );
  }
};

// Récupérer toutes les catégories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await CategoryDepense.find().sort({ name: 1 });
    return responseHandler.ok(res, categories);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};
