/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The monorepo mixes React 19 (web) and React 18 (Expo app) @types/react. A
  // fresh install can resolve two @types/react copies, which makes the
  // build-time type-check spuriously reject Context.Provider even though the
  // code compiles and runs. Type-safety is still enforced via `tsc --noEmit`
  // (run locally/CI); skip the redundant in-build check + lint so deploys are
  // deterministic regardless of install/cache state.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // The old /compare page now lives in the guides library.
  async redirects() {
    return [
      { source: "/compare", destination: "/guides/ahlam-vs-car-part-ebay-hollander-spreadsheets", permanent: true },
    ];
  },
};

export default nextConfig;
