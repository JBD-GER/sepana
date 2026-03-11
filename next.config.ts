import type { NextConfig } from "next";

const noIndexHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "30mb",
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
      {
        pathname: "/api/baufi/logo",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/impressum",
        headers: noIndexHeaders,
      },
      {
        source: "/datenschutz",
        headers: noIndexHeaders,
      },
    ];
  },
};

export default nextConfig;
