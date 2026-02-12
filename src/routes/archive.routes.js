import { Router } from "express";
import {
  createFolder,
  getArchives,
  uploadFiles,
  renameArchive,
  deleteArchive,
} from "../controllers/archive.controller.js";
import upload from "../middlewares/upload.middleware.js"; // Ta config multer
import { downloadFile } from "../controllers/archive.controller.js";

const archiveRouter = Router();

archiveRouter.get("/", getArchives);
archiveRouter.post("/folder", createFolder);
archiveRouter.post("/upload", upload.array("files"), uploadFiles);
archiveRouter.patch("/:id", renameArchive);
archiveRouter.delete("/:id", deleteArchive);
archiveRouter.get("/download/:id", downloadFile);

export default archiveRouter;
