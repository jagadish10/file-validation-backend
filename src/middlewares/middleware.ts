import multer,{FileFilterCallback} from "multer";
import path from "path";
import { Request } from "express";

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req : Request , file : Express.Multer.File, cb:FileFilterCallback) => {
      const allowedExtensions = [".pdf", ".docx"];
      const allowedMIMETypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
  
      const extname = allowedExtensions.includes(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedMIMETypes.includes(file.mimetype);
  
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        return cb(new Error("Only .pdf and .docx files are allowed"));
      }
    },
  });