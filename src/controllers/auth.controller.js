import { User } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import { setAuthCookies, clearAllCookies } from "../utils/cookies.js";

// --- LOGIN ---
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return responseHandler.error(res, "Username et password requis", 400);
    }

    // 1. Recherche de l'utilisateur (on utilise 'usermane' selon ton modèle)
    const user = await User.findOne({
      usermane: username.toLowerCase().trim(),
    });
    if (!user) {
      return responseHandler.error(res, "Identifiants invalides", 401);
    }

    // 2. Vérification du mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return responseHandler.error(res, "Identifiants invalides", 401);
    }

    // 3. Génération des tokens
    // Note: On utilise Id (majuscule) pour correspondre à ta fonction generateAccessToken
    const accessToken = await generateAccessToken(user._id, user.role);

    // 4. Stockage dans les cookies
    setAuthCookies(res, accessToken);

    // 5. Réponse (sans le password)
    const userData = user.toObject();
    delete userData.password;

    return responseHandler.ok(res, { user: userData }, "Connexion réussie");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la connexion",
      500,
      error.message,
    );
  }
};

// --- GET ME ---
export const getMe = async (req, res) => {
  try {
    // req.userId doit être injecté par ton middleware de vérification de token
    const user = await User.findById(req.userId).select("-password").lean();
    if (!user) return responseHandler.notFound(res, "Utilisateur introuvable");

    // Construction de la donnée de réponse (On inclut le solde déjà présent dans le modèle User)
    const userData = {
      ...user,
      solde: user.solde || 0,
    };

    return responseHandler.ok(res, userData, "Profil récupéré");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur de récupération profil",
      500,
      error.message,
    );
  }
};

// --- LOGOUT ---
export const logout = async (req, res) => {
  try {
    clearAllCookies(res);
    return responseHandler.ok(res, null, "Déconnexion réussie");
  } catch (error) {
    return responseHandler.error(
      res,
      "Erreur lors de la déconnexion",
      500,
      error.message,
    );
  }
};
