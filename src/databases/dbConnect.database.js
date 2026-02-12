import mongoose from "mongoose";

const dbConnect = async () => {
  const uri = process.env.DATABASE_URI;
  try {
    // Remplace 'poissonnerie_db' par le nom que tu veux donner à ta base

    await mongoose.connect(uri);

    console.log("✅ Connexion à MongoDB réussie !");
  } catch (error) {
    console.error("❌ Erreur de connexion à MongoDB :", error.message);
    // Arrête l'application si la base de données ne répond pas
    process.exit(1);
  }
};

export default dbConnect;
