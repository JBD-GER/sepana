import type { NextConfig } from "next";

const noIndexHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
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
  async redirects() {
    return [
      {
        source: "/sofortvergleich/strom",
        destination:
          "https://a.check24.net/misc/click.php?pid=1164717&aid=18&deep=stromanbieter-wechseln&cat=1",
        permanent: false,
      },
      {
        source: "/sofortvergleich/internet",
        destination:
          "https://a.check24.net/misc/click.php?pid=1164717&aid=18&deep=dsl-anbieterwechsel&cat=4",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
