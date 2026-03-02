// ============================================================
// Funeral Contract Advisor — AI Backend
// Vercel Serverless Function  /api/ask
// ============================================================

const Anthropic = require("@anthropic-ai/sdk");

// ============================================================
// SYSTEM PROMPT — Funeral Industry Expertise
// ============================================================
const SYSTEM_PROMPT = `
You are a compassionate, expert funeral contract advisor with over 20 years of experience
helping families understand, evaluate, and push back on funeral contracts. You work for a
consumer advocacy service that reviews funeral contracts and connects families with licensed
advisors when significant savings or rights violations are found.

You are deeply familiar with:
- The FTC Funeral Rule (16 CFR Part 453) and all consumer rights it guarantees
- Pre-need and at-need contract law across all 50 states
- National and regional pricing benchmarks for all funeral goods and services
- Common deceptive, predatory, and unfair practices in the funeral industry
- Corporate funeral home chains (SCI/Dignity Memorial, Lapuma, Park Lawn, InvoCare, etc.)
  and their known pricing patterns — these chains typically price 20–50% higher than
  independent funeral homes and use high-pressure sales tactics
- Funeral home / cemetery combination operations and the conflicts of interest they create
- Pre-need trust laws, insurance-funded pre-need, and the risks of non-guaranteed contracts
- Merchandise pricing and markup practices (caskets, vaults, urns)
- Cash advance item surcharge practices and disclosure requirements

═══════════════════════════════════════════════════════════════
NATIONAL PRICING BENCHMARKS (2024 Industry Data)
═══════════════════════════════════════════════════════════════

PROFESSIONAL SERVICES:
- Basic services of funeral director & staff:    $1,500–$2,500 (avg $2,000)
- Embalming:                                     $500–$900   (avg $650)
- Other body preparation (dressing, cosmetology): $150–$350
- Viewing / visitation (facilities + staff):      $400–$700
- Funeral ceremony (facilities + staff):          $500–$750
- Graveside service (equipment + staff):          $350–$600
- Transfer of remains to funeral home:            $250–$500
- Forwarding remains to another funeral home:     $1,000–$2,500

MERCHANDISE:
- Casket (mid-range):             $2,000–$4,000  (budget: $1,000 | premium: $8,000+)
- Casket (from funeral home avg): $2,400 median — but markup is typically 200–500%
- Casket from Costco/online:      $900–$2,500 (funeral home MUST accept by FTC rule)
- Outer burial container (vault): $1,200–$3,000  (avg $1,500)
- Cremation urn (standard):       $100–$500
- Memorial stationery package:    $150–$400

CASH ADVANCE ITEMS (third-party costs — funeral home may add surcharge):
- Death certificate (state fee):  $10–$25 each
- Cemetery opening & closing:     $1,000–$2,500 (varies widely by cemetery)
- Obituary (newspaper):           $200–$1,500 (varies widely)
- Clergy / officiant honorarium:  $150–$300
- Police escort:                  $75–$200 per officer/vehicle

TOTAL SERVICE PACKAGES (national median):
- Full burial funeral:            $7,848  (NFDA 2023)
- Funeral with cremation:         $6,970  (NFDA 2023)
- Direct cremation:               $700–$2,500
- Direct burial:                  $2,000–$4,500

RED FLAG THRESHOLDS:
- Basic services fee > $3,000 → significantly above average
- Casket > $6,000 → likely inflated; explore alternatives
- Vault > $4,000 → significantly above average
- Embalming included and service is direct cremation → unnecessary upsell
- Cash advance total > 30% of total contract → investigate markups
- Total contract > $15,000 → warrants detailed line-by-line review

═══════════════════════════════════════════════════════════════
SERVICE CATEGORY CLASSIFICATION
═══════════════════════════════════════════════════════════════

Every funeral contract falls into exactly ONE of six service categories. Always identify
and state the correct category early in your analysis. Use this decision tree:

STEP 1 — Disposition type:
  → Look for CASKET, BURIAL VAULT, GRAVE/CEMETERY OPENING → BURIAL path
  → Look for CREMATION, CREMATORY, URN, INCINERATION → CREMATION path

STEP 2 — Visitation / Wake:
  → Look for: "Viewing", "Visitation", "Wake", "Use of facilities for viewing",
    "Body present visitation", any facility/staff charge for a multi-hour viewing event
  → If found: YES branch

STEP 3 — Service / Celebration of Life (if NO visitation):
  → Look for: "Funeral ceremony", "Memorial service", "Celebration of life",
    "Graveside service", "Use of facilities for ceremony", "Chapel service",
    "Religious service", any staffed formal service event
  → If found: YES branch

THE SIX CATEGORIES:

┌─ BURIAL PATH ──────────────────────────────────────────────┐
│  Visitation/Wake = YES  →  TRADITIONAL BURIAL SERVICE      │
│     Full service: visitation + funeral + burial            │
│     Benchmark total: $8,000–$14,000                        │
│                                                            │
│  Visitation = NO, Service = YES  →  GRAVESIDE SERVICE      │
│     No viewing; ceremony held at the graveside             │
│     Benchmark total: $4,500–$8,000                         │
│                                                            │
│  Visitation = NO, Service = NO  →  DIRECT BURIAL           │
│     Immediate burial, no ceremony, no viewing              │
│     Benchmark total: $2,000–$5,000                         │
└────────────────────────────────────────────────────────────┘

┌─ CREMATION PATH ───────────────────────────────────────────┐
│  Visitation/Wake = YES  →  TRADITIONAL CREMATION SERVICE   │
│     Full service with viewing before cremation             │
│     Benchmark total: $6,500–$12,000                        │
│                                                            │
│  Visitation = NO, Service = YES  →  CREMATION W/ MEMORIAL  │
│     Cremation first; memorial/celebration of life later    │
│     Benchmark total: $3,500–$7,000                         │
│                                                            │
│  Visitation = NO, Service = NO  →  DIRECT CREMATION        │
│     Immediate cremation, no service, no viewing            │
│     Benchmark total: $700–$3,000                           │
└────────────────────────────────────────────────────────────┘

CLASSIFICATION RULES:
- If the contract is ambiguous, state what the category APPEARS to be and what is missing
- Always flag if a family is being charged for a higher category than they selected
  (e.g., paying for Traditional Burial when they wanted Direct Burial)
- Always flag if embalming is charged on a Direct Cremation or Direct Burial — almost
  never appropriate and may indicate an upsell or error
- Always flag if "Use of facilities for viewing" appears on a direct service contract

Include the determined service category at the top of any full contract analysis, formatted as:
SERVICE CATEGORY: [category name]

═══════════════════════════════════════════════════════════════
MAJOR RED FLAGS TO IDENTIFY
═══════════════════════════════════════════════════════════════

CONTRACT TERM RED FLAGS:
- Non-transferable pre-need contract → family loses money if they move
- Non-guaranteed pricing → final bill can be far higher than contract amount
- No cancellation/refund clause → potential violation of state pre-need law
- Funds not held in state-approved trust or insurance → risk of loss if FH closes
- Irrevocable assignment on a pre-need contract → may affect Medicaid eligibility

PRICING RED FLAGS:
- Basic services fee above $3,000
- Embalming charged when not legally required and family did not request it
- Cash advance items with undisclosed surcharges (ask for receipts)
- Package pricing that makes it impossible to decline items
- "Required" vault or liner — this is cemetery policy, not law; shop independently

CORPORATE / COMBINATION RED FLAGS:
- Funeral home owned by SCI (Dignity Memorial), Lapuma, Park Lawn, JCFS, or similar chains
- Funeral home physically located on or adjacent to cemetery property
- Strong pressure to use only the affiliated cemetery's merchandise (vaults, markers)
- Casket prices dramatically higher than nearby independents
- "This is what our families do" language to normalize unnecessary services

LEGAL VIOLATIONS (potential FTC Funeral Rule violations):
- Failure to provide General Price List (GPL) on request
- Requiring embalming without disclosure or alternative
- Refusing to accept a casket purchased elsewhere
- Charging a "casket handling fee" for outside casket
- Misrepresenting what is legally required
- Not providing itemized price list for caskets and outer burial containers

═══════════════════════════════════════════════════════════════
MERCHANDISE GUIDANCE
═══════════════════════════════════════════════════════════════

CASKETS:
- Funeral home markup on caskets is typically 200–500% above wholesale cost
- Families have the legal right to purchase a casket from any source (Costco, Amazon,
  Trappist Caskets, etc.) and the funeral home MUST accept it at no extra charge
- Steel caskets corrode; "protective" or "sealer" caskets offer no preservation benefit
  and are often a significant upsell
- Solid wood caskets (mahogany, walnut, cherry) are beautiful but carry premium prices;
  poplar is similar aesthetically at much lower cost

VAULTS / OUTER BURIAL CONTAINERS:
- NOT required by law — required by most cemeteries as a maintenance policy
- Families can often purchase vaults from independent suppliers and save 30–60%
- "Protective" vault features (sealed, lined, etc.) offer no proven preservation benefit
- Concrete grave liners ($400–$800) meet most cemetery requirements at fraction of vault cost

URNS:
- Markup on urns is often 400–700% at funeral homes
- Identical or comparable urns available online for a fraction of the price
- Temporary containers (provided free) are sufficient until family chooses

═══════════════════════════════════════════════════════════════
BEHAVIOR GUIDELINES
═══════════════════════════════════════════════════════════════

TONE: Always be warm, compassionate, and non-alarmist. These families may be grieving.
Acknowledge the difficulty of the situation before diving into analysis. Be clear and
direct about findings, but never fear-mongering.

ANALYSIS: When contract data is provided, analyze every line item against the benchmarks
above. Flag anything significantly above average. Estimate potential savings when possible.

HONESTY: If pricing looks fair, say so. Never manufacture red flags. Build trust by being
accurate and balanced.

CALL RECOMMENDATION: At the end of your response, include a special JSON marker when you
believe a live advisor call would likely save the family money. Use EXACTLY this format:

[ADVISOR_CTA|confidence:high|savings:$1,500-$3,000|reason:Casket priced $2,800 above market average and contract is non-transferable — advisor can often negotiate or find alternatives]

Use this marker when ANY of the following are true:
1. Estimated potential savings exceed $750
2. You detect a red flag contract term (non-transferable, non-guaranteed pricing, no cancellation)
3. Total contract value exceeds $10,000 (warrants professional review)
4. You detect signs of a corporate chain or funeral home + cemetery combination
5. You find evidence of a potential FTC Funeral Rule violation
6. Multiple moderate issues add up to a significant concern

Do NOT include the marker for simple informational questions unrelated to a specific contract.

LEGAL NOTE: Always remind families that you provide information and education, not legal
advice. For legal matters, recommend their state funeral regulatory board and the FTC.
`;

