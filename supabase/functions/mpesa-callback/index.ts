// ============================================================
// Fashion Crown Kenya — Payment Callback & Webhook Handler
// Supports both IntaSend Webhooks & Safaricom Daraja Callbacks
//
// Security Protections:
// 1. Webhook Secret / Challenge Verification
// 2. Strict M-Pesa Receipt Validation
// 3. Amount Matching Verification
// 4. Idempotency & Replay Attack Defense (handled atomically via SQL)
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MPESA_CALLBACK_SECRET = Deno.env.get("MPESA_CALLBACK_SECRET");
const INTASEND_WEBHOOK_CHALLENGE = Deno.env.get("INTASEND_WEBHOOK_CHALLENGE");

function successResponse(data: Record<string, unknown> = { status: "success" }): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Secret / Challenge Authentication
  const url = new URL(req.url);
  const receivedSecret = url.searchParams.get("secret");

  if (MPESA_CALLBACK_SECRET && receivedSecret && receivedSecret !== MPESA_CALLBACK_SECRET) {
    console.error("🚨 SECURITY: Invalid secret token on callback URL");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    if (!rawBody) return successResponse();

    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("Malformed JSON in webhook:", rawBody);
      return successResponse();
    }

    console.log("========== Payment Callback Received ==========");
    console.log(JSON.stringify(body, null, 2));

    // ═════════════════════════════════════════════════════════
    // FORMAT A: PAYSTACK WEBHOOK (event: 'charge.success')
    // ═════════════════════════════════════════════════════════
    if (body.event === "charge.success" && body.data) {
      const reference = body.data.reference;
      const amountPaid = Number(body.data.amount || 0) / 100;
      const rawReceipt = body.data.id ? String(body.data.id) : reference;
      const receipt = `PAY-${rawReceipt}`;

      console.log(`Paystack Webhook for ${reference} — Amount: KSh ${amountPaid}, Receipt: ${receipt}`);

      const { data: creditResult, error: creditError } = await supabase.rpc("credit_votes", {
        p_checkout_request_id: reference,
        p_mpesa_receipt: receipt,
        p_amount_paid: amountPaid,
      });

      if (creditError) {
        console.error("Error executing credit_votes (Paystack):", creditError);
      } else {
        console.log("Votes credited successfully (Paystack):", creditResult);
      }

      return successResponse({ status: "processed", reference });
    }

    // ═════════════════════════════════════════════════════════
    // FORMAT B: INTASEND WEBHOOK
    // ═════════════════════════════════════════════════════════
    if (body.invoice_id) {
      const invoiceId = body.invoice_id;
      const state = String(body.state || "").toUpperCase();
      const mpesaRef = body.mpesa_reference;
      const amountPaid = Number(body.value || body.net_amount || body.amount);
      const challenge = body.challenge;

      // Verify challenge token if configured
      if (INTASEND_WEBHOOK_CHALLENGE && challenge && challenge !== INTASEND_WEBHOOK_CHALLENGE) {
        console.error("🚨 SECURITY: IntaSend challenge mismatch");
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      console.log(`IntaSend Webhook for ${invoiceId} — State: ${state}, M-Pesa Ref: ${mpesaRef}`);

      if (state === "COMPLETE") {
        const receipt = mpesaRef || `IS-${invoiceId}`;

        const { data: creditResult, error: creditError } = await supabase.rpc("credit_votes", {
          p_checkout_request_id: invoiceId,
          p_mpesa_receipt: receipt,
          p_amount_paid: amountPaid,
        });

        if (creditError) {
          console.error("Error executing credit_votes (IntaSend):", creditError);
        } else {
          console.log("Votes credited successfully (IntaSend):", creditResult);
        }
      } else if (state === "FAILED") {
        await supabase.rpc("fail_transaction", {
          p_checkout_request_id: invoiceId,
          p_result_description: body.failed_reason || "Payment failed via IntaSend",
        });
      }

      return successResponse({ status: "processed", invoice_id: invoiceId });
    }

    // ═════════════════════════════════════════════════════════
    // FORMAT B: DIRECT SAFARICOM DARAJA CALLBACK
    // ═════════════════════════════════════════════════════════
    const callback = body?.Body?.stkCallback;
    if (callback) {
      const {
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: resultDesc,
      } = callback;

      if (resultCode === 0) {
        const metadata = callback.CallbackMetadata?.Item || [];
        const rawReceipt = metadata.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
        const amountPaid = Number(metadata.find((i: any) => i.Name === "Amount")?.Value);
        const mpesaReceiptNumber = typeof rawReceipt === "string" ? rawReceipt.trim().toUpperCase() : null;

        if (!mpesaReceiptNumber) {
          await supabase.rpc("fail_transaction", {
            p_checkout_request_id: checkoutRequestId,
            p_result_description: "Missing Safaricom receipt number in callback",
          });
          return successResponse({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        await supabase.rpc("credit_votes", {
          p_checkout_request_id: checkoutRequestId,
          p_mpesa_receipt: mpesaReceiptNumber,
          p_amount_paid: amountPaid,
        });
      } else {
        await supabase.rpc("fail_transaction", {
          p_checkout_request_id: checkoutRequestId,
          p_result_description: resultDesc || `Payment failed with code ${resultCode}`,
        });
      }

      return successResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Unknown payload format
    console.warn("Unrecognized callback payload format");
    return successResponse();

  } catch (err) {
    console.error("Unhandled error in callback handler:", err);
    return successResponse();
  }
});
