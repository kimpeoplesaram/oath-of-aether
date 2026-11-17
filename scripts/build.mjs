import * as esbuild from "esbuild";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
copyFileSync("public/index.html", "dist/index.html");
if (existsSync("public/style.css")) {
  copyFileSync("public/style.css", "dist/style.css");
}

const options = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: "dist/bundle.js",
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  sourcemap: true,
  target: ["chrome100", "edge100"],
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(options);
  console.log("Build complete.");
}
