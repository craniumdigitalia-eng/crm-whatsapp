/** @type {import('next').NextConfig} */
const nextConfig = {
  // Story 5.4: /api/leads/* migrados para Next Route Handlers em app/api/leads/.
  // api/webhook.ts, api/cron/followup.ts e api/health.ts permanecem como Vercel Functions
  // e são servidas pelo Vercel runtime em produção (vercel.json).
}

module.exports = nextConfig
