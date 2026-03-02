import app from "./app.js";
import 'dotenv/config';

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
  console.log("App Is Listening On PORT", PORT);
})




