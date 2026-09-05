import { BRAND_NAME, BRAND_VERSION } from "~/mod/brand";

function applyWindowTitle() {
  try {
    document.title = BRAND_NAME;
  } catch {
    // ignore
  }
}

function hideYandexVersion(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);

  for (const node of nodes) {
    const value = node.nodeValue || "";
    if (!/\d+\.\d+\.\d+/.test(value)) continue;
    if (value.includes(BRAND_VERSION) && !/5\.\d+\.\d+/.test(value)) continue;
    node.nodeValue = value.replace(/\b\d+\.\d+\.\d+\b/g, BRAND_VERSION);
  }
}

function bootSkin() {
  applyWindowTitle();
  if (document.body) hideYandexVersion(document.body);

  // Only freshly added nodes are rescanned: walking the whole document on every
  // mutation burns CPU non-stop, because the player rewrites its markup
  // several times per second while a track is playing.
  const pending: Node[] = [];
  let scheduled = 0;

  const flush = () => {
    scheduled = 0;
    applyWindowTitle();
    const batch = pending.splice(0, pending.length);
    for (const node of batch) {
      if (node.isConnected) hideYandexVersion(node);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => pending.push(node));
    }
    if (!pending.length || scheduled) return;
    scheduled = window.setTimeout(flush, 500);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSkin);
} else {
  bootSkin();
}

export const PULSE_SKIN_VERSION = BRAND_VERSION;
