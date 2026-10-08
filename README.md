# KARVO

KARVO is a Next.js customer booking application for NEOCRAFT LLP.

## Local development

Install dependencies with `npm install`, then run `npm run dev`.

## Database

Create a PostgreSQL database and execute `database.sql`. Set `DATABASE_URL` in your deployment environment; see `.env.example` for the required format. The booking API rejects malformed requests and stores valid requests in the `bookings` table.

## Production status

The customer booking flow is implemented. Payment collection and authenticated administration are not enabled yet because a payment provider and production admin identity have not been selected. Do not collect the ₹299 fee until server-side orders and signed payment webhooks are implemented.
