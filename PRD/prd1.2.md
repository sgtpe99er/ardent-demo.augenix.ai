# Ardent Advisors AI – New Features PRD
**Addendum to Version 1.2** | April 22, 2026  
**Prepared for:** Nathan Glass – Augenix.ai  
**Purpose:** This document contains **only** the new features to be built immediately.

## 1. Objective

Expand the existing Ardent Advisors AI Reconciliation Demo with the following new capabilities while keeping the build focused, corporate, and aligned with long-term scalability and low operating cost.

## 2. New Must-Have Features (Build Now)

### 1. Multi-Vendor / Batch Processing
- Allow the Office Manager to select multiple vendors (or "Select All") for the same statement period.
- Single “Run Batch Reconciliation” button that processes all selected vendors in one operation.
- Results page displays a summary table for the entire batch with drill-down into individual vendor results.

### 2. Document Upload + OCR Simulation (UI Placeholder Only)
- Dedicated upload area on the Results or Select screen with drag-and-drop zone.
- “Simulate OCR” button that shows a realistic mock extraction preview (pre-defined text appears).
- No actual file processing or real OCR logic required — purely visual placeholder for future real integration.

### 3. Un-Finalize & Edit History Flow (Fully Workable)
- “Un-Finalize Batch” button on the Results page that changes batch status from “completed” back to “needs_review”.
- Simple edit history panel that shows previous AI runs, consensus results, and all human overrides with timestamps.
- After un-finalizing, the batch becomes editable again and can be re-run.

### 4. “Re-Run All” Button
- Prominent “Re-Run All” button on the Results page.
- Re-triggers the full 3-parallel LLM runs + consensus for the entire batch (or for selected lines only).
- Updates the audit log with the new run details.

### 5. Progress Bar with Detailed Step-by-Step AI Run Visibility
- Real-time animated progress bar during reconciliation.
- Clearly labeled steps that match the prompt files:
  - Initial Reconciliation 1 (using system-prompt.md + user-prompt-template.md)
  - Initial Reconciliation 2 (using system-prompt.md + user-prompt-template.md)
  - Initial Reconciliation 3 (using system-prompt.md + user-prompt-template.md)
  - Consensus / Final Audit (using consensus-prompt.md)
- Each step shows live status: Pending → Running → Completed → Failed (with error message if applicable).

## 3. New Screen: Future / Advanced Features Page (Static Only)

Create a clean, static page titled **“Future Roadmap”** (linked from Dashboard Home with a prominent button “See What’s Coming”).

This page lists the following advanced features with short, professional descriptions (do **not** implement any functionality):

- **Bank Feed / Payment Matching**  
  Automatically match cleared bank transactions to reconciled invoices for complete end-to-end AP automation.

- **Intelligent Retry Logic**  
  Automatic retries with exponential backoff and clear, plain-English error explanations when an AI run fails.

- **Notifications via Email / Slack**  
  Real-time alerts sent to the Office Manager when high-oddity items require review or when a batch successfully completes.

- **Analytics Dashboard**  
  Visual metrics showing time saved, error-rate trends, ROI calculator, and monthly summary reports that prove the value of Ardent Advisors AI to business owners.
