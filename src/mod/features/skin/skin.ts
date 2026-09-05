import { BRAND_NAME, BRAND_VERSION } from "~/mod/brand";

function applyWindowTitle() {
  try {
    document.title = BRAND_NAME;
  } catch {
    // ignore
  }
}

function hideYandexVersion(root: ParentNode = document.body || document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
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

  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      applyWindowTitle();
      if (document.body) hideYandexVersion(document.body);
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSkin);
} else {
  bootSkin();
}

export const PULSE_SKIN_VERSION = BRAND_VERSION;
