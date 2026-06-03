import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://kreativekorna.com",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://kreativekorna.com https://www.kreativekorna.com",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
