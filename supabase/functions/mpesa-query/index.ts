// ============================================================
// Fashion Crown Kenya — Payment Status Query Edge Function
// Supports both IntaSend Status Polling & Safaricom STK Push Query
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// IntaSend
const INTASEND_PUBLISHABLE_KEY = Deno.env.get("INTASEND_PUBLISHABLE_KEY") || "";
const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY") || "";
const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox";

// Daraja
const MPESA_CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") || "";
const MPESA_CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") || "";
const MPESA_SHORTCODE = Deno.env.get("MPESA_SHORTCODE") || "174379";
const MPESA_PASSKEY = Deno.env.get("MPESA_PASSKEY") || "";
const MPESA_ENV = Deno.env.get("MPESA_ENV") || "sandbox";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405, origin);
  }

  try {
    const body = await req.json();
    const checkoutRequestId = body.checkoutRequestId || body.checkout_request_id;

    if (!checkoutRequestId) {
      return jsonResponse({ success: false, error: "Missing checkoutRequestId parameter" }, 400, origin);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check local transaction state
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("id, status, amount, votes, mpesa_receipt, result_description")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (txnError || !txn) {
      return jsonResponse({ success: false, error: "Transaction not found" }, 404, origin);
    }

    if (txn.status === "completed" || txn.status === "failed") {
      return jsonResponse(
        {
          success: true,
          status: txn.status,
          votes: txn.votes,
          amount: txn.amount,
          mpesaReceipt: txn.mpesa_receipt,
          resultDescription: txn.result_description,
        },
        200,
        origin
      );
    }

    // 2. Active Query: IntaSend or Daraja
    if (IS_INTASEND) {
      console.log("Checking IntaSend status for invoice:", checkoutRequestId);

      const statusRes = await fetch(`${INTASEND_BASE_URL}/payment/status/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(INTASEND_SECRET_KEY ? { Authorization: `Bearer ${INTASEND_SECRET_KEY}` } : {}),
        },
        body: JSON.stringify({
          public_key: INTASEND_PUBLISHABLE_KEY,
          invoice_id: checkoutRequestId,
        }),
      });

      const statusData = await statusRes.json();
      console.log("IntaSend status response:", statusData);

      const inv = statusData.invoice || statusData;
      const state = String(inv.state || "").toUpperCase();

      if (state === "COMPLETE") {
        const receipt = inv.mpesa_reference || `IS-${checkoutRequestId}`;
        await supabase.rpc("credit_votes", {
          p_checkout_request_id: checkoutRequestId,
          p_mpesa_receipt: receipt,
          p_amount_paid: txn.amount,
        });

        return jsonResponse(
          {
            success: true,
            status: "completed",
            votes: txn.votes,
            amount: txn.amount,
            resultDescription: "Payment verified successfully",
          },
          200,
          origin
        );
      }

      if (state === "FAILED") {
        await supabase.rpc("fail_transaction", {
          p_checkout_request_id: checkoutRequestId,
          p_result_description: inv.failed_reason || "Payment declined or cancelled",
        });

        return jsonResponse(
          {
            success: true,
            status: "failed",
            resultDescription: inv.failed_reason || "Payment declined or cancelled",
          },
          200,
          origin
        );
      }

      return jsonResponse(
        { success: true, status: "pending", resultDescription: "Waiting for M-Pesa PIN confirmation" },
        200,
        origin
      );

    } else {
      // Daraja STK Query
      const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
      const tokenRes = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const timestamp = formatTimestamp();
      const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);

      const queryRes = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });

      const queryData = await queryRes.json();
      const resultCode = String(queryData.ResultCode);

      if (resultCode === "0") {
        await supabase.rpc("credit_votes", {
          p_checkout_request_id: checkoutRequestId,
          p_mpesa_receipt: queryData.MpesaReceiptNumber || `QUERY-${checkoutRequestId.slice(-10)}`,
          p_amount_paid: txn.amount,
        });
        return jsonResponse({ success: true, status: "completed", votes: txn.votes, amount: txn.amount }, 200, origin);
      }

      if (resultCode === "1032") {
        await supabase.rpc("fail_transaction", {
          p_checkout_request_id: checkoutRequestId,
          p_result_description: "Payment cancelled by user",
        });
        return jsonResponse({ success: true, status: "failed", resultDescription: "Payment cancelled by user" }, 200, origin);
      }

      return jsonResponse({ success: true, status: "pending" }, 200, origin);
    }
  } catch (err) {
    console.error("Error in mpesa-query:", err);
    return jsonResponse({ success: false, error: "Failed to verify transaction status" }, 500, origin);
  }
});
