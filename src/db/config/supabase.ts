import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// CRITICAL: Use the SERVICE_ROLE key for your backend, not the anon key!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// Export the initialized client
export const supabase = createClient(supabaseUrl, supabaseKey);
