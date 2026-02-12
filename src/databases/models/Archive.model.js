import { Schema, model } from "mongoose";

const ArchiveSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["folder", "file"], required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Archive", default: null },
    // Champs spécifiques aux fichiers (null si type "folder")
    extension: { type: String },
    size: { type: Number },
    url: { type: String },
    mimetype: { type: String },
  },
  { timestamps: true },
);

export const Archive = model("Archive", ArchiveSchema);
