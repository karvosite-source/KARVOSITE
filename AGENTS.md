# KARVO project guidance

KARVO is a Next.js application. Preserve all credentials in deployment environment variables; never commit `.env` files.

Run `npm run lint` and `npm run build` after application changes. Customer booking data uses PostgreSQL through `DATABASE_URL`; apply `database.sql` before testing a real booking submission.

Do not treat payment as active until a provider is selected and server-side order creation plus webhook verification are implemented. Do not expose booking data through an unauthenticated admin route.
