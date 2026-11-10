// ============================================================
// Fashion Crown Kenya — M-Pesa STK Push Edge Function
// Supports IntaSend Payment Gateway (Privacy-first, No Business Registration)
// with Daraja fallback
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// --------------- Configuration ---------------

// IntaSend Configuration (Option 1: Hides personal name, no business docs required)
const INTASEND_PUBLISHABLE_KEY = Deno.env.get("INTASEND_PUBLISHABLE_KEY") || "";
const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY") || "";
const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox"; // 'sandbox' or 'production'

// Direct Daraja Configuration (Optional fallback)
const MPESA_CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") || "";
const MPESA_CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") || "";
const MPESA_SHORTCODE = Deno.env.get("MPESA_SHORTCODE") || "174379";
const MPESA_PASSKEY = Deno.env.get("MPESA_PASSKEY") || "";
const MPESA_CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL") || "";
const MPESA_CALLBACK_SECRET = Deno.env.get("MPESA_CALLBACK_SECRET") || "";
const MPESA_ENV = Deno.env.get("MPESA_ENV") || "sandbox";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Determine active provider: IntaSend or Direct Daraja
const IS_INTASEND = Boolean(
  INTASEND_PUBLISHABLE_KEY ||
  INTASEND_SECRET_KEY ||
  Deno.env.get("PAYMENT_PROVIDER") === "intasend"
);

const INTASEND_BASE_URL =
  INTASEND_ENV === "production"
    ? "https://payment.intasend.com/api/v1"
    : "https://sandbox.intasend.com/api/v1";

const DARAJA_BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// Allowed origins for CORS
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

// --------------- Helpers ---------------

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".pages.dev") ||
    origin.includes("localhost")
  );

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin),
    },
  });
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-+()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "254" + cleaned.substring(1);
  }
  if (cleaned.startsWith("+254")) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

function validateKenyanPhone(phone: string): boolean {
  return /^254[17][0-9]{8}$/.test(phone);
}

// Direct Daraja Helpers
function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

async function getDarajaToken(): Promise<string> {
  const credentials = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
  const response = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!response.ok) {
    throw new Error("Failed to obtain Daraja access token");
  }
  const data = await response.json();
  return data.access_token;
}

