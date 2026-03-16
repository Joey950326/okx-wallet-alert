import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      const WebpackObfuscator = require("webpack-obfuscator");
      config.plugins.push(
        new WebpackObfuscator(
          {
            compact: true,
            controlFlowFlattening: false,
            deadCodeInjection: false,
            stringArray: true,
            stringArrayEncoding: [],
            splitStrings: false,
            simplify: true,
            selfDefending: false,
            disableConsoleOutput: false,
            transformObjectKeys: false,
          },
          [
            "**/webpack-*.js",
            "**/framework-*.js",
            "**/main-*.js",
            "**/polyfills-*.js",
          ]
        )
      );
    }

    return config;
  },
};

export default nextConfig;
