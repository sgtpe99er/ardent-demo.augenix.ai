# Ardent Advisors AI - User Prompt Template

Reconcile the following vendor statement against the system invoices.

Vendor: {{vendor_name}}
Statement Period: {{period_start}} to {{period_end}}
Statement Total: ${{statement_total}}

System Invoices (JSON array):
{{system_invoices_json}}

Vendor Statement Raw Text:
{{statement_text}}

Perform reconciliation using the strict rules provided in the system prompt.
Run 3 independent analyses internally and return the most accurate consensus result.

Return ONLY valid JSON matching the exact schema in the system prompt. No other text.