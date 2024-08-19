import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { Request,Response,NextFunction } from 'express';
import { upload } from './middlewares/middleware';
import { FileController } from './controllers/fileController';



const app = express();
const port = 3000;

app.use(cors());

app.post("/validate-file", upload.single("file"), FileController);

app.use((err : Error, req : Request , res : Response, next:NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
});



app.get('/a', (req, res)=>{
  res.send("hi")
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});