# Ardent Advisors AI – Vendor Statement Reconciliation Dashboard
**Product Requirements Document (PRD)**  
**Version 1.0** | April 22, 2026  
**Prepared for:** Nathan Glass – Lampasas Marketing / Augenix.ai  
**Project Goal:** Build a high-conviction demo in ≤6 hours that turns painful manual Nexsyis vendor statement reconciliation into an AI-assisted, fully auditable review process for collision shop Office Managers.

## 1. Executive Summary (Ultra-Corporate Positioning)

This demo replicates the exact Nexsyis Collision vendor statement reconciliation workflow while replacing manual effort with AI-driven automation and complete human-in-the-loop oversight.

The Office Manager no longer performs reconciliation — she **reviews, audits, and approves** work already completed by AI. Every decision is logged with timestamp, confidence score, reasoning, and oddity flags. Three parallel LLM runs ensure consensus-level accuracy with built-in error handling and retries.

**Success Metric for Sales Calls (<15 minutes):**  
The Office Manager can run a full mock reconciliation, see discrepancies flagged, review/resolve them, approve the batch, and export a clean audit report — leading to the reaction: “Holy shit, this saves me hours every month.”

This demo becomes the foundation of your long-term authority marketing and sales engine for Ardent Advisors AI — teaching clearly how AI automation delivers time savings, accuracy, and better decisions for $1M+ revenue collision (and other) businesses.

## 2. Business Objectives (5-Year Horizon)

- **Short-term (next 30 days):** Ship a polished, enterprise-looking demo you can present to collision shop owners and office managers.
- **Medium-term (6–18 months):** Convert the demo codebase into production integrations with real Nexsyis API + direct SQL access.
- **Long-term (5 years):** Build a scalable AI automation platform (recurring revenue $2k–$5k+/month per client) that runs profitably at 4–6 hours/day of your time while hitting $20k+/month profit. Leverage your strength in teaching and explaining technology to attract inbound clients.

**Ideal Client Profile:**  
US-based businesses (preferably South or Central US) with $1M+ annual revenue, 5+ employees. Strong network in collision shops, attorneys, engineering firms, and plumbing — open to others.

## 3. User & Role

- **Primary User:** Office Manager (detail-oriented, currently performs this process manually).
- **Tone & Branding:** Ultra-corporate, professional, clean, authoritative, zero fluff.
- **Dashboard Name:** Ardent Advisors AI
- **Logo:** Use the client’s official Ardent Advisors logo in the header (placeholder in code).
- **Colors:** Follow client’s corporate palette (navy/blue dominant with professional accents).

## 4. Scope – 6-Hour Build

**Must-Have Screens:**
1. Login (Supabase Auth)
2. Dashboard Home (quick stats + “Start New Reconciliation” CTA)
3. Select Vendor / Period
4. Reconciliation Run Page (progress + AI processing)
5. Results / Audit Review Page (core screen with table, audit panel, flags)
6. Report Export (PDF/CSV with full audit log)

**Out of Scope for this build (skip):**
- Multi-vendor batch run
- Document upload / OCR simulation
- “Un-Finalize” flow

## 5. Demo Data (Realistic $10M Collision Shop)

- Scale: ~$700k monthly AP volume, 150–300 invoices/month across 6 locations.
- 5 Vendors: Parts Supplier A, Paint Vendor B, Tool Vendor C, Glass & Mirror D, Equipment Lease E.
- Built-in discrepancies (one strong example per vendor + one clean match):
  - $247 amount mismatch (possible tax/core return)
  - Missing credit ($1,850)
  - Duplicate invoice
  - Wrong LK assignment
- All data stored in Supabase tables with prefix `aa_demo_`.

## 6. AI Intelligence Layer

- **Approach:** Full LLM-powered (via Vercel AI SDK + AI Gateway).
- **Consensus Method:** 3 parallel runs (different temperatures/seeds) → majority vote + average confidence.
- **Features:**
  - Automatic retry on failure.
  - Clear warnings/errors for low consensus (<85%).
  - “Re-Run AI” button on individual lines.
- **Output:** Matched pairs, flags, plain-English explanations, confidence scores.

## 7. Audit & Review Features (Human-in-the-Loop)

- Detailed per-item audit log showing:
  - Timestamp
  - AI decision & confidence %
  - Full reasoning
  - Oddity flag (with explanation)
  - Human override note field
- Global warnings