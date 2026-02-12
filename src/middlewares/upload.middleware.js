import multer from "multer";
import path from "path";
import fs from "fs";

// 1. Définition du stockage (Où et comment enregistrer les fichiers)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/archives/";
    // Création automatique du dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Génère un nom unique : timestamp-nom-original.ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// 2. Filtre de sécurité pour les types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
    "application/vnd.ms-excel", // xls
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Format non supporté. Seuls les images, PDF, TXT et Excel sont acceptés.",
      ),
      false,
    );
  }
};

// 3. Initialisation de Multer avec les limites
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Limite stricte de 2MB
  fileFilter: fileFilter,
});

// 4. Export par défaut pour Bun
export default upload;
