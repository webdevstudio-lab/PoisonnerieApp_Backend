// utils/cookies.js
export const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

// On utilise une fonction pour générer des options fraîches à chaque fois
export const getAccessTokenOptions = () => ({
  ...COOKIE_DEFAULTS,
  // maxAge est plus simple : il définit la durée en millisecondes à partir de "maintenant"
  maxAge: 24 * 60 * 60 * 1000,
});

export const setAuthCookies = (res, accessToken) => {
  // On appelle la fonction pour obtenir une date d'expiration toute neuve
  res.cookie(
    "_appPoissonnerie_Access_Token",
    accessToken,
    getAccessTokenOptions(),
  );
};

export const clearAuthAccessCookie = (res) => {
  // Pour clearCookie, on a juste besoin des mêmes options de base (path, domain, etc.)
  return res.clearCookie("_appPoissonnerie_Access_Token", COOKIE_DEFAULTS);
};

export const clearAllCookies = (res) => {
  return res.clearCookie("_appPoissonnerie_Access_Token", COOKIE_DEFAULTS);
};
