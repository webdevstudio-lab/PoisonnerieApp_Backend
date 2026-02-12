import jwt from "jsonwebtoken";
import { User } from "../databases/index.database.js";
import responseHandler from "../utils/responseHandler.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?._appPoissonnerie_Access_Token;

    if (!token) {
      // ✅ Renvoi immédiat pour libérer Node.js
      return responseHandler.unauthorized(res, "Session absente.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // On ajoute un timeout à la requête MongoDB pour éviter qu'elle ne reste "pendue"
    const currentUser = await User.findById(decoded.Id)
      .select("-password")
      .lean()
      .maxTimeMS(2000);

    if (!currentUser) {
      return responseHandler.unauthorized(res, "Utilisateur introuvable.");
    }

    req.user = currentUser;
    req.userId = currentUser._id;
    next();
  } catch (error) {
    // ✅ NETTOYAGE CRITIQUE : On force le navigateur à oublier le token fautif
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };
    res.clearCookie("_appPoissonnerie_Access_Token", options);

    // ✅ On répond tout de suite pour éviter le Timeout côté client
    return responseHandler.unauthorized(res, "Session expirée.");
  }
};
