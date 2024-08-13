const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const officeParser = require("officeparser");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const app = express();
const port = 3000;

app.use(cors());

// Configure multer to handle file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
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
    // Check file validity using officeparser
    const result = await officeParser.parseOfficeAsync(file.buffer);

    if (!result || result.length === 0) {
      return { corrupted: true, message: "Empty File", images: [] };
    }

    const imagesWithMissingAlt = [];

    // Initialize PizZip and Docxtemplater for DOCX files
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const zip = new PizZip(file.buffer);
      const doc = new Docxtemplater(zip);

      const docXML = doc.getZip().file('word/document.xml').asText();
      console.log(docXML);
      
      const imgRegex = /<wp:docPr[^>]*descr="([^"]*)"[^>]*>/g;

      let match;
 
      

      while ((match = imgRegex.exec(docXML)) !== null) {
        const descr = match[1];
        
        if (!descr) {
          imagesWithMissingAlt.push({
            imageTag: match[0],
          });
        }
      }
    }

    console.log('imagesWithMissingAlt',imagesWithMissingAlt);
    
    return { corrupted: false, images: imagesWithMissingAlt };
  } catch (error) {
    return { corrupted: true, message: "File is corrupted", images: [] };
  }
}

app.post("/validate-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { corrupted, message, images } = await processFile(req.file);

  if (corrupted) {
    return res.status(400).json({ message });
  }

  res.json({ message: "File is valid", images });
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