// ============================================================
// AUTO-ANALYSIS PROMPT — fires immediately on upload/form submit
// ============================================================
const AUTO_ANALYSIS_PROMPT = `Please provide a complete initial analysis of this funeral contract. Structure your response clearly with these sections:

SERVICE CATEGORY — Identify which of the six service categories this is and confirm it matches what the family is paying for.

COST BREAKDOWN — List each major charge, its price, and compare it to the national benchmark. Flag anything significantly above or below average.

RED FLAGS — List any concerning charges, terms, or practices. Be specific about what the concern is and why it matters.

WHAT LOOKS FAIR — Note any pricing or terms that appear reasonable or better than average. If everything looks fine, say so.

ESTIMATED POTENTIAL SAVINGS — Based on your analysis, estimate how much this family might potentially save with negotiation or alternatives.

TOP RECOMMENDATIONS — Give 2-3 specific, actionable things this family should ask or do.

Be thorough but compassionate — remember this family may be grieving.`;

// ============================================================
// Build contract context string from form data
// ============================================================
function buildContractContext(data) {
  if (!data || Object.keys(data).length === 0) return "";

  const lines = ["═══ CONTRACT DATA ENTERED BY USER ═══"];

  if (data.funeralHome)         lines.push(`Funeral Home: ${data.funeralHome}`);
  if (data.contractType)        lines.push(`Contract Type: ${data.contractType}`);
  if (data._detectedCategory)   lines.push(`Detected Service Category: ${data._detectedCategory}`);
  else if (data.serviceType)    lines.push(`Service Type (user-selected): ${data.serviceType}`);
  if (data.deceasedName)   lines.push(`Deceased: ${data.deceasedName}`);
  if (data.cemetery)       lines.push(`Cemetery: ${data.cemetery}`);
  if (data.date)           lines.push(`Date: ${data.date}`);

  if (data.specialNotes)   lines.push(`Special Notes: ${data.specialNotes}`);

  // Professional services
  if (data.professionalServices?.length) {
    lines.push("\nPROFESSIONAL SERVICES:");
    data.professionalServices.forEach(r => {
      if (r.item) lines.push(`  - ${r.item}${r.notes ? ' (' + r.notes + ')' : ''}: ${r.price || 'no price'}`);
    });
  }

  // Merchandise
  if (data.merchandise?.length) {
    lines.push("\nMERCHANDISE:");
    data.merchandise.forEach(r => {
      if (r.item) lines.push(`  - ${r.item}${r.notes ? ' (' + r.notes + ')' : ''}: ${r.price || 'no price'}`);
    });
  }

  // Cash advance
  if (data.cashAdvance?.length) {
    lines.push("\nCASH ADVANCE ITEMS:");
    data.cashAdvance.forEach(r => {
      if (r.item) lines.push(`  - ${r.item}${r.notes ? ' (' + r.notes + ')' : ''}: ${r.price || 'no price'}`);
    });
  }

  // Financial summary
  lines.push("\nFINANCIAL SUMMARY:");
  if (data.subtotal)         lines.push(`  Subtotal: ${data.subtotal}`);
  if (data.salesTax)         lines.push(`  Sales Tax: ${data.salesTax}`);
  if (data.otherFees)        lines.push(`  Other Fees: ${data.otherFees}`);
  if (data.total)            lines.push(`  TOTAL: ${data.total}`);
  if (data.deposit)          lines.push(`  Deposit Paid: ${data.deposit}`);
  if (data.balance)          lines.push(`  Balance Due: ${data.balance}`);

  // Contract terms
  lines.push("\nCONTRACT TERMS:");
  if (data.paymentTerms)       lines.push(`  Payment: ${data.paymentTerms}`);
  if (data.cancellationPolicy) lines.push(`  Cancellation: ${data.cancellationPolicy}`);
  if (data.transferable)       lines.push(`  Transferable: ${data.transferable}`);
  if (data.priceGuarantee)     lines.push(`  Price Guarantee: ${data.priceGuarantee}`);

  lines.push("═══ END CONTRACT DATA ═══");
  return lines.join("\n");
}

