import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const extensionCtx = await esbuild.context({
  entryPoints: ["src/extension/main.ts"],
  bundle: true,
  outfile: "out/extension.cjs",
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
  target: "node18",
  alias: { elkjs: "elkjs/lib/elk.bundled.js" },
  logLevel: "info",
});

const webviewCtx = await esbuild.context({
  entryPoints: ["webview/src/main.tsx"],
  bundle: true,
  outfile: "out/webview/main.js",
  platform: "browser",
  format: "iife",
  sourcemap: true,
  jsx: "automatic",
  loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

if (watch) {
  await extensionCtx.watch();
  await webviewCtx.watch();
  console.log("Watching extension + webview…");
} else {
  await extensionCtx.rebuild();
  await webviewCtx.rebuild();
  await extensionCtx.dispose();
  await webviewCtx.dispose();
}
