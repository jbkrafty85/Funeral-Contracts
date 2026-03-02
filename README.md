# Funeral Contract Advisor — Deployment Guide

## What This Is
A web app that lets families upload or enter funeral contract details and ask an AI advisor questions. The AI uses Claude (claude-opus-4-5) with a deep funeral industry knowledge base to analyze contracts, identify red flags, estimate potential savings, and recommend a paid advisor call when warranted.

---

## Project Structure
```
funeral-advisor/
├── api/
│   └── ask.js          ← Vercel serverless function (Claude API backend)
├── public/
│   └── index.html      ← Frontend (single-page app)
├── vercel.json         ← Vercel routing config
├── package.json        ← Node dependencies
└── .env.example        ← Environment variable template
```

---

## Deploy to Vercel (Step by Step)

### Step 1 — Get Your Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Deploy to Vercel
1. Go to https://vercel.com and sign up (free)
2. Click **Add New → Project**
3. Choose **"Deploy from a folder"** or connect GitHub
   - Easiest: Install [Vercel CLI](https://vercel.com/docs/cli) and run `vercel` in this folder
   - Or: Push this folder to GitHub, then import the repo in Vercel
4. Vercel will auto-detect the project structure

### Step 3 — Add Your API Key
In Vercel project settings:
1. Go to **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-your-key-here`
   - **Environment:** Production (and Preview if desired)
3. Click **Save** and **Redeploy**

### Step 4 — Add Your Booking Link
In `public/index.html`, find:
```javascript
window.open('https://YOUR-BOOKING-LINK-HERE.com', '_blank');
```
Replace with your actual booking/payment URL (Calendly, Stripe, etc.)

---

## How the AI Call Recommendation Works

The AI analyzes each response for:
- **Potential savings > $750** → triggers banner
- **Red flag contract terms** (non-transferable, non-guaranteed pricing, no cancellation)
- **Total contract > $10,000** → warrants professional review
- **Corporate chain / funeral home + cemetery combo** detected
- **Possible FTC Funeral Rule violations**

When triggered, a green banner appears:
> "Our Advisors May Be Able to Save You Money — Estimated Savings: $1,500–$3,000"

The "Speak with an Advisor" button opens your booking link.

---

## Phase 2: Salesforce Integration (Future)
When ready to integrate your Salesforce case data:
1. Add a Salesforce Connected App and get credentials
2. In `api/ask.js`, add a lookup function to pull relevant past cases
3. Inject case summaries into the system prompt as additional context
4. This will dramatically improve accuracy for specific funeral home names / regions

---

## Local Development
```bash
npm install
cp .env.example .env.local
# Add your API key to .env.local
npx vercel dev
# Visit http://localhost:3000
```

---

## Customization

**To adjust when the CTA fires**, edit the `ADVISOR_CTA` section in `api/ask.js`:
```
Use this marker when ANY of the following are true:
1. Estimated potential savings exceed $750     ← change threshold here
2. Red flag contract term detected
3. Total contract value exceeds $10,000        ← change threshold here
...
```

**To update pricing benchmarks**, edit the `NATIONAL PRICING BENCHMARKS` section in the system prompt in `api/ask.js`.

**To change the Claude model**, find `model: "claude-opus-4-5-20251101"` and update as needed.
