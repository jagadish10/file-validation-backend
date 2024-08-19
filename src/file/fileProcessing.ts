import officeParser from "officeparser";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import xml2js from "xml2js"
import { analyzeImageContrast } from "./imageProcessing";

export async function processFile(file : Express.Multer.File) {
    try {
      const result = await officeParser.parseOfficeAsync(file.buffer);
      if (!result || result.length === 0) {
        return { corrupted: true, message: "Empty File", images: [] };
      }
      
      const imagesWithMissingAlt = [];
      const imagesWithBadContrast = [];
  
      if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const zip = new PizZip(file.buffer);
        const doc = new Docxtemplater(zip);
        const docXML = doc.getZip().file('word/document.xml')?.asText();

        if (!docXML) {
            return { corrupted: true, message: "Invalid Document Structure", images: [] };
        }

  
        const imgRegex = /<wp:docPr\b(?![^>]*\bdescr\s*=").*?>/g;
        let match;
        while ((match = imgRegex.exec(docXML)) !== null) {
          const descr = match[1];
          if (!descr) {
            imagesWithMissingAlt.push({
              imageTag: match[0],
            });
          }
        }
  
        const parser = new xml2js.Parser();
        const rels = doc.getZip().file('word/_rels/document.xml.rels')?.asText();

        if (!rels) {
            return { corrupted: true, message: "Invalid Document Relationships", images: [] };
        }

        const parsedRels = await parser.parseStringPromise(rels);
  
        const imageFiles = [];
  
        for (const rel of parsedRels.Relationships.Relationship) {
          if (rel.$.Type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image') {
            const imagePath = rel.$.Target;                                    
            const imageFile = zip.file(`word/${imagePath}`);
            if (imageFile) {
              imageFiles.push({ path: imagePath, buffer: imageFile.asNodeBuffer() });
            }
          }
        }
  
        for (const image of imageFiles) {
          const contrastResult = await analyzeImageContrast(image.buffer);
          if (!contrastResult.isGoodContrast) {
            imagesWithBadContrast.push({
              imagePath: image.path,
              contrastRatio: contrastResult.contrastRatio,
            });
          }
        }
      }
  
      if (imagesWithMissingAlt.length > 0 || imagesWithBadContrast.length > 0) {

        if(imagesWithMissingAlt.length > 0)
        {
          return {
            corrupted: true, 
            message: "File contains images which do not contain alternate Text", 
            imagesMissingAlternateText: imagesWithMissingAlt,
            badContrastImages: imagesWithBadContrast
          }
        }
        else if(imagesWithBadContrast.length > 0)
        { 
          return {
            corrupted: true, 
            message: "File Contains images with bad constrast", 
            imagesMissingAlternateText: imagesWithMissingAlt,
            badContrastImages: imagesWithBadContrast
          }
        }
        else{
          return {
            corrupted: true,
            message: "File contains images which do not contain alternate Text and images with bad constrast",
            imagesMissingAlternateText: imagesWithMissingAlt,
            badContrastImages: imagesWithBadContrast
          }
        }
        }
        else {
          return { corrupted: false, imagesMissingAlternateText: imagesWithMissingAlt, badContrastImages: imagesWithBadContrast };
        }
      }catch (error) {
      return { corrupted: true, message: "File is corrupted", images: [] };
    }
  }

  