// --------------- Main Handler ---------------

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405, origin);
  }

  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const contestantId = body.contestantId || body.contestant_id;
    let competitionId = body.competitionId || body.competition_id;
    const amount = body.amount;
    const phoneNumber = body.phoneNumber || body.phone_number;

    // --------------- 1. Input Validation ---------------

    if (!contestantId || !amount || !phoneNumber) {
      return jsonResponse(
        { success: false, error: "Missing required fields: contestantId, amount, phoneNumber" },
        400,
        origin
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 50 || numericAmount > 1000) {
      return jsonResponse(
        { success: false, error: "Voting amount must be between KSh 50 and KSh 1,000" },
        400,
        origin
      );
    }

    if (numericAmount % 50 !== 0) {
      return jsonResponse(
        { success: false, error: "Voting amount must be a multiple of KSh 50" },
        400,
        origin
      );
    }

    const formattedPhone = formatPhoneNumber(String(phoneNumber));
    if (!validateKenyanPhone(formattedPhone)) {
      return jsonResponse(
        { success: false, error: "Please enter a valid Kenyan phone number (e.g. 0712345678 or 0112345678)" },
        400,
        origin
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --------------- 2. Rate Limiting Protection ---------------

    // Rate Limit A: By IP Address
    const { data: ipLimit } = await supabase.rpc("check_rate_limit", {
      p_key: `ip:${clientIp}`,
      p_max_attempts: 10,
      p_window_seconds: 120,
      p_block_seconds: 600,
    });

    if (ipLimit && !ipLimit.allowed) {
      return jsonResponse(
        { success: false, error: `Too many requests from your network. Please wait ${ipLimit.retry_after || 60}s.` },
        429,
        origin
      );
    }

    // Rate Limit B: By Phone Number
    const { data: phoneLimit } = await supabase.rpc("check_rate_limit", {
      p_key: `phone:${formattedPhone}`,
      p_max_attempts: 3,
      p_window_seconds: 120,
      p_block_seconds: 300,
    });

    if (phoneLimit && !phoneLimit.allowed) {
      return jsonResponse(
        { success: false, error: `Too many STK pushes requested. Please check your phone or wait ${phoneLimit.retry_after || 60}s.` },
        429,
        origin
      );
    }

    // Rate Limit C: Prevent duplicate prompt while a transaction is actively pending (< 45s)
    const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString();
    const { data: activePending } = await supabase
      .from("transactions")
      .select("id, created_at")
      .eq("phone_number", formattedPhone)
      .eq("status", "pending")
      .gt("created_at", fortyFiveSecondsAgo)
      .maybeSingle();

    if (activePending) {
      return jsonResponse(
        { success: false, error: "An STK push was already sent to your phone. Please enter your PIN or wait 45 seconds." },
        429,
        origin
      );
    }

    // --------------- 3. Database Checks ---------------

    const { data: contestant, error: contestantError } = await supabase
      .from("contestants")
      .select("id, name, competition_id")
      .eq("id", contestantId)
      .single();

    if (contestantError || !contestant) {
      return jsonResponse({ success: false, error: "Contender not found" }, 404, origin);
    }

    if (!competitionId) {
      competitionId = contestant.competition_id;
    }

    const { data: competition, error: competitionError } = await supabase
      .from("competitions")
      .select("id, status, start_date, end_date")
      .eq("id", competitionId)
      .single();

    if (competitionError || !competition) {
      return jsonResponse({ success: false, error: "Competition not found" }, 404, origin);
    }

    const now = new Date();
    const isActive = new Date(competition.start_date) <= now && new Date(competition.end_date) > now;
    if (!isActive) {
      return jsonResponse({ success: false, error: "Voting for this competition has closed." }, 400, origin);
    }

    const votes = Math.floor(numericAmount / 50);
    let checkoutRequestId = "";
    let merchantRequestId = "";

    // --------------- 4. Dispatch Payment Request ---------------

    if (IS_INTASEND) {
      // ═══════════════════════════════════════════════════════
      // INTASEND PAYMENT GATEWAY (Option 1: Privacy Preserved)
      // ═══════════════════════════════════════════════════════
      console.log(`Initiating IntaSend STK Push for ${formattedPhone}, KSh ${numericAmount}`);

      const apiRef = `FC-${contestantId.slice(0, 4)}-${Date.now()}`;
      const intasendPayload = {
        public_key: INTASEND_PUBLISHABLE_KEY,
        currency: "KES",
        amount: numericAmount,
        phone_number: formattedPhone,
        api_ref: apiRef,
        narrative: `Fashion Crown Vote for ${contestant.name.slice(0, 20)}`,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (INTASEND_SECRET_KEY) {
        headers["Authorization"] = `Bearer ${INTASEND_SECRET_KEY}`;
      }

      const intasendRes = await fetch(`${INTASEND_BASE_URL}/payment/mpesa-stk-push/`, {
        method: "POST",
        headers,
        body: JSON.stringify(intasendPayload),
      });

      const intasendData = await intasendRes.json();

      if (!intasendRes.ok || intasendData.errors) {
        console.error("IntaSend STK Push Error:", intasendData);
        const errMsg = intasendData.errors?.[0]?.message || intasendData.detail || "Failed to trigger M-Pesa STK Push via IntaSend.";
        return jsonResponse({ success: false, error: errMsg }, 400, origin);
      }

      checkoutRequestId = intasendData.invoice?.invoice_id || intasendData.id || `IS-${Date.now()}`;
      merchantRequestId = apiRef;

    } else {
      // ═══════════════════════════════════════════════════════
      // DIRECT DARAJA FALLBACK
      // ═══════════════════════════════════════════════════════
      console.log(`Initiating Direct Daraja STK Push for ${formattedPhone}, KSh ${numericAmount}`);

      const accessToken = await getDarajaToken();
      const timestamp = formatTimestamp();
      const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

      const finalCallbackUrl = MPESA_CALLBACK_SECRET
        ? `${MPESA_CALLBACK_URL}?secret=${encodeURIComponent(MPESA_CALLBACK_SECRET)}`
        : MPESA_CALLBACK_URL;

      const stkPayload = {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: numericAmount,
        PartyA: formattedPhone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: finalCallbackUrl,
        AccountReference: "FASHIONCROWN",
        TransactionDesc: `Fashion Crown Vote for ${contestant.name.slice(0, 20)}`,
      };

      const stkResponse = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(stkPayload),
      });

      const stkData = await stkResponse.json();
      if (stkData.ResponseCode !== "0") {
        return jsonResponse(
          { success: false, error: stkData.errorMessage || "M-Pesa payment initiation failed." },
          400,
          origin
        );
      }

      checkoutRequestId = stkData.CheckoutRequestID;
      merchantRequestId = stkData.MerchantRequestID;
    }

    // --------------- 5. Record Pending Transaction ---------------

    const { error: insertError } = await supabase.from("transactions").insert({
      competition_id: competitionId,
      contestant_id: contestantId,
      phone_number: formattedPhone,
      amount: numericAmount,
      votes: votes,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      status: "pending",
      client_ip: clientIp,
    });

    if (insertError) {
      console.error("Database insert error:", insertError);
    }

    return jsonResponse(
      {
        success: true,
        message: "STK Push sent. Please check your phone and enter your M-Pesa PIN.",
        checkoutRequestId: checkoutRequestId,
        checkout_request_id: checkoutRequestId,
        merchantRequestId: merchantRequestId,
        merchant_request_id: merchantRequestId,
        votes: votes,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("Unhandled exception in mpesa-stk-push:", error);
    return jsonResponse({ success: false, error: "An unexpected error occurred. Please try again." }, 500, origin);
  }
});
