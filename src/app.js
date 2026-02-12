import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { xss } from "express-xss-sanitizer";
import { protect } from "./middlewares/protect.middleware.js";

// Importation des routes (à créer au fur et à mesure)
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import suplierRouter from "./routes/suplier.routes.js";
import saleRouter from "./routes/sale.routes.js";
import productRouter from "./routes/product.routes.js";
import venteDuJourRouter from "./routes/venteJour.routes.js";
import storeRouter from "./routes/store.routes.js";
import clientRouter from "./routes/client.routes.js";
import archiveRouter from "./routes/archive.routes.js";
import categoryRouter from "./routes/categoryDepense.routes.js";
import depenseRouter from "./routes/depense.routes.js";
import achatRouter from "./routes/achat.routes.js";
import historyStockRouter from "./routes/stockHistory.routes.js";

const app = express();

// --- Middlewares ---

// Sécurité : CORS (Autorise votre frontend à communiquer avec l'API)
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Sécurité : En-têtes HTTP & Protection XSS
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Nécessaire pour afficher les images d'uploads au frontend
  }),
);
app.use(xss());

// Parsing des données (JSON, Cookies, URL-encoded)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// --- Routes de base ---
app.get("/", (req, res) => {
  res.json({ message: "Bienvenue sur l'API de Gestion Poissonnerie 🐟" });
});

// --- Routes API ---
app.use("/api/auth", authRoutes);
app.use("/api/users", protect, userRoutes);
app.use("/api/suppliers", protect, suplierRouter);
app.use("/api/sales", protect, saleRouter);
app.use("/api/products", protect, productRouter);
app.use("/api/ventes", protect, venteDuJourRouter);
app.use("/api/stores", protect, storeRouter);
app.use("/api/clients", protect, clientRouter);
app.use("/api/archive", protect, archiveRouter);
app.use("/api/categories", protect, categoryRouter);
app.use("/api/depenses", protect, depenseRouter);
app.use("/api/achats", protect, achatRouter);
app.use("/api/stock-history", protect, historyStockRouter);

// Gestion des routes inexistantes (404)
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route non trouvée" });
});

export default app;
