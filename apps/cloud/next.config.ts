import type { NextConfig } from 'next';
import { DEFAULT_PRO_CHECKOUT_URL } from './lib/pro-checkout-url';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_PRO_CHECKOUT_URL:
      process.env.NEXT_PUBLIC_PRO_CHECKOUT_URL ?? DEFAULT_PRO_CHECKOUT_URL,
  },
};

export default nextConfig;
