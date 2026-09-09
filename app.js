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

/* The finished image, kept ready as a Blob so the download button never has
   to wait. See the long comment above saveFile() for why that matters. */
let pngBlob = null;
let svgBlob = null;
let blobToken = 0;   // guards against a slow render finishing after a newer one

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
    pngBlob = svgBlob = null;
    blobToken++;                 // invalidate any render still in flight
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

  refreshBlobs();
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

/* ---------- 4b. Saving the image ----------

   We deliberately do NOT use the library's own qrCode.download(). It builds a
   `data:` URL and clicks a hidden <a download>, and it does that *after* an
   `await`. Both halves of that break on phones:

     - iOS Safari ignores the `download` attribute on a data: URL, because a
       data: URL has no filename or origin it can attach a save to. The tap
       does nothing at all - no file, no error message.
     - The `await` spends the "user activation" token. Browsers only allow a
       download while a real tap is still being handled; once you await, the
       tap is over and mobile browsers quietly drop the request.

   So we fix both: we prepare a real Blob ahead of time (refreshBlobs, below)
   and the click handler stays fully synchronous. */

/* Regenerate the downloadable Blobs for whatever is currently on screen.
   getRawData() reuses the canvas that is already drawn, so this is cheap and
   it does not disturb the preview. */
function refreshBlobs() {
  const token = ++blobToken;

  // The buttons stay disabled until the images actually exist. This is the
  // point of the whole exercise: a tap must never arrive before the Blob is
  // ready, because then we would have to await inside the click handler and
  // we would lose the user gesture all over again.
  pngBlob = svgBlob = null;
  setDownloadsReady(false);

  Promise.all([qrCode.getRawData("png"), qrCode.getRawData("svg")])
    .then(([png, svg]) => {
      if (token !== blobToken) return;   // a newer render has superseded this one
      pngBlob = png;
      svgBlob = svg;
      setDownloadsReady(true);
    })
    .catch(() => {
      if (token === blobToken) caption.textContent = "Couldn't prepare the image for download.";
    });
}

function setDownloadsReady(ready) {
  pngBtn.disabled = svgBtn.disabled = !ready;
}

/* Hand a Blob to the user. Two routes, because phones and desktops differ:

     - On a phone, the Web Share API opens the native sheet ("Save Image",
       "Save to Files", AirDrop, ...). This is the only route iOS reliably
       offers for saving a generated image, so we prefer it when available.
     - Everywhere else, an object URL on a real <a download> - the ordinary
       desktop path. An object URL, unlike a data: URL, behaves like a real
       file, so the download attribute is honoured. */
function saveFile(blob, filename) {
  if (!blob) return;   // unreachable while the buttons are readiness-gated

  const file = new File([blob], filename, { type: blob.type });

  // Desktop Chrome also advertises Web Share, but there a share sheet is just
  // an extra dialog in the way of a download that already works. So we only
  // reach for it on touch-first devices, which is where the plain download is
  // the unreliable one. "pointer: coarse" means a finger, not a mouse.
  const isTouchDevice = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  if (isTouchDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch((err) => {
      // The user tapping "Cancel" rejects with AbortError. That is not a
      // failure, so only fall back when something actually went wrong.
      if (err && err.name !== "AbortError") downloadViaLink(blob, filename);
    });
    return;
  }

  downloadViaLink(blob, filename);
}

function downloadViaLink(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Freeing the URL immediately can cancel the download in some browsers,
  // so we give it a moment first.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

pngBtn.addEventListener("click", () => {
  saveFile(pngBlob, fileNameFor(normalizeUrl(linkInput.value)) + ".png");
});

svgBtn.addEventListener("click", () => {
  saveFile(svgBlob, fileNameFor(normalizeUrl(linkInput.value)) + ".svg");
});

/* ---------- 5. Start ---------- */
render();