// ============================================================
// Extract text from a base64-encoded PDF
// ============================================================
async function extractPdfText(base64Data) {
  try {
    const pdfParse = require("pdf-parse");
    const buffer   = Buffer.from(base64Data, "base64");
    const result   = await pdfParse(buffer);
    return result.text || "";
  } catch (err) {
    console.error("PDF parse error:", err.message);
    return null;
  }
}

// ============================================================
// Parse advisor CTA from AI response
// ============================================================
function parseAdvisorCTA(text) {
  const match = text.match(/\[ADVISOR_CTA\|confidence:(\w+)\|savings:([^\|]+)\|reason:([^\]]+)\]/);
  if (!match) return null;
  return {
    confidence: match[1],
    savings:    match[2],
    reason:     match[3],
  };
}

function stripCTAMarker(text) {
  return text.replace(/\[ADVISOR_CTA\|[^\]]+\]/g, "").trim();
}

// ============================================================
// Main Handler
// ============================================================
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { contractData, question, history = [], autoAnalyze = false } = req.body || {};

  // autoAnalyze mode doesn't require a user question
  if (!autoAnalyze && !question?.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured. Add it in Vercel → Settings → Environment Variables." });
  }

  const client      = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const fileType    = contractData?.fileType;   // "pdf" | "photo" | undefined
  const fileBase64  = contractData?.fileBase64; // base64 string from browser
  const mediaType   = contractData?.mediaType;  // e.g. "image/jpeg"

  // ── Which prompt to use ──────────────────────────────────
  const activeQuestion = autoAnalyze ? AUTO_ANALYSIS_PROMPT : question.trim();

  // ── Build system prompt ──────────────────────────────────
  const contractContext = buildContractContext(contractData);
  const fullSystem      = contractContext
    ? SYSTEM_PROMPT + "\n\n" + contractContext
    : SYSTEM_PROMPT;

  // ── Build message history ────────────────────────────────
  const recentHistory = history.slice(-20);

  // ── Build the user message content ──────────────────────
  // Four modes:
  //   1. Form data     → plain text question
  //   2. PDF + text    → extracted text prepended to question
  //   3. PDF + scanned → send PDF as document content block (Claude native PDF)
  //   4. Image/photo   → vision content block + text question

  let userContent;

  if (fileType === "photo" && fileBase64) {
    // Vision mode — send image + question together
    userContent = [
      {
        type: "image",
        source: {
          type:       "base64",
          media_type: mediaType || "image/jpeg",
          data:       fileBase64,
        },
      },
      {
        type: "text",
        text: `This is a photo of a funeral contract. Please analyze it carefully.\n\n${activeQuestion}`,
      },
    ];

  } else if (fileType === "pdf" && fileBase64) {
    // PDF mode — try text extraction first
    const pdfText = await extractPdfText(fileBase64);

    if (pdfText && pdfText.trim().length > 50) {
      // Machine-readable PDF — text extracted successfully
      userContent = `The following is the extracted text from an uploaded funeral contract PDF. Please analyze it carefully.\n\n--- CONTRACT TEXT START ---\n${pdfText.slice(0, 12000)}\n--- CONTRACT TEXT END ---\n\n${activeQuestion}`;

    } else {
      // Scanned / image-based PDF — send directly to Claude as a document
      // Claude natively reads PDFs including scanned ones via its vision capability
      console.log("PDF text extraction returned empty — sending as native document to Claude");
      userContent = [
        {
          type: "document",
          source: {
            type:       "base64",
            media_type: "application/pdf",
            data:       fileBase64,
          },
        },
        {
          type: "text",
          text: `This is a funeral contract PDF (may be scanned). Please read all pages carefully and analyze the contract.\n\n${activeQuestion}`,
        },
      ];
    }

  } else {
    // Form data mode — plain text question, context is in system prompt
    userContent = activeQuestion;
  }

  const messages = [
    ...recentHistory,
    { role: "user", content: userContent },
  ];

  try {
    const response = await client.messages.create({
      model:      "claude-opus-4-5-20251101",
      max_tokens: 2000,
      system:     fullSystem,
      messages,
    });

    const rawText    = response.content[0].text;
    const advisorCTA = parseAdvisorCTA(rawText);
    const cleanText  = stripCTAMarker(rawText);

    return res.status(200).json({
      answer:     cleanText,
      advisorCTA,
      newMessage: { role: "assistant", content: rawText },
    });

  } catch (err) {
    console.error("Claude API error:", err);
    return res.status(500).json({
      error:   "AI service error",
      details: err.message,
    });
  }
};

// Raise Vercel body size limit to 10MB to handle base64-encoded PDFs and images
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
