// ============================================================
// Fashion Crown Kenya — General API Edge Function
// Hardened public API for vote status polling and live statistics
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "http://localhost",
  "http://localhost:8080",
  "http://127.0.0.1",
  "http://127.0.0.1:8080",
];

const CF_PAGES_DOMAIN = Deno.env.get("CLOUDFLARE_PAGES_DOMAIN");
if (CF_PAGES_DOMAIN) {
  ALLOWED_ORIGINS.push(`https://${CF_PAGES_DOMAIN}`);
}
const CUSTOM_DOMAIN = Deno.env.get("CUSTOM_DOMAIN");
if (CUSTOM_DOMAIN) {
  ALLOWED_ORIGINS.push(`https://${CUSTOM_DOMAIN}`);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".pages.dev") ||
    origin.includes("localhost")
  );

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  data: Record<string, unknown>,
  status: number,
  origin: string | null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin),
    },
  });
}

// --------------- Route Handlers ---------------

/**
 * GET /api/vote-status?checkoutRequestId=xxx
 * Poll transaction status without leaking private phone numbers
 */
async function handleVoteStatus(
  url: URL,
  origin: string | null,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const checkoutRequestId = url.searchParams.get("checkoutRequestId");

  if (!checkoutRequestId || checkoutRequestId.length < 5 || checkoutRequestId.length > 100) {
    return jsonResponse(
      { success: false, error: "Invalid checkoutRequestId parameter" },
      400,
      origin
    );
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("id, status, votes, amount, result_description, created_at")
    .eq("checkout_request_id", checkoutRequestId)
    .maybeSingle();

  if (error || !transaction) {
    return jsonResponse(
      { success: false, error: "Transaction not found" },
      404,
      origin
    );
  }

  return jsonResponse(
    {
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        votes: transaction.votes,
        amount: transaction.amount,
        resultDescription: transaction.result_description,
        createdAt: transaction.created_at,
      },
    },
    200,
    origin
  );
}

/**
 * GET /api/stats?competitionId=xxx
 * Public statistics for a competition
 */
async function handleStats(
  url: URL,
  origin: string | null,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const competitionId = url.searchParams.get("competitionId");

  if (!competitionId) {
    return jsonResponse(
      { success: false, error: "Missing competitionId parameter" },
      400,
      origin
    );
  }

  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .select("id, title, status, start_date, end_date")
    .eq("id", competitionId)
    .single();

  if (compError || !competition) {
    return jsonResponse(
      { success: false, error: "Competition not found" },
      404,
      origin
    );
  }

  const { count: contestantCount } = await supabase
    .from("contestants")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  const { data: contestants } = await supabase
    .from("contestants")
    .select("vote_count")
    .eq("competition_id", competitionId);

  const totalVotes = contestants?.reduce((sum, c) => sum + (c.vote_count || 0), 0) || 0;

  const { data: completedTransactions } = await supabase
    .from("transactions")
    .select("amount")
    .eq("competition_id", competitionId)
    .eq("status", "completed");

  const totalContributions =
    completedTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  const { count: transactionCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("status", "completed");

  return jsonResponse(
    {
      success: true,
      stats: {
        competition: {
          id: competition.id,
          title: competition.title,
          status: competition.status,
          startDate: competition.start_date,
          endDate: competition.end_date,
        },
        totalVotes,
        totalContributions,
        contestantCount: contestantCount || 0,
        totalTransactions: transactionCount || 0,
      },
    },
    200,
    origin
  );
}

/**
 * GET /api/recent-votes?competitionId=xxx&limit=15
 * Anonymised recent vote feed from public view
 */
async function handleRecentVotes(
  url: URL,
  origin: string | null,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const competitionId = url.searchParams.get("competitionId");
  const rawLimit = Number(url.searchParams.get("limit")) || 15;
  const limit = Math.max(1, Math.min(50, rawLimit)); // Clamped between 1 and 50

  let query = supabase
    .from("public_transactions")
    .select("id, contestant_name, phone_masked, amount, votes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (competitionId) {
    query = query.eq("competition_id", competitionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent votes:", error);
    return jsonResponse({ success: false, error: "Failed to fetch activity feed" }, 500, origin);
  }

  return jsonResponse({ success: true, votes: data || [] }, 200, origin);
}

// --------------- Router ---------------

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  if (req.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405, origin);
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (path.endsWith("/vote-status") || path.endsWith("/vote-status/")) {
      return await handleVoteStatus(url, origin, supabase);
    }
    if (path.endsWith("/stats") || path.endsWith("/stats/")) {
      return await handleStats(url, origin, supabase);
    }
    if (path.endsWith("/recent-votes") || path.endsWith("/recent-votes/")) {
      return await handleRecentVotes(url, origin, supabase);
    }

    return jsonResponse({ success: false, error: "Endpoint not found" }, 404, origin);
  } catch (err) {
    console.error("API error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500, origin);
  }
});
