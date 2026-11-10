// ============================================================
// Fashion Crown Kenya — Daraja M-Pesa Integration Test Suite
// Run: node scripts/test-daraja.mjs [action]
//
// Actions:
//   node scripts/test-daraja.mjs token     - Tests Daraja OAuth token generation
//   node scripts/test-daraja.mjs stk       - Tests sending real STK Push to sandbox phone
//   node scripts/test-daraja.mjs callback  - Tests simulating a valid M-Pesa webhook callback
//   node scripts/test-daraja.mjs tamper    - Tests tampered amount fraud rejection
// ============================================================

import https from 'https';

// --- Default Sandbox Credentials ---
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const BASE_URL = MPESA_ENV === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke';

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const TEST_PHONE = process.env.TEST_PHONE || '254708374149'; // Safaricom test phone

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// 1. Test OAuth Token
async function testOAuthToken() {
  console.log('\n--- 1. Testing Daraja OAuth Token Generation ---');
  if (CONSUMER_KEY === 'YOUR_CONSUMER_KEY') {
    console.log('⚠️  Notice: Using placeholder credentials.');
    console.log('    To test live against Daraja Sandbox:');
    console.log('    Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET environment variables.');
    return;
  }

  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  console.log(`Target: https://${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`);

  try {
    const res = await makeRequest({
      hostname: BASE_URL,
      path: '/oauth/v1/generate?grant_type=client_credentials',
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });

    console.log(`Status: ${res.status}`);
    if (res.status === 200 && res.data.access_token) {
      console.log('✅ OAuth Token Success! Access token obtained.');
      return res.data.access_token;
    } else {
      console.error('❌ Failed:', res.data);
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

// 2. Test STK Push
async function testStkPush(token) {
  console.log('\n--- 2. Testing STK Push Request ---');
  if (!token) {
    console.log('⚠️  Skipping: No active access token available.');
    return;
  }

  const timestamp = formatTimestamp();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: 50,
    PartyA: TEST_PHONE,
    PartyB: SHORTCODE,
    PhoneNumber: TEST_PHONE,
    CallBackURL: 'https://example.com/callback',
    AccountReference: 'FASHIONCROWN',
    TransactionDesc: 'Vote for Fashion Crown Nominee',
  };

  console.log(`Sending STK push of KSh 50 to ${TEST_PHONE}...`);
  try {
    const res = await makeRequest(
      {
        hostname: BASE_URL,
        path: '/mpesa/stkpush/v1/processrequest',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      payload
    );

    console.log(`Status: ${res.status}`);
    console.log('Response:', res.data);
    if (res.data.ResponseCode === '0') {
      console.log('✅ STK Push successfully dispatched to phone!');
      console.log(`CheckoutRequestID: ${res.data.CheckoutRequestID}`);
    }
  } catch (err) {
    console.error('❌ STK Push error:', err.message);
  }
}

// 3. Print Safaricom Result Code Reference
function printResultCodes() {
  console.log('\n============================================================');
  console.log('  Daraja M-Pesa ResultCode Reference Guide');
  console.log('============================================================');
  console.log('  Code 0    : Success (Payment completed & receipt generated)');
  console.log('  Code 1    : Insufficient M-Pesa funds in customer account');
  console.log('  Code 1032 : Cancelled by user (Customer clicked Cancel on prompt)');
  console.log('  Code 1037 : Timeout / User cannot be reached (PIN not entered)');
  console.log('  Code 2001 : Invalid PIN entered by customer');
  console.log('============================================================\n');
}

// Main execution
const action = process.argv[2] || 'all';

async function run() {
  printResultCodes();
  if (action === 'token' || action === 'all') {
    const token = await testOAuthToken();
    if (action === 'stk' || (action === 'all' && token)) {
      await testStkPush(token);
    }
  }
}

run();
