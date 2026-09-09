/* =============================================================================
   QR Code Generator — all client side.
   Reading order: (1) grab elements, (2) create the QR object, (3) wire up events.
   ============================================================================= */

/* ---------- 1. Grab every element we need, once, up front ---------- */
const linkInput    = document.getElementById("link-input");
const logoInput    = document.getElementById("logo-input");
const removeLogoBtn= document.getElementById("remove-logo");
const pngBtn       = document.getElementById("download-png");
const svgBtn       = document.getElementById("download-svg");
const container    = document.getElementById("qr-container");
const hint         = document.getElementById("hint");
const caption      = document.getElementById("caption");

/* ---------- 2. Create the QR code object ----------
   We build it ONCE and then call .update() whenever something changes.
   Re-creating it on every keystroke would flicker and leak canvases.

   About errorCorrectionLevel: a QR code stores redundant data so it still
   scans when part of it is damaged or covered.
     L = ~7% recoverable   M = ~15%   Q = ~25%   H = ~30%
   A logo *covers* the middle of the code, so we bump to "H" when one is
   added — that is what makes the logo trick work at all.                    */
const qrCode = new QRCodeStyling({
  width: 280,
  height: 280,
  type: "canvas",
  data: "https://example.com",       // placeholder; replaced on first render
  margin: 8,
  qrOptions: { errorCorrectionLevel: "M" },
  dotsOptions:       { color: "#1a1c20", type: "square" },
  backgroundOptions: { color: "#ffffff" },
  imageOptions: {
    crossOrigin: "anonymous",
    imageSize: 0.35,   // logo takes 35% of the code's width
    margin: 6          // white gap punched around the logo so dots don't touch it
  }
});

let currentLogo = null;   // data-URL string, or null
let hasRendered = false;  // has the QR been appended to the page yet?

/* ---------- 3. Helpers ---------- */

/* People type "example.com", not "https://example.com". A QR pointing at
   a bare domain often opens as a search instead of a site, so we add the
   scheme ourselves — but only when the text actually looks like a domain. */
function normalizeUrl(raw) {
  const text = raw.trim();
  if (!text) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;  // already has http:// etc
  if (/^[\w-]+(\.[\w-]+)+/.test(text)) return "https://" + text;
  return text;   // not URL-shaped — encode it verbatim
}

/* Turn "https://example.com/pricing" into "example-com" for the filename. */
function fileNameFor(url) {
  try {
    return new URL(url).hostname.replace(/\./g, "-") || "qr-code";
  } catch {
    return "qr-code";
  }
}

/* The single place that redraws the code. Everything else calls this. */
function render() {
  const url = normalizeUrl(linkInput.value);

  // Nothing typed yet: clear the preview, disable downloads, stop.
  if (!url) {
    container.innerHTML = "";
    container.classList.remove("has-qr");
    hasRendered = false;
    pngBtn.disabled = svgBtn.disabled = true;
    hint.textContent = "";
    caption.textContent = "Waiting for a link…";
    return;
  }

  qrCode.update({
    data: url,
    image: currentLogo,
    qrOptions: { errorCorrectionLevel: currentLogo ? "H" : "M" }
  });

  // .append() puts the canvas in the DOM — only needed the first time.
  if (!hasRendered) {
    qrCode.append(container);
    container.classList.add("has-qr");
    hasRendered = true;
  }

  pngBtn.disabled = svgBtn.disabled = false;
  hint.textContent = /^https?:\/\//i.test(url) ? "" : "This isn't a web link — it'll be encoded as plain text.";
  caption.textContent = url;
}

/* Typing fires an event per keystroke. Redrawing that often is wasteful,
   so we wait 250ms after the last keystroke before rendering. */
let debounceTimer;
function renderSoon() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 250);
}

/* ---------- 4. Wire up the events ---------- */

linkInput.addEventListener("input", renderSoon);

logoInput.addEventListener("change", () => {
  const file = logoInput.files[0];
  if (!file) return;

  // FileReader reads the file the user picked into memory as a data-URL
  // (a base64 string). Nothing is uploaded anywhere — it never leaves the tab.
  const reader = new FileReader();
  reader.onload = () => {
    currentLogo = reader.result;
    removeLogoBtn.hidden = false;
    render();
  };
  reader.readAsDataURL(file);
});

removeLogoBtn.addEventListener("click", () => {
  currentLogo = null;
  logoInput.value = "";          // clears the "no file chosen" label too
  removeLogoBtn.hidden = true;
  render();
});

pngBtn.addEventListener("click", () => {
  qrCode.download({ name: fileNameFor(normalizeUrl(linkInput.value)), extension: "png" });
});

svgBtn.addEventListener("click", () => {
  qrCode.download({ name: fileNameFor(normalizeUrl(linkInput.value)), extension: "svg" });
});

/* ---------- 5. Start ---------- */
render();
