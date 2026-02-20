import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const supabaseUrl =
  Deno.env.get("PROJECT_URL") ??
  Deno.env.get("SUPABASE_URL");
const supabaseServiceKey =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing PROJECT_URL/SERVICE_ROLE_KEY (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
