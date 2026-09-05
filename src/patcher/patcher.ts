import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "url";
import asar from "asar";
import _7z from "7zip-min";
import { $ } from "bun";

import { downloadBuild } from "./api";
import { prettifyDirectory } from "./prettier";
import type { AppBuild } from "~/types/AppBuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __projectRoot = path.resolve(__dirname, "..", "..");

export async function processBuild(build: AppBuild) {
  const buildDir = path.resolve(path.join(__projectRoot, ".versions", build.version));
  const tempDir = path.join(buildDir, "temp");
  const buildBinaryPath = path.join(tempDir, "build.bin");
  const extractDir = path.join(tempDir, "extracted");
  const buildSourceDir = path.join(buildDir, "src");
  const buildModdedDir = path.join(buildDir, "mod");
  const modSorcesDir = path.join(__projectRoot, "src/mod");
  const modCompiledDir = path.join(__projectRoot, "src/mod/dist");
  const progressArray: string[] = [];

  const logProgress = (message: string) => {
    progressArray.push(message);
    console.log(progressArray.at(-1));
  };

  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });
  fs.mkdirSync(buildSourceDir, { recursive: true });
  fs.mkdirSync(buildModdedDir, { recursive: true });

  logProgress(`[1] Downloading build ${build.version}`);

  const downloadResult = await downloadBuild(build, buildBinaryPath);

  if (downloadResult.isErr()) {
    logProgress(`❌ Failed to download build ${build.version}: ${downloadResult.error}`);
    return;
  } else {
    logProgress(`✔️   Done`);
  }

  logProgress(`[2] Extracting build ${build.version} to ${extractDir}`);

  try {
    await _7z.unpack(buildBinaryPath, extractDir);
    logProgress(`✔️   Done`);
  } catch (error) {
    logProgress(`❌ Failed to extract build ${build.version}: ${error}`);
    return;
  }

  logProgress(`[3] Find and extract app.asar`);

  const appAsarPath = path.resolve(path.join(extractDir, "resources", "app.asar"));
  const appIconPath = path.resolve(path.join(extractDir, "resources", "assets", "icon.ico"));

  if (fs.existsSync(appAsarPath)) {
    logProgress(`✔️   Found app.asar`);
  } else {
    logProgress(`❌ app.asar was not found inside the extracted installer for ${build.version}`);
    return;
  }

  if (fs.existsSync(appIconPath)) {
    logProgress(`✔️   Found app icon`);
    fs.copyFileSync(appIconPath, path.join(buildDir, "icon.ico"));
  } else {
    logProgress(`❌ app icon was not found inside the extracted installer for ${build.version}`);
    return;
  }

  try {
    asar.extractAll(appAsarPath, buildSourceDir);
    logProgress(`✔️   Extracted app.asar`);
  } catch (error) {
    logProgress(`❌ Failed to extract app.asar: ${error}`);
    return;
  }

  try {
    fs.mkdirSync(path.join(buildDir, "src", "assets"), { recursive: true });
    fs.copyFileSync(appIconPath, path.join(buildDir, "src", "assets", "icon.ico"));
    const pulsePng = path.join(__projectRoot, "branding", "pulse-icon.png");
    const pulseIco = path.join(__projectRoot, "branding", "pulse-icon.ico");
    if (fs.existsSync(pulsePng)) {
      fs.copyFileSync(pulsePng, path.join(buildDir, "src", "assets", "icon.png"));
    } else if (fs.existsSync(path.join(__projectRoot, "yaicon.png"))) {
      fs.copyFileSync(path.join(__projectRoot, "yaicon.png"), path.join(buildDir, "src", "assets", "icon.png"));
    }
    if (fs.existsSync(pulseIco)) {
      fs.copyFileSync(pulseIco, path.join(buildDir, "src", "assets", "icon.ico"));
      fs.copyFileSync(pulseIco, path.join(buildDir, "icon.ico"));
    }
    logProgress(`✔️   Extracted app icons`);
  } catch (error) {
    logProgress(`❌ Failed to copy app icons: ${error}`);
    return;
  }

  logProgress(`[4] Cleaning up temporary files`);

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    logProgress(`✔️   Done`);
  } catch (error) {
    logProgress(`❌ Failed to clean up temporary files: ${error}`);
    return;
  }

  logProgress(`[5] Copy sources before modding`);

  try {
    fs.cpSync(buildSourceDir, buildModdedDir, { recursive: true });
    logProgress(`✔️   Done`);
  } catch (error) {
    logProgress(`❌ Failed to copy sources before modding: ${error}`);
    return;
  }

  logProgress(`[6] Patching app.asar`);

  // Key files for patching
  const staticFiles = {
    packageJson: path.join(buildModdedDir, "package.json"),
    indexJs: path.join(buildModdedDir, "index.js"),
    preloadJs: path.join(buildModdedDir, "preload.js"),
  };

  logProgress(`🛠️  Locate static files [${Object.keys(staticFiles).join(", ")}]`);

  for (const file of Object.keys(staticFiles) as (keyof typeof staticFiles)[]) {
    if (fs.existsSync(staticFiles[file])) {
      logProgress(`✔️   Found ${file}`);
    } else {
      logProgress(`❌ ${file} was not found inside the sources for ${build.version}`);
      return;
    }
  }

  logProgress(`🛠️  Patch package.json`);

  let packageJsonContents = JSON.parse(fs.readFileSync(staticFiles.packageJson, "utf8"));

  packageJsonContents.dependencies = packageJsonContents.dependencies || {};
  packageJsonContents.devDependencies = packageJsonContents.devDependencies || {};

  const bannedDependencies = [
    "@yandex-chats/signer",
    // Private Yandex packages not published to the public npm registry —
    // they 404 during `bun install` in the modded build, so strip them out.
    "@yandex-music-int/electron-certificate-verification",
  ];
  packageJsonContents.dependencies = Object.fromEntries(
    Object.entries(packageJsonContents.dependencies).filter(([key]) => !bannedDependencies.includes(key)),
  );
  packageJsonContents.devDependencies = Object.fromEntries(
    Object.entries(packageJsonContents.devDependencies).filter(([key]) => !bannedDependencies.includes(key)),
  );
  packageJsonContents.name = "pulse";
  packageJsonContents.version = "3.1.2";
  packageJsonContents.description = "PULSE V3 — кастомный мод Яндекс Музыки";
  packageJsonContents.author = "Slesari690 [github.com/Slesari690]";
  packageJsonContents.build = {
    appId: "com.slesari690.pulse",
    productName: "PULSE",
    artifactName: "PULSE-V3-Setup-${version}.${ext}",
    nsis: {
      shortcutName: "PULSE",
      uninstallDisplayName: "PULSE V3",
    },
    win: {
      icon: "assets/icon.ico",
      requestedExecutionLevel: "requireAdministrator",
    },
    mac: {
      icon: "assets/icon.ico",
    },
    linux: {
      icon: "assets/icon.png",
    },
    extraResources: [
      {
        from: "assets/",
        to: "assets/",
        filter: ["**/*"],
      },
    ],
    files: ["**/*", "!dist/**", "!dist-pulse/**"],
  };

  logProgress(`🛠️  Merge dependencies`);

  const rootPackageJsonContents = JSON.parse(fs.readFileSync(path.join(__projectRoot, "package.json"), "utf8"));

  if (!packageJsonContents.dependencies) packageJsonContents.dependencies = {};
  for (const key of Object.keys(rootPackageJsonContents.dependencies)) {
    packageJsonContents.dependencies[key] = rootPackageJsonContents.dependencies[key];
  }

  if (!packageJsonContents.devDependencies) packageJsonContents.devDependencies = {};
  for (const key of Object.keys(rootPackageJsonContents.devDependencies)) {
    packageJsonContents.devDependencies[key] = rootPackageJsonContents.devDependencies[key];
  }

  fs.writeFileSync(staticFiles.packageJson, JSON.stringify(packageJsonContents, null, 2));

  logProgress(`✔️   Done`);

  logProgress(`🛠️  Apply patches to index.js`);

  let indexJsContents = fs.readFileSync(staticFiles.indexJs, "utf8");

  // Stub out require() calls for private Yandex packages that are not
  // available on the public npm registry. We already strip them from
  // package.json (bannedDependencies) so `bun install` doesn't fail, but
  // the original index.js still calls `require(...)` on them at runtime —
  // which crashes the app with "Cannot find module". Replace those
  // require() calls with no-op stubs shaped to match how the module is used.
  const bannedRequireStubs: Record<string, string> = {
    "@yandex-chats/signer": "({})",
    // Used as `electronCertificateVerification.setupCertificateVerificationCoordinator({...})`,
    // and the returned handle is called as `coordinatorHandle.refreshCertificateTransparencyLogList()`.
    "@yandex-music-int/electron-certificate-verification":
      "({ setupCertificateVerificationCoordinator: () => ({ refreshCertificateTransparencyLogList: () => Promise.resolve() }) })",
  };
  for (const [pkg, stub] of Object.entries(bannedRequireStubs)) {
    const requirePattern = new RegExp(
      `require\\("${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`,
      "g",
    );
    const before = indexJsContents;
    indexJsContents = indexJsContents.replace(requirePattern, stub);
    if (indexJsContents !== before) {
      logProgress(`🛠️  Stubbed require("${pkg}") -> ${stub}`);
    } else {
      logProgress(`⚠️  require("${pkg}") not found in index.js (skipped)`);
    }
  }

  indexJsContents =
    `
    const yandexMusicMod_fs = require("fs");
    const yandexMusicMod_path = require("path");
    const yandexMusicMod_electron = require("electron");
    const yandexMusicMod_appFolder = yandexMusicMod_electron.app.getPath("userData");
    const yandexMusicMod_settingsFilePath = yandexMusicMod_path.join(yandexMusicMod_appFolder, "mod_settings.json");
    let enableSystemToolbar = false;
    try {
      enableSystemToolbar = JSON.parse(yandexMusicMod_fs.readFileSync(yandexMusicMod_settingsFilePath, "utf8"))["devtools/systemToolbar"];
    } catch (e) {}\n\n` + indexJsContents;

  if (/constructor\(\)\s+\{\s+this\.logger\s*=\s*new\s+Logger\("UpdateLogger"\)/s.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(
      /constructor\(\)\s+\{\s+this\.logger\s*=\s*new\s+Logger\("UpdateLogger"\)/s,
      "constructor() { return \n",
    );
  } else {
    logProgress(`❌ Updater class is not found in index.js`);
    return;
  }

  if (/minWidth:\s768/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(/minWidth:\s768/g, "minWidth: 360");
  } else {
    logProgress(`❌ "minWidth: 768" is not found in index.js`);
    return;
  }

  if (/minHeight:\s650/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(/minHeight:\s650/g, "minHeight: 550");
  } else {
    logProgress(`❌ "minHeight: 650" is not found in index.js`);
    return;
  }

  if (/titleBarStyle:\s"hidden"/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(
      /titleBarStyle:\s"hidden"/g,
      "titleBarStyle: !enableSystemToolbar ? 'hidden' : 'default'",
    );
  } else {
    logProgress(`❌ "titleBarStyle: 'hidden'" is not found in index.js`);
    return;
  }

  if (/const window = new electron.BrowserWindow\({\s+show: false/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(
      /const window = new electron.BrowserWindow\({\s+show: false/g,
      "const window = new electron.BrowserWindow({\n title: 'PULSE',\n icon: require('path').join(process.resourcesPath, 'assets', 'icon.ico'),\n show: true",
    );
  } else {
    logProgress(`❌ "const window = new electron.BrowserWindow({ show: false" is not found in index.js`);
    return;
  }

  if (/const webPreferences = {/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(
      /const webPreferences = {/g,
      "const webPreferences = {\n devTools: true, \n",
    );
  } else {
    logProgress(`❌ "const webPreferences = {" is not found in index.js`);
    return;
  }

  if (/webSecurity: true/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(/webSecurity: true/g, "webSecurity: false \n");
  } else {
    logProgress(`❌ "webSecurity: true" is not found in index.js`);
    return;
  }

  // Автоматически открывать devtools при запуске приложения
  if (/return window/g.test(indexJsContents)) {
    if (process.env.AUTO_OPEN_DEVTOOLS?.toLowerCase() === "true")
      indexJsContents = indexJsContents.replace(
        /return window/g,
        "window.webContents.openDevTools();\n" + "return window",
      );
  } else {
    logProgress(`❌ "return window" is not found in index.js`);
    return;
  }

  if (/window.once\("ready-to-show", \(\) => {/g.test(indexJsContents)) {
    indexJsContents = indexJsContents.replace(
      /window.once\("ready-to-show", \(\) => {/g,
      'window.once("ready-to-show", () => {' +
        `
           // Register Ctrl+Shift+I to open DevTools
            electron.globalShortcut.register("CommandOrControl+Shift+I", () => {
              const focusedWindow = electron.BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.webContents.toggleDevTools();
              }
            });
          `,
    );
  } else {
    logProgress(`❌ "window.once("ready-to-show", () => {" is not found in index.js`);
    return;
  }

  // Отключить аналитику
  if (/return window/g.test(indexJsContents)) {
    const blockedAnalyticsUrls = [
      "https://yandex.ru/clck/*",
      "https://mc.yandex.ru/*",
      "https://api.music.yandex.net/dynamic-pages/trigger/*",
      "https://api.music.yandex.net/lyric-views",
      "https://log.strm.yandex.ru/*",
      "https://api.acquisition-gwe.plus.yandex.net/*",
      "https://api.events.plus.yandex.net/*",
      "https://events.plus.yandex.net/*",
      "https://plus.yandex.net/*",
      "https://yandex.ru/ads/*",
      "https://strm.yandex.ru/ping",
    ];

    indexJsContents = indexJsContents.replace(
      /return window/g,
      `
      window.webContents.session.webRequest.onBeforeRequest(
        {
          urls: ${JSON.stringify(blockedAnalyticsUrls)},
        },
        (details, callback) => {
          callback({ cancel: true });
        },
      );

      window.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://api.music.yandex.net/*"],
      },
      (details, callback) => {
        const bannedHeaders = ["x-yandex-music-device", "x-request-id"];
        bannedHeaders.forEach((header) => {
          details.requestHeaders[header] = undefined;
        });
        callback({ requestHeaders: details.requestHeaders });
      },
    );` + "return window",
    );
  } else {
    logProgress(`❌ "return window" is not found in index.js`);
    return;
  }

  fs.writeFileSync(staticFiles.indexJs, indexJsContents);

  logProgress(`✔️   Done`);

  logProgress(`🛠️  Remove startup video intro`);

  const splashScreenPath = path.join(buildModdedDir, "app", "media", "splash_screen");
  if (fs.existsSync(splashScreenPath)) {
    fs.rmSync(splashScreenPath, { recursive: true, force: true });
    logProgress(`✔️   Done`);
  } else {
    logProgress(`❌ Splash screen was not found inside the sources for ${build.version}`);
    return;
  }

  logProgress(`🛠️  Copy mods to build`);

  const modPreloadScript = path.join(modSorcesDir, "preload.ts");
  const modMainScript = path.join(modSorcesDir, "main.js");

  console.log(`\n---- 🚧 Building renderer.js ----`);

  await $`bun run ui:build`;

  console.log(`\n---- 🚧 Building preload.js ----`);

  const buildResult = await Bun.build({
    target: "browser",
    format: "cjs",
    sourcemap: "linked",
    minify: false,
    entrypoints: [modPreloadScript],
    outdir: modCompiledDir,
  });

  let preloadJsContents =
    fs.readFileSync(staticFiles.preloadJs, "utf8") +
    `\n\n// yandexMusicMod preload.js\n(async () => {
        ${fs.readFileSync(path.join(modCompiledDir, "preload.js"), "utf8")}
      })();`;

  indexJsContents += `\n\n// yandexMusicMod main.js\n(async () => { 
        ${fs.readFileSync(modMainScript, "utf8")}
      })();`;

  logProgress(`🛠️  Copy discordRPC script to index.js`);

  indexJsContents = indexJsContents.replaceAll(
    'mod_require("discordRPC");',
    `\n\n// yandexMusicMod preload.js\n(async () => {
        ${fs.readFileSync(path.join(__projectRoot, "src/mod/features/utils/discordRPC.js"), "utf8")} 
      })();`,
  );

  logProgress(`✔️   Done`);

  fs.cpSync(path.join(modCompiledDir), path.join(buildModdedDir, "app", "yandexMusicMod"), {
    recursive: true,
  });

  // pulse-shell.js is injected verbatim by main.js, so it is copied as-is
  // instead of going through the vite bundle.
  fs.copyFileSync(
    path.join(__projectRoot, "src", "mod", "features", "ui", "pulse-shell.js"),
    path.join(buildModdedDir, "app", "yandexMusicMod", "pulse-shell.js"),
  );

  let modRendererContents = fs.readFileSync(path.join(buildModdedDir, "app", "yandexMusicMod", "renderer.js"), "utf8");

  modRendererContents = `(function () {\n${modRendererContents}\n})()`;

  fs.writeFileSync(path.join(buildModdedDir, "app", "yandexMusicMod", "renderer.js"), modRendererContents);

  const appPath = path.join(buildModdedDir, "app");
  const htmlFiles = fs
    .readdirSync(appPath, { recursive: true })
    .filter((file) => String(file).endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const fullHtmlPath = path.join(appPath, htmlFile);
    console.log("patching html file", fullHtmlPath);
    const htmlFileContents = fs.readFileSync(fullHtmlPath, "utf8");
    fs.writeFileSync(
      fullHtmlPath,
      htmlFileContents.replace(
        "<head>",
        `<head><script src="/yandexMusicMod/renderer.js"></script>
        <link rel="stylesheet" href="/yandexMusicMod/renderer.css">`,
      ),
    );
  }

  fs.writeFileSync(staticFiles.indexJs, indexJsContents);
  fs.writeFileSync(staticFiles.preloadJs, preloadJsContents);

  logProgress(`✔️   Done`);

  logProgress(`🛠️  Prettify all files in ${buildModdedDir}`);

  await prettifyDirectory(buildModdedDir);

  logProgress(`✔️   Done`);

  logProgress(`🛠️  Build modded app`);

  await $`bun install`.cwd(buildModdedDir);

  // await $`bunx electron .`.cwd(buildModdedDir);

  await $`bunx electron-builder`.cwd(buildModdedDir);

  logProgress(`✔️   Done`);

  return progressArray;
}
