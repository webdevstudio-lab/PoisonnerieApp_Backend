import app from "./src/app.js";
import dbConnect from "./src/databases/dbconnect.database.js";
import dotenv from "dotenv";

// 1. Charger les variables d'environnement
dotenv.config();

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || "localhost";

// 2. Lancer la connexion DB puis le serveur
dbConnect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Connexion au serveur réussie !`);
      console.log(
        `🚀 API active sur : http://${HOST}:${PORT} en mode ${process.env.NODE_ENV}`,
      );
    });
  })
  .catch((err) => {
    console.error("❌ Impossible de démarrer le serveur (Erreur DB) :");
    console.error(err.message);
    process.exit(1);
  });
