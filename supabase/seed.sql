-- =============================================
-- aa_demo_seed.sql
-- Ardent Advisors AI Reconciliation Demo Seed Data
-- For Supabase project: augenix.ai
-- All tables use prefix "aa_demo_" for clean isolation
-- Realistic data for a ~$10M annual revenue collision shop
-- Monthly AP volume: ~$700k across 6 locations
-- Built-in discrepancies for strong demo impact:
--   - $247 amount mismatch
--   - Missing $1,850 credit
--   - Duplicate invoice
--   - Wrong LK assignment
--   - One clean 100% match
-- =============================================

-- 1. Clear existing demo data (safe to run multiple times)
TRUNCATE TABLE aa_demo_audit_logs, 
               aa_demo_reconciliation_matches, 
               aa_demo_reconciliation_batches, 
               aa_demo_statements, 
               aa_demo_invoices, 
               aa_demo_vendors 
RESTART IDENTITY;

-- 2. Vendors (5 realistic vendors)
INSERT INTO aa_demo_vendors (vendor_name, location_keys) VALUES
('Parts Supplier A', ARRAY['LK-001', 'LK-002']),
('Paint Vendor B', ARRAY['LK-003']),
('Tool Vendor C', ARRAY['LK-001']),
('Glass & Mirror D', ARRAY['LK-004', 'LK-005']),
('Equipment Lease E', ARRAY['LK-006'])
ON CONFLICT DO NOTHING;

-- 3. System Invoices (~220 total volume simulated via patterns; core discrepancies included)
-- Parts Supplier A (high volume + $247 mismatch)
INSERT INTO aa_demo_invoices (vendor_id, invoice_number, lk_code, amount, invoice_date, status) VALUES
(1, 'PSA-2026-0415', 'LK-001', 1247.50, '2026-04-15', 'unpaid'),
(1, 'PSA-2026-0418', 'LK-001', 875.00, '2026-04-18', 'unpaid'),
(1, 'PSA-2026-0420', 'LK-001', 3247.00, '2026-04-20', 'unpaid'),  -- Will mismatch by $247 on statement
(1, 'PSA-2026-0422', 'LK-001', 1590.25, '2026-04-22', 'unpaid'),
(1, 'PSA-2026-0425', 'LK-002', 2890.00, '2026-04-25', 'unpaid');

-- Paint Vendor B (missing credit of $1,850)
INSERT INTO aa_demo_invoices (vendor_id, invoice_number, lk_code, amount, invoice_date, status) VALUES
(2, 'PVB-2026-0405', 'LK-003', 4520.00, '2026-04-05', 'unpaid'),
(2, 'PVB-2026-0412', 'LK-003', 3180.75, '2026-04-12', 'unpaid'),
(2, 'PVB-2026-0419', 'LK-003', 6750.00, '2026-04-19', 'unpaid');

-- Tool Vendor C (duplicate invoice)
INSERT INTO aa_demo_invoices (vendor_id, invoice_number, lk_code, amount, invoice_date, status) VALUES
(3, 'TVC-2026-0410', 'LK-001', 895.00, '2026-04-10', 'unpaid'),
(3, 'TVC-2026-0410', 'LK-001', 895.00, '2026-04-15', 'unpaid'),  -- Duplicate
(3, 'TVC-2026-0421', 'LK-001', 1240.50, '2026-04-21', 'unpaid');

-- Glass & Mirror D (wrong LK assignment)
INSERT INTO aa_demo_invoices (vendor_id, invoice_number, lk_code, amount, invoice_date, status) VALUES
(4, 'GMD-2026-0408', 'LK-004', 2150.00, '2026-04-08', 'unpaid'),
(4, 'GMD-2026-0416', 'LK-004', 1875.00, '2026-04-16', 'unpaid'),
(4, 'GMD-2026-0423', 'LK-005', 980.00, '2026-04-23', 'unpaid');  -- Should be LK-004

-- Equipment Lease E (clean 100% match)
INSERT INTO aa_demo_invoices (vendor_id, invoice_number, lk_code, amount, invoice_date, status) VALUES
(5, 'ELE-2026-0401', 'LK-006', 2850.00, '2026-04-01', 'unpaid'),
(5, 'ELE-2026-0415', 'LK-006', 2850.00, '2026-04-15', 'unpaid');

-- Optional: Add more volume to reach ~200+ invoices (repeat pattern 8-10x if desired for fuller table)
-- For 6-hour build, the above is sufficient for a compelling demo.

-- 4. Mock Vendor Statements (one per vendor with discrepancy notes in text for AI)
INSERT INTO aa_demo_statements (vendor_id, statement_period_start, statement_period_end, total_amount, statement_text) VALUES
(1, '2026-04-01', '2026-04-30', 12494.75, E'Statement for Parts Supplier A\nPeriod: Apr 2026\nTotal Due: 12,494.75\n\nInvoices:\n  PSA-2026-0415    1,247.50\n  PSA-2026-0418      875.00\n  PSA-2026-0420    2,999.75    (note tax adjustment)\n  PSA-2026-0422    1,590.25\n  PSA-2026-0425    2,890.00'),
(2, '2026-04-01', '2026-04-30', 14450.75, E'Statement for Paint Vendor B\nPeriod: Apr 2026\nTotal Due: 14,450.75\n\nInvoices:\n  PVB-2026-0405    4,520.00\n  PVB-2026-0412    3,180.75\n  PVB-2026-0419    6,750.00\n\nCredits:\n  Credit applied  -1,850.00    (return)'),
(3, '2026-04-01', '2026-04-30', 3030.50, E'Statement for Tool Vendor C\nPeriod: Apr 2026\nTotal Due: 3,030.50\n\nInvoices:\n  TVC-2026-0410      895.00    (listed once)\n  TVC-2026-0421    1,240.50'),
(4, '2026-04-01', '2026-04-30', 5005.00, E'Statement for Glass & Mirror D\nPeriod: Apr 2026\nTotal Due: 5,005.00\n\nInvoices:\n  GMD-2026-0408    2,150.00\n  GMD-2026-0416    1,875.00\n  GMD-2026-0423      980.00    (should be under LK-004)'),
(5, '2026-04-01', '2026-04-30', 5700.00, E'Statement for Equipment Lease E\nPeriod: Apr 2026\nTotal Due: 5,700.00\n\nInvoices:\n  ELE-2026-0401    2,850.00\n  ELE-2026-0415    2,850.00\n\nPerfect match.');

-- 5. Create one pending reconciliation batch for immediate testing
INSERT INTO aa_demo_reconciliation_batches (vendor_id, period_start, period_end, status)
SELECT id, '2026-04-01', '2026-04-30', 'pending' 
FROM aa_demo_vendors;

-- =============================================
-- Verification Queries (run these after seeding)
-- SELECT * FROM aa_demo_vendors;
-- SELECT COUNT(*) FROM aa_demo_invoices;
-- SELECT * FROM aa_demo_statements;
-- SELECT * FROM aa_demo_reconciliation_batches;
-- =============================================

COMMENT ON TABLE aa_demo_vendors IS 'Ardent Advisors AI Demo - Vendors for $10M collision shop';
COMMENT ON TABLE aa_demo_invoices IS 'Ardent Advisors AI Demo - System invoices from Nexsyis';
COMMENT ON TABLE aa_demo_statements IS 'Ardent Advisors AI Demo - Mock vendor statements with discrepancies';