# KARVO by NEOCRAFT LLP — Website & Admin demo

## Folder structure
- `customer/index.html` — latest customer marketplace with ₹299 site-visit-fee UI and embedded AI images
- `customer/about.html`, `contact.html`, `terms.html`, `privacy.html`, `refund.html` — newly added company and legal-information pages
- `admin/index.html` — admin dashboard prototype with payment status fields

## Important before publishing
1. Insert NEOCRAFT LLP verified legal name, registered office address, LLPIN and GSTIN (if applicable), registered company address and any additional official support/privacy email as needed.
2. Obtain legal review and approve the draft Terms, Privacy Policy, and Refund/Cancellation Policy. Determine final cancellation deadlines and refund time frames.
3. Configure hosting and server-side authenticated customer/admin API plus central database. These HTML files do not sync between browsers or process real ₹299 payments.
4. Add a verified payment-gateway integration with signed server-side webhook/payment verification before confirming visits.
5. Do not confuse AI-generated design illustrations with photographs of completed work.

Open `customer/index.html` locally and follow footer links to the new pages. Open `admin/index.html` separately.

## Confirmed customer support contacts
- Phone/WhatsApp: +91 91666 91274
- Email: karvosite@gmail.com

## WhatsApp booking notifications
Product orders and service quote bookings call `POST /api/whatsapp-order` after the customer places an order. The endpoint sends a booking summary to the KARVO WhatsApp number when the WhatsApp credentials are configured in Vercel.

### Meta WhatsApp Cloud API
Set these Vercel environment variables:

```sh
vercel env add WHATSAPP_TOKEN production
vercel env add WHATSAPP_PHONE_NUMBER_ID production
vercel env add WHATSAPP_TO production
vercel env add WHATSAPP_GRAPH_VERSION production
```

`WHATSAPP_TO` is optional and defaults to the current KARVO support WhatsApp number `919166691274`. `WHATSAPP_GRAPH_VERSION` is optional; the endpoint defaults to `v25.0`.

### Custom WhatsApp provider API
If KARVO uses another WhatsApp provider, set:

```sh
vercel env add WHATSAPP_API_URL production
vercel env add WHATSAPP_API_KEY production
vercel env add WHATSAPP_TO production
```

The custom API receives JSON:

```json
{
  "to": "919166691274",
  "message": "New KARVO booking summary...",
  "order": {}
}
```

After changing environment variables, redeploy the site.
