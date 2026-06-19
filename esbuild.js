const esbuild = require("esbuild");
const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};

/**
 * Copy webview-ui/dist into dist/ so assets are available at runtime.
 */
function copyWebviewAssets() {
  const src = path.resolve(__dirname, "webview-ui", "dist");
  const dest = path.resolve(__dirname, "dist");

  if (!fs.existsSync(src)) {
    console.warn("[watch] webview-ui/dist not found — run `npm run build:webview` first");
    return;
  }

  // Recursive copy
  const copy = (source, target) => {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      for (const file of fs.readdirSync(source)) {
        copy(path.join(source, file), path.join(target, file));
      }
    } else {
      fs.copyFileSync(source, target);
    }
  };

  copy(src, dest);
  console.log("[watch] webview assets copied to dist/");
}

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    minify: production,
    sourcemap: !production,
    outdir: "dist",
    external: ["vscode"],
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
    // Copy assets on watch start
    copyWebviewAssets();

    // Watch webview-ui/dist and copy on changes
    const webviewDist = path.resolve(__dirname, "webview-ui", "dist");
    if (fs.existsSync(webviewDist)) {
      chokidar.watch(webviewDist, { ignored: /^\./, persistent: true }).on(
        "all",
        (event) => {
          console.log(`[watch] webview change: ${event}`);
          copyWebviewAssets();
        }
      );
    }
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    // Copy assets after build
    copyWebviewAssets();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
