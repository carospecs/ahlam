module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@ahlam/shared": "../packages/shared/src",
            "@": "./src",
          },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],
    ],
  };
};
