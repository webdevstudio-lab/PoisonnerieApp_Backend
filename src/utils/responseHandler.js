const responseHandler = {
  // Succès standard (200 OK)
  success: (res, data, message = "Opération réussie", statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },

  // Alias 'ok' pour la cohérence avec tes contrôleurs
  ok: (res, data, message = "Opération réussie") => {
    return responseHandler.success(res, data, message, 200);
  },

  // Création réussie (201 Created)
  created: (res, data, message = "Ressource créée avec succès") => {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  },

  // Erreur générique avec support MongoDB
  error: (
    res,
    message = "Erreur serveur",
    statusCode = 500,
    errorDetails = null,
  ) => {
    let finalStatus = statusCode;
    let finalMessage = message;

    // Gestion automatique des erreurs MongoDB (doublons code 11000)
    if (errorDetails?.code === 11000) {
      finalStatus = 409;
      finalMessage = "Cette ressource existe déjà (Doublon détecté).";
    }

    // Gestion des ID mal formés
    if (errorDetails?.name === "CastError") {
      finalStatus = 400;
      finalMessage = "Format de l'identifiant (ID) invalide.";
    }

    return res.status(finalStatus).json({
      success: false,
      message: finalMessage,
      errors: errorDetails?.message || errorDetails || null,
    });
  },

  // Mauvaise requête (ex: solde insuffisant, stock épuisé)
  badRequest: (res, message = "Requête invalide") => {
    return res.status(400).json({
      success: false,
      message,
    });
  },

  // Ressource non trouvée (404)
  notFound: (res, resource = "Ressource") => {
    return res.status(404).json({
      success: false,
      message: `${resource} introuvable`,
    });
  },

  // Non autorisé (Token manquant ou invalide)
  unauthorized: (res, message = "Accès non autorisé") => {
    return res.status(401).json({
      success: false,
      message,
    });
  },
};

export default responseHandler;
