import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "missing bearer token" });
  }

  const jwt = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json(401, { error: "invalid token" });
  }

  let body: { reward_id?: string; quantity?: number };
  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" });
  }

  const rewardId = body.reward_id ?? null;
  const quantity = body.quantity ?? 1;

  if (!rewardId) {
    return json(400, { error: "reward_id required" });
  }

  const { data, error } = await supabaseAdmin.rpc("redeem_reward", {
    p_reward_id: rewardId,
    p_user_id: userData.user.id,
    p_quantity: quantity,
  });

  if (error) {
    return json(400, { error: error.message });
  }

  const row = Array.isArray(data) ? data[0] : null;
  return json(200, {
    new_balance: row?.new_balance ?? null,
    redemption_id: row?.redemption_id ?? null,
  });
});
