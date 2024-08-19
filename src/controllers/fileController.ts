import { Request,Response,NextFunction} from "express";
import { processFile } from "../file/fileProcessing";

export async function FileController(req : Request,res : Response,next:NextFunction){
    try{
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
          }
        
          const { corrupted, message, imagesMissingAlternateText, badContrastImages } = await processFile(req.file);
          if (corrupted) {
            return res.status(200).json({ message, imagesMissingAlternateText, badContrastImages });
          }
          return res.json({ message: "File is valid", imagesMissingAlternateText, badContrastImages });
    }
    catch(error){
        console.log(error);
        throw new Error();
    }
}