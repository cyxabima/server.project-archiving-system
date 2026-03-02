import express from "express";
import cors from 'cors'
import cookieParser from 'cookie-parser'

const corsOptions = {
  origin: ['http://localhost:3000', '*'],
  methods: ['Get', 'POST', "PUT", "DELETE", "PATCH"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // for cookies
}
const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

// here i will defined custom error middleware


export default app
