# 🏆 Malonte — Online Fashion Voting Platform

**Malonte** is a premium online fashion competition platform where users vote for their favourite contestants by paying via **M-Pesa**. Every KSh 50 counts as one vote, creating an exciting, transparent, and real-time voting experience.

> Built for the Kenyan market with a zero-cost tech stack.

---

## 📸 Screenshots

> Screenshots coming soon.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML, CSS, JavaScript | Static site with responsive design |
| **Fonts** | Playfair Display + Inter (Google Fonts) | Premium typography |
| **Icons** | Font Awesome 6 (CDN) | UI icons |
| **Database** | Supabase (PostgreSQL) | Data storage, real-time subscriptions |
| **Auth** | Supabase Auth | Admin authentication |
| **Backend** | Supabase Edge Functions (Deno) | M-Pesa integration, API |
| **Payments** | M-Pesa Daraja API | Mobile money payments |
| **Hosting** | Cloudflare Pages | Free static site hosting |
| **Real-time** | Supabase Realtime | Live vote count updates |

---

## ✨ Features

- 🗳 **Live Voting** — Vote for contestants using M-Pesa (KSh 50 = 1 vote, max KSh 1,000 = 20 votes)
- ⏱ **Countdown Timer** — 7-day competition with a live countdown
- 🏅 **Live Leaderboard** — Real-time vote counts powered by Supabase Realtime
- 📱 **Mobile-First Design** — Optimised for phones, beautiful on desktop
- 💳 **M-Pesa STK Push** — Seamless payment via Safaricom Daraja API
- 🔒 **Secure Payments** — Idempotent transaction processing, no double-counting
- 📊 **Public Stats** — Total votes, contributions, and recent activity
- 🎨 **Premium UI** — Black and gold design with smooth animations
- 🔄 **Real-time Updates** — Votes update live across all connected clients
- 📞 **Phone Privacy** — Phone numbers are masked in public views
- 🏷 **Demo Badges** — Demo contestants are clearly marked with [Demo] tags

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser
- [Supabase](https://supabase.com) account (free tier)
- [Safaricom Daraja](https://developer.safaricom.co.ke) developer account
- [Cloudflare Pages](https://pages.cloudflare.com) account (free)
- Git (optional, for deployment)

### 1. Frontend Setup

The frontend is a static site — no build tools required.

```bash
# Clone the repository
git clone https://github.com/your-username/malonte.git
cd malonte

# Open locally
# Simply open index.html in your browser, or use a local server:
npx serve .
# or
python -m http.server 8000
```

### 2. Supabase Setup

1. **Create a project** at [supabase.com](https://supabase.com)

2. **Run the database migration:**
   - Go to the **SQL Editor** in your Supabase dashboard
   - Paste the contents of [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql)
   - Click **Run** to execute

3. **Copy your credentials:**
   - Go to **Settings → API**
   - Copy the **Project URL** and **anon (public) key**
   - Update `js/supabase.js` with your credentials:
     ```javascript
     const SUPABASE_URL = 'https://your-project.supabase.co';
     const SUPABASE_ANON_KEY = 'your-anon-key-here';
     ```

4. **Deploy Edge Functions:**
   ```bash
   # Install the Supabase CLI
   npm install -g supabase

   # Login
   supabase login

   # Link to your project
   supabase link --project-ref your-project-ref

   # Deploy the edge functions
   supabase functions deploy mpesa-stk-push --no-verify-jwt
   supabase functions deploy mpesa-callback --no-verify-jwt
   supabase functions deploy api --no-verify-jwt
   ```

5. **Set Edge Function secrets:**
   ```bash
   supabase secrets set MPESA_CONSUMER_KEY=your_consumer_key
   supabase secrets set MPESA_CONSUMER_SECRET=your_consumer_secret
   supabase secrets set MPESA_SHORTCODE=174379
   supabase secrets set MPESA_PASSKEY=your_passkey
   supabase secrets set MPESA_CALLBACK_URL=https://your-project.supabase.co/functions/v1/mpesa-callback
   supabase secrets set MPESA_ENV=sandbox
   supabase secrets set CLOUDFLARE_PAGES_DOMAIN=your-site.pages.dev
   ```

### 3. M-Pesa Daraja Setup

1. **Register** at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. **Create a new app** under "My Apps"
3. **Enable** Lipa na M-Pesa Online (STK Push)
4. **Copy** your Consumer Key and Consumer Secret
5. **For sandbox testing**, use the default test credentials:
   - Shortcode: `174379`
   - Passkey: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
   - Test phone: `254708374149`

### 4. Cloudflare Pages Deployment

1. **Push** your code to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com)
3. Click **Create a project → Connect to Git**
4. Select your repository
5. Configure build settings:
   - **Build command:** *(leave empty)*
   - **Build output directory:** `.` or `/`
6. Click **Save and Deploy**
7. Update your `CLOUDFLARE_PAGES_DOMAIN` secret in Supabase with your `.pages.dev` domain

---

## 🔐 Environment Variables

Set these as Supabase Edge Function secrets:

| Variable | Description | Example |
|----------|-------------|---------|
| `MPESA_CONSUMER_KEY` | Daraja API consumer key | `abc123...` |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret | `def456...` |
| `MPESA_SHORTCODE` | M-Pesa business shortcode | `174379` |
| `MPESA_PASSKEY` | Lipa na M-Pesa passkey | `bfb279f9...` |
| `MPESA_CALLBACK_URL` | Full URL to the callback function | `https://xyz.supabase.co/functions/v1/mpesa-callback` |
| `MPESA_ENV` | `sandbox` or `production` | `sandbox` |
| `CLOUDFLARE_PAGES_DOMAIN` | Your Cloudflare Pages domain | `malonte.pages.dev` |

> **Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

---

## 🗳 Voting System

| Amount (KSh) | Votes |
|---------------|-------|
| 50 | 1 |
| 100 | 2 |
| 150 | 3 |
| 200 | 4 |
| 250 | 5 |
| 500 | 10 |
| 1,000 | 20 |

- **Minimum:** KSh 50 (1 vote)
- **Maximum:** KSh 1,000 (20 votes)
- **Increment:** Multiples of KSh 50
- **Payment method:** M-Pesa STK Push (prompt sent to phone)

---

## 📁 Project Structure

```
malonte/
├── index.html                          # Homepage
├── vote.html                           # Voting page
├── leaderboard.html                    # Leaderboard page
├── how-it-works.html                   # How it works page
├── README.md                           # This file
│
├── css/
│   └── styles.css                      # Global styles
│
├── js/
│   ├── supabase.js                     # Supabase client config
│   ├── app.js                          # Homepage logic
│   ├── vote.js                         # Voting page logic
│   └── leaderboard.js                  # Leaderboard logic
│
└── supabase/
    ├── migrations/
    │   └── 001_schema.sql              # Database schema + seed data
    │
    └── functions/
        ├── mpesa-stk-push/
        │   └── index.ts                # STK Push initiation
        ├── mpesa-callback/
        │   └── index.ts                # M-Pesa payment callback
        └── api/
            └── index.ts                # General API endpoints
```

---

## 📡 API Endpoints

### 1. Initiate Vote (STK Push)

```
POST /functions/v1/mpesa-stk-push
```

**Request Body:**
```json
{
  "contestantId": "uuid",
  "competitionId": "uuid",
  "amount": 100,
  "phoneNumber": "254712345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "STK Push sent. Please check your phone and enter your M-Pesa PIN.",
  "checkoutRequestId": "ws_CO_...",
  "merchantRequestId": "...",
  "votes": 2
}
```

### 2. M-Pesa Callback (Internal)

```
POST /functions/v1/mpesa-callback
```

> Called by M-Pesa after payment. Not for public use.

### 3. Check Vote Status

```
GET /functions/v1/api/vote-status?checkoutRequestId=ws_CO_...
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "status": "completed",
    "votes": 2,
    "amount": 100,
    "resultDescription": "Payment successful",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### 4. Competition Stats

```
GET /functions/v1/api/stats?competitionId=uuid
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "competition": { "id": "...", "title": "...", "status": "active", "startDate": "...", "endDate": "..." },
    "totalVotes": 150,
    "totalContributions": 7500,
    "contestantCount": 5,
    "totalTransactions": 42
  }
}
```

### 5. Recent Votes

```
GET /functions/v1/api/recent-votes?competitionId=uuid&limit=20
```

**Response:**
```json
{
  "success": true,
  "recentVotes": [
    {
      "id": "uuid",
      "contestantName": "Amina Nyambura",
      "phoneMasked": "254***678",
      "amount": 100,
      "votes": 2,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

## 💻 Development

### Running Locally

The frontend works out of the box with mock data:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended)
npx serve .

# Option 3: Use VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

### Testing M-Pesa (Sandbox)

1. Use the Daraja sandbox credentials (set in environment variables)
2. Use test phone number: `254708374149`
3. The STK Push prompt will appear on the sandbox simulator at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)

### Database Changes

To modify the database schema:

1. Create a new migration file in `supabase/migrations/`
2. Write your SQL changes
3. Run in the Supabase SQL Editor or via CLI:
   ```bash
   supabase db push
   ```

---

## 📄 License

This project is licensed under the **MIT License** — see below.

```
MIT License

Copyright (c) 2025 Malonte Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👥 Authors

**Malonte Team**

Built with ❤️ in Kenya.
