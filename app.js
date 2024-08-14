const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const officeParser = require("officeparser");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const sharp = require('sharp');
const xml2js = require('xml2js');

const app = express();
const port = 3000;

app.use(cors());


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
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

async function processFile(file) {
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
      const docXML = doc.getZip().file('word/document.xml').asText();

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
      const rels = doc.getZip().file('word/_rels/document.xml.rels').asText();
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
      console.log({ 
        corrupted: true, 
        message: "Invalid File", 
        images: imagesWithMissingAlt,
        badContrastImages: imagesWithBadContrast
      });
      
      return { 
        corrupted: true, 
        message: "Invalid File", 
        images: imagesWithMissingAlt,
        badContrastImages: imagesWithBadContrast
      };
    } else {
      return { corrupted: false, images: imagesWithMissingAlt, badContrastImages: imagesWithBadContrast };
    }
  } catch (error) {
    return { corrupted: true, message: "File is corrupted", images: [] };
  }
}

async function analyzeImageContrast(imageBuffer) {
  const image = sharp(imageBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const pixels = data;

  let minLuminance = Infinity;
  let maxLuminance = -Infinity;

  for (let i = 0; i < pixels.length; i += 3) { // Assuming the image is in RGB format
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luminance < minLuminance) {
          minLuminance = luminance;
      }
      if (luminance > maxLuminance) {
          maxLuminance = luminance;
      }
  }

  const contrastRatio = calculateContrastRatio(maxLuminance, minLuminance);

  return { isGoodContrast: contrastRatio >= 4.5, contrastRatio };
}

function calculateContrastRatio(luminance1, luminance2) {
  const L1 = Math.max(luminance1, luminance2) + 0.05;
  const L2 = Math.min(luminance1, luminance2) + 0.05;
  return L1 / L2;
}

app.post("/validate-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { corrupted, message, images, badContrastImages } = await processFile(req.file);
  if (corrupted) {
    return res.status(200).json({ message, images, badContrastImages });
  }
  res.json({ message: "File is valid", images, badContrastImages });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});