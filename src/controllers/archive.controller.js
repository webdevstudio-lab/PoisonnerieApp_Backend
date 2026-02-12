import { Archive } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import fs from "fs";
import path from "path";

// 1. Créer un dossier
export const createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    const newFolder = new Archive({
      name: name.trim(),
      type: "folder",
      parentId: parentId || null,
    });

    await newFolder.save();
    return responseHandler.created(res, newFolder, "Dossier créé avec succès");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur création dossier",
      500,
      error.message,
    );
  }
};

// 2. Récupérer les archives (par dossier parent)
export const getArchives = async (req, res) => {
  try {
    const { parentId } = req.query;
    const query =
      !parentId || parentId === "null" ? { parentId: null } : { parentId };

    const items = await Archive.find(query).sort({ type: 1, name: 1 });
    return responseHandler.ok(res, items);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération",
      500,
      error.message,
    );
  }
};

// 3. Importer des fichiers
export const uploadFiles = async (req, res) => {
  try {
    const { parentId } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return responseHandler.error(res, "Aucun fichier fourni", 400);
    }

    const savedFiles = [];
    for (const file of files) {
      const newFile = new Archive({
        name: file.originalname,
        type: "file",
        parentId: !parentId || parentId === "null" ? null : parentId,
        extension: path
          .extname(file.originalname)
          .toLowerCase()
          .replace(".", ""),
        size: file.size,
        url: file.path,
        mimetype: file.mimetype,
      });
      await newFile.save();
      savedFiles.push(newFile);
    }

    return responseHandler.created(
      res,
      savedFiles,
      "Fichiers importés avec succès",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de l'import",
      500,
      error.message,
    );
  }
};

// 4. Renommer un élément
export const renameArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    const item = await Archive.findByIdAndUpdate(
      id,
      { name: newName.trim() },
      { new: true },
    );

    if (!item) return responseHandler.notFound(res, "Élément introuvable");
    return responseHandler.ok(res, item, "Élément renommé");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors du renommage",
      500,
      error.message,
    );
  }
};

// 5. Supprimer une archive (Dossier vide uniquement)
export const deleteArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Archive.findById(id);

    if (!item) return responseHandler.notFound(res, "Élément introuvable");

    if (item.type === "folder") {
      const hasChildren = await Archive.findOne({ parentId: item._id });
      if (hasChildren) {
        return responseHandler.error(
          res,
          "Impossible de supprimer : le dossier contient des éléments",
          400,
        );
      }
    } else {
      if (fs.existsSync(item.url)) {
        fs.unlinkSync(item.url);
      }
    }

    await Archive.findByIdAndDelete(id);
    return responseHandler.ok(res, null, "Élément supprimé");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de suppression",
      500,
      error.message,
    );
  }
};

// 6. TELECHARGER UN FICHIER (La fonction manquante qui causait l'erreur)
export const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Archive.findById(id);

    if (!item || item.type === "folder") {
      return responseHandler.notFound(res, "Fichier introuvable");
    }

    // path.resolve transforme le chemin relatif en chemin absolu pour le système
    const filePath = path.resolve(item.url);

    if (!fs.existsSync(filePath)) {
      return responseHandler.error(
        res,
        "Le fichier physique est introuvable sur le serveur",
        404,
      );
    }

    // Force le téléchargement avec le nom d'origine stocké en BDD
    return res.download(filePath, item.name);
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors du téléchargement",
      500,
      error.message,
    );
  }
};
