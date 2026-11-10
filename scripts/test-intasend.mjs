// ============================================================
// Fashion Crown Kenya — IntaSend Integration Test Script
// Run: node scripts/test-intasend.mjs [action]
//
// Usage:
//   node scripts/test-intasend.mjs push <phone> <amount>
//   node scripts/test-intasend.mjs status <invoice_id>
// ============================================================

import https from 'https';

const INTASEND_ENV = process.env.INTASEND_ENV || 'sandbox';
const BASE_HOST = INTASEND_ENV === 'production' ? 'payment.intasend.com' : 'sandbox.intasend.com';

const PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY || 'ISPubKey_test_sample';
const SECRET_KEY = process.env.INTASEND_SECRET_KEY || 'ISSecretKey_test_sample';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

const action = process.argv[2] || 'help';

async function main() {
  console.log(`\n============================================================`);
  console.log(`  IntaSend M-Pesa Test Suite (Environment: ${INTASEND_ENV})`);
  console.log(`============================================================\n`);

  if (action === 'push') {
    const phone = process.argv[3] || '254708374149';
    const amount = Number(process.argv[4]) || 50;

    console.log(`Sending IntaSend STK Push to ${phone} for KSh ${amount}...`);
    const payload = {
      public_key: PUBLISHABLE_KEY,
      currency: 'KES',
      amount: amount,
      phone_number: phone,
      api_ref: `TEST-${Date.now()}`,
      narrative: 'Fashion Crown Test Vote',
    };

    try {
      const res = await request(
        {
          hostname: BASE_HOST,
          path: '/api/v1/payment/mpesa-stk-push/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SECRET_KEY ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
          },
        },
        payload
      );

      console.log(`HTTP Status: ${res.status}`);
      console.log('Response:', JSON.stringify(res.data, null, 2));

      if (res.data.invoice?.invoice_id) {
        console.log(`\n✅ STK Push Dispatched! Invoice ID: ${res.data.invoice.invoice_id}`);
        console.log(`   Check status using: node scripts/test-intasend.mjs status ${res.data.invoice.invoice_id}`);
      }
    } catch (err) {
      console.error('❌ Request error:', err.message);
    }
  } else if (action === 'status') {
    const invoiceId = process.argv[3];
    if (!invoiceId) {
      console.log('⚠️ Please provide an invoice ID: node scripts/test-intasend.mjs status <invoice_id>');
      return;
    }

    console.log(`Checking status for invoice ${invoiceId}...`);
    try {
      const res = await request(
        {
          hostname: BASE_HOST,
          path: '/api/v1/payment/status/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SECRET_KEY ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
          },
        },
        {
          public_key: PUBLISHABLE_KEY,
          invoice_id: invoiceId,
        }
      );

      console.log(`HTTP Status: ${res.status}`);
      console.log('Status Result:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error('❌ Request error:', err.message);
    }
  } else {
    console.log('Available commands:');
    console.log('  node scripts/test-intasend.mjs push 254712345678 100');
    console.log('  node scripts/test-intasend.mjs status <invoice_id>');
  }
}

main();
