import { User } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import bcrypt from "bcryptjs";

export const addUser = async (req, res) => {
  try {
    let { name, username, contact, role, assignedSalePoint, password } =
      req.body;

    // 1. Transformation en minuscules
    const sanitizedName = name.toLowerCase().trim();
    const sanitizedUsername = username.toLowerCase().trim();

    // 2. Vérification si le username existe déjà
    const userExists = await User.findOne({ usermane: sanitizedUsername }); // Note: 'usermane' selon ton modèle
    if (userExists) {
      return responseHandler.error(
        res,
        "Ce nom d'utilisateur est déjà utilisé",
        400,
      );
    }

    // 3. Vérification si le contact existe déjà
    if (contact) {
      const contactExists = await User.findOne({ contact });
      if (contactExists) {
        return responseHandler.error(
          res,
          "Ce numéro de contact est déjà enregistré",
          400,
        );
      }
    }

    // 4. Hachage du mot de passe (par défaut le username si non fourni)
    const passToHash = password || sanitizedUsername;
    const hashedPassword = await bcrypt.hash(passToHash, 12);

    // 5. Création de l'utilisateur
    const newUser = new User({
      name: sanitizedName,
      usermane: sanitizedUsername, // Attention : ton modèle écrit 'usermane'
      contact,
      role,
      assignedSalePoint,
      password: hashedPassword,
    });

    await newUser.save();

    // On ne renvoie pas le mot de passe dans la réponse
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return responseHandler.created(
      res,
      userResponse,
      "Utilisateur créé avec succès",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la création de l'utilisateur",
      500,
      error,
    );
  }
};

// 1. Mettre à jour les informations (Hors mot de passe)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, usermane, contact, role, assignedSalePoint } = req.body;

    const updatedData = {
      name: name?.toLowerCase().trim(),
      usermane: usermane?.toLowerCase().trim(),
      contact,
      role,
      assignedSalePoint,
    };

    const user = await User.findByIdAndUpdate(id, updatedData, {
      new: true,
    }).select("-password");

    if (!user) return responseHandler.notFound(res, "Utilisateur");

    return responseHandler.ok(res, user, "Utilisateur mis à jour");
  } catch (error) {
    return responseHandler.error(res, "Erreur mise à jour", 500, error);
  }
};

// 2. Récupérer un utilisateur
export const getOneUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("assignedSalePoint");
    if (!user) return responseHandler.notFound(res, "Utilisateur");
    return responseHandler.ok(res, user);
  } catch (error) {
    return responseHandler.error(res, "Erreur récupération", 500, error);
  }
};

// 3. Récupérer tous les utilisateurs
export const getAllUser = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return responseHandler.ok(res, users);
  } catch (error) {
    return responseHandler.error(res, "Erreur liste utilisateurs", 500, error);
  }
};

// 4. Supprimer un utilisateur
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return responseHandler.notFound(res, "Utilisateur");
    return responseHandler.ok(res, null, "Utilisateur supprimé");
  } catch (error) {
    return responseHandler.error(res, "Erreur suppression", 500, error);
  }
};

// 5. Reset Password (par l'Admin)
export const resetPasswordUser = async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash("pass1234", 12);
    const user = await User.findByIdAndUpdate(req.params.id, {
      password: hashedPassword,
    });

    if (!user) return responseHandler.notFound(res, "Utilisateur");
    return responseHandler.ok(
      res,
      null,
      "Mot de passe réinitialisé à 'pass1234'",
    );
  } catch (error) {
    return responseHandler.error(res, "Erreur reset password", 500, error);
  }
};

// 6. Update My Password (par l'utilisateur lui-même)
export const updateMyPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.Id; // Récupéré via ton middleware JWT

    const user = await User.findById(userId);
    if (!user) return responseHandler.notFound(res, "Utilisateur");

    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return responseHandler.error(res, "Ancien mot de passe incorrect", 400);
    }

    // Crypter le nouveau
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return responseHandler.ok(
      res,
      null,
      "Votre mot de passe a été modifié avec succès",
    );
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur modification mot de passe",
      500,
      error,
    );
  }
};
