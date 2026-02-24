/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  // Expose campaign env vars to the client bundle at build time.
  // These must also be set in Railway Variables for each deployment.
  env: {
    NEXT_PUBLIC_CAMPAIGN_NAME: process.env.NEXT_PUBLIC_CAMPAIGN_NAME,
    NEXT_PUBLIC_CANDIDATE_NAME: process.env.NEXT_PUBLIC_CANDIDATE_NAME,
    NEXT_PUBLIC_CAMPAIGN_STATE: process.env.NEXT_PUBLIC_CAMPAIGN_STATE,
    NEXT_PUBLIC_ORGANIZATION_NAME: process.env.NEXT_PUBLIC_ORGANIZATION_NAME,
    NEXT_PUBLIC_CAMPAIGN_ID: process.env.CAMPAIGN_ID,
  },
}

module.exports = nextConfig
