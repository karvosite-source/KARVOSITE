# KARVO project guidance for Codex

## Project
KARVO is a service marketplace website operated by NEOCRAFT LLP. The current repo contains a static customer frontend and a separate admin prototype.

## Important limitations
- Customer and admin pages are independent browser demos and are **not** connected to a real shared database.
- The ₹299 site visit payment is a UI/demo workflow, not a payment gateway integration.
- Do not mark payments as paid without secure backend confirmation from the payment provider.
- Do not claim a working live website, authentication, or payment collection until deployed and tested.
- Company office address and finalized legal policies need business confirmation.

## Structure
- `customer/index.html` main customer frontend (large single-file HTML with embedded AI concept images)
- `customer/{about,contact,terms,privacy,refund}.html` static pages
- `admin/index.html` admin prototype

## Development priorities
1. Refactor HTML into maintainable components/assets, preserving visuals and behavior.
2. Create secure authentication and an authorized admin role.
3. Implement a shared database and enquiry/booking lifecycle.
4. Create server-side ₹299 payment orders and securely verify webhook signatures / payment status.
5. Test end-to-end customer-to-admin flow before production deployment.
6. Keep PII and payment credentials out of source control; use environment secrets.
