/**
 * Lidl Receipt Exporter
 * Version: 1.0.0
 *
 * Unofficial personal-use exporter for Lidl Plus digital receipts
 * on Lidl UK and Lidl Italy.
 *
 * License: MIT
 * Project is not affiliated with or endorsed by Lidl.
 */

(async () => {
  const MAX_HISTORY_PAGES = 100, RECEIPTS_PER_PAGE = 10;
  const HISTORY_TIMEOUT = 15000, RECEIPT_TIMEOUT = 30000, SETTLE_MS = 700;
  const MAX_CAPTURE_ATTEMPTS = 4, MAX_CONSECUTIVE_MISSING = 3;
  const BODY_FONT_SIZE_PT = 8.1, BODY_LINE_HEIGHT_PT = 9.2;
  const LOGO_WIDTH_PT = 68, BARCODE_NARROW_PT = 0.72;

  const SITE_CONFIGS = {
    "www.lidl.co.uk": {
      label: "UK",
      clientId: "GreatBritainRetailClient",
      countryCode: "gb",
      language: "en-GB",
      zipName: "lidl-uk-receipts.zip"
    },
    "lidl.co.uk": {
      label: "UK",
      clientId: "GreatBritainRetailClient",
      countryCode: "gb",
      language: "en-GB",
      zipName: "lidl-uk-receipts.zip"
    },
    "www.lidl.it": {
      label: "Italy",
      clientId: "ItalyRetailClient",
      countryCode: "it",
      language: "it-IT",
      zipName: "lidl-it-receipts.zip"
    },
    "lidl.it": {
      label: "Italy",
      clientId: "ItalyRetailClient",
      countryCode: "it",
      language: "it-IT",
      zipName: "lidl-it-receipts.zip"
    }
  };

  const SITE = SITE_CONFIGS[location.hostname];

  if (!SITE) {
    throw new Error(
      `Unsupported Lidl site: ${location.hostname}. ` +
      `Run this exporter on www.lidl.co.uk or www.lidl.it.`
    );
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const enc = new TextEncoder(), b = s => enc.encode(s);

  console.log(`Lidl ${SITE.label} receipt exporter starting...`);

  const concat = (...xs) => {
    const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const x of xs) { out.set(x, o); o += x.length; }
    return out;
  };
  const u16 = n => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  const crc32 = data => {
    let crc = 0xFFFFFFFF;
    for (const x of data) crc = crcTable[(crc ^ x) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  function createZip(files) {
    const locals = [], centrals = [];
    let offset = 0;
    const now = new Date();
    const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31);
    const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    for (const file of files) {
      const name = b(file.name), data = file.data, crc = crc32(data);
      const local = concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
      );
      locals.push(local, data);
      centrals.push(concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(offset), name
      ));
      offset += local.length + data.length;
    }

    const central = concat(...centrals);
    const end = concat(
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(central.length), u32(offset), u16(0)
    );
    return concat(...locals, central, end);
  }

  const normalise = s => String(s)
    .replace(/\u00A6|\u2502|\uFF5C/g, "|")
    .replace(/\u00A0/g, " ")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, "-");

  const pdfString = s => normalise(s)
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
    .replace(/€/g, "\\200").replace(/£/g, "\\243")
    .replace(/À/g, "\\300").replace(/È/g, "\\310").replace(/É/g, "\\311")
    .replace(/Ì/g, "\\314").replace(/Ò/g, "\\322").replace(/Ù/g, "\\331")
    .replace(/à/g, "\\340").replace(/è/g, "\\350").replace(/é/g, "\\351")
    .replace(/ì/g, "\\354").replace(/ò/g, "\\362").replace(/ù/g, "\\371")
    .replace(/[^\x20-\x7E]/g, "?");

  function parseColour(c) {
    const m = (c || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : [0, 0, 0];
  }
  function parseScaleY(t) {
    if (!t || t === "none") return 1;
    const m = t.match(/^matrix\(([^)]+)\)$/);
    if (!m) return 1;
    const v = m[1].split(",").map(Number);
    return Number.isFinite(v[3]) && v[3] ? Math.abs(v[3]) : 1;
  }

  class DetachedDocError extends Error {}

  function assertLive(doc, ticket, popup) {
    if (!doc || !ticket || !doc.defaultView || !ticket.isConnected) throw new DetachedDocError();
    let current;
    try { current = popup.document; } catch (_) { throw new DetachedDocError(); }
    if (current !== doc || ticket.ownerDocument !== doc) throw new DetachedDocError();
  }

  function extractStyledLines(pre, popup) {
    const doc = pre.ownerDocument, win = doc.defaultView;
    if (!win || !pre.isConnected) throw new DetachedDocError();

    let current;
    try { current = popup.document; } catch (_) { throw new DetachedDocError(); }
    if (current !== doc) throw new DetachedDocError();

    const base = parseFloat(win.getComputedStyle(pre).fontSize) || 16;
    const lines = [[]];

    function styleFor(el) {
      if (!doc.defaultView || !el.isConnected) throw new DetachedDocError();
      const c = win.getComputedStyle(el), n = parseInt(c.fontWeight, 10);
      return {
        bold: c.fontWeight === "bold" || (Number.isFinite(n) && n >= 600),
        colour: parseColour(c.color),
        fontScale: Math.max(0.5, (parseFloat(c.fontSize) || base) / base),
        scaleY: parseScaleY(c.transform)
      };
    }
    function add(text, style) {
      const parts = normalise(text.replace(/\r/g, "")).split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length) lines[lines.length - 1].push({ text: parts[i], ...style });
        if (i < parts.length - 1) lines.push([]);
      }
    }
    function walk(node) {
      if (node.nodeType === 3) {
        add(node.nodeValue || "", styleFor(node.parentElement || pre));
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") { lines.push([]); return; }
      const c = win.getComputedStyle(node);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return;
      for (const child of node.childNodes) walk(child);
    }
    walk(pre);
    while (lines.length && !lines[0].length) lines.shift();
    while (lines.length && !lines.at(-1).length) lines.pop();
    return lines;
  }

  const lineColumns = line => line.reduce((n, r) => n + r.text.length * (r.fontScale || 1), 0);

  const ITF = {
    "0":"nnwwn","1":"wnnnw","2":"nwnnw","3":"wwnnn","4":"nnwnw",
    "5":"wnwnn","6":"nwwnn","7":"nnnww","8":"wnnwn","9":"nwnwn"
  };

  function barcodeCommands(code, pageWidth, y) {
    if (!/^\d+$/.test(code || "")) return "";
    if (code.length % 2) code = "0" + code;

    const narrow = BARCODE_NARROW_PT, wide = narrow * 2.5, height = 28, seg = [];
    seg.push(["b", narrow], ["s", narrow], ["b", narrow], ["s", narrow]);

    for (let i = 0; i < code.length; i += 2) {
      const bars = ITF[code[i]], spaces = ITF[code[i + 1]];
      for (let j = 0; j < 5; j++) {
        seg.push(["b", bars[j] === "w" ? wide : narrow]);
        seg.push(["s", spaces[j] === "w" ? wide : narrow]);
      }
    }
    seg.push(["b", wide], ["s", narrow], ["b", narrow]);

    const total = seg.reduce((n, s) => n + s[1], 0);
    let x = (pageWidth - total) / 2, out = "0 g\n";
    for (const [type, width] of seg) {
      if (type === "b") out += `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height} re f\n`;
      x += width;
    }
    return out;
  }

  async function canvasToAsset(canvas, cssWidth = canvas.width, cssHeight = canvas.height) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      x => x ? resolve(x) : reject(new Error("Canvas JPEG export failed.")),
      "image/jpeg", 0.97
    ));
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width, height: canvas.height, cssWidth, cssHeight
    };
  }

  function cropCanvas(canvas, threshold = 246, padding = 16) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const d = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (d[i + 3] > 10 && (d[i] < threshold || d[i + 1] < threshold || d[i + 2] < threshold)) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return canvas;

    minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding); maxY = Math.min(height - 1, maxY + padding);

    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const o = out.getContext("2d");
    o.fillStyle = "#fff"; o.fillRect(0, 0, w, h);
    o.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    return out;
  }

  async function textElementToJpeg(element, popup) {
    if (!element) return null;

    const doc = element.ownerDocument, win = doc.defaultView;
    if (!win || !element.isConnected) throw new DetachedDocError();

    let current;
    try { current = popup.document; } catch (_) { throw new DetachedDocError(); }
    if (current !== doc) throw new DetachedDocError();

    const c = win.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const fontSize = parseFloat(c.fontSize) || 14;
    let lineHeight = parseFloat(c.lineHeight);
    if (!Number.isFinite(lineHeight)) lineHeight = fontSize * 1.2;

    const raw = normalise(element.innerText || element.textContent || "").replace(/\r/g, "").trim();
    if (!raw) return null;

    const font = `${c.fontStyle || "normal"} ${c.fontWeight || "400"} ${fontSize}px ${c.fontFamily || "sans-serif"}`;
    const mctx = document.createElement("canvas").getContext("2d");
    mctx.font = font;

    const pad = 4, available = cssWidth - pad * 2, lines = [];
    for (const src of raw.split("\n")) {
      const trimmed = src.trim();
      if (!trimmed) { lines.push(""); continue; }
      let cur = "";
      for (const word of trimmed.split(/\s+/)) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (cur && mctx.measureText(candidate).width > available) {
          lines.push(cur); cur = word;
        } else cur = candidate;
      }
      if (cur) lines.push(cur);
    }

    const cssHeight = Math.max(rect.height, lineHeight * lines.length + 2);
    const scale = 4, canvas = document.createElement("canvas");
    canvas.width = Math.ceil(cssWidth * scale);
    canvas.height = Math.ceil(cssHeight * scale);

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.font = font; ctx.fillStyle = c.color || "#000"; ctx.textBaseline = "top";

    let x;
    if (c.textAlign === "center") { ctx.textAlign = "center"; x = cssWidth / 2; }
    else if (c.textAlign === "right" || c.textAlign === "end") { ctx.textAlign = "right"; x = cssWidth - pad; }
    else { ctx.textAlign = "left"; x = pad; }

    let y = Math.max(0, (cssHeight - lines.length * lineHeight) / 2);
    for (const line of lines) { if (line) ctx.fillText(line, x, y); y += lineHeight; }

    return canvasToAsset(canvas, cssWidth, cssHeight);
  }

  async function imageUrlToJpeg(url, crop = false) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`Image returned ${response.status}`);

    const bitmap = await createImageBitmap(await response.blob());
    const scale = 4, canvas = document.createElement("canvas");
    canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    return canvasToAsset(crop ? cropCanvas(canvas) : canvas);
  }

  let logoAsset = null;
  async function getLogoAsset(ticket, doc) {
    if (logoAsset) return logoAsset;
    const img = ticket.querySelector('img[data-testid="image"], img[class*="_logo_"]');
    if (!img) return null;

    const src = img.currentSrc || img.getAttribute("src");
    if (!src) return null;

    const url = new URL(src, doc.location.href).href;
    console.log(`Loading Lidl ${SITE.label} logo:`, url);

    try {
      logoAsset = await imageUrlToJpeg(url, true);
      return logoAsset;
    } catch (error) {
      console.warn("Could not load logo:", error);
      return null;
    }
  }

  function getBarcodeCode(ticket) {
    const wrapper = ticket.querySelector('[data-testid^="bottom-barcode-"]');
    if (wrapper) {
      const value = wrapper.getAttribute("data-testid").replace(/^bottom-barcode-/, "");
      if (/^\d+$/.test(value)) return value;
    }

    const canvas = ticket.querySelector('canvas[data-testid$="-ITF"]');
    if (canvas) {
      const value = canvas.getAttribute("data-testid").replace(/-ITF$/, "");
      if (/^\d+$/.test(value)) return value;
    }

    const raw = ticket
      .querySelector("[data-return-code]")
      ?.getAttribute("data-return-code") || "";

    if (/^\d+$/.test(raw)) {
      return raw;
    }

    return "";
  }

  function createReceiptPdf({ styledLines, logo, copyImage, marketingImages, barcode }) {
    const pageWidth = 80 * 72 / 25.4, fontSize = BODY_FONT_SIZE_PT;
    const lineHeight = BODY_LINE_HEIGHT_PT, charWidth = fontSize * 0.6;
    const maximumColumns = Math.max(1, ...styledLines.map(lineColumns));
    const bodyOriginX = Math.max(4, (pageWidth - maximumColumns * charWidth) / 2);

    const copyWidth = copyImage ? Math.min(pageWidth - 12, copyImage.cssWidth * 0.75) : 0;
    const copyHeight = copyImage ? copyWidth * copyImage.height / copyImage.width : 0;
    const logoWidth = logo ? LOGO_WIDTH_PT : 0;
    const logoHeight = logo ? logoWidth * logo.height / logo.width : 0;

    const marketingLayouts = (marketingImages || []).map(image => {
      const width = Math.min(pageWidth - 8, image.cssWidth * 0.75);
      return { image, width, height: width * image.height / image.width };
    });

    const marketingTotalHeight =
      marketingLayouts.reduce((n, x) => n + x.height, 0) +
      Math.max(0, marketingLayouts.length - 1) * 4;

    const pageHeight = Math.max(
      180,
      10 + copyHeight + (copyImage ? 10 : 0) + logoHeight + (logo ? 17 : 3) +
      styledLines.length * lineHeight + (barcode ? 67 : 15) +
      (marketingLayouts.length ? marketingTotalHeight + 14 : 5) + 15
    );

    const objects = {};
    let nextId = 6;
    const logoId = logo ? nextId++ : null;
    const copyId = copyImage ? nextId++ : null;
    const marketingIds = marketingLayouts.map(() => nextId++);
    const contentId = nextId++, objectCount = nextId - 1;

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";

    let resources = `<<
/Font <<
/F1 4 0 R
/F2 5 0 R
>>`;

    const xo = [];
    if (logoId) xo.push(`/Logo ${logoId} 0 R`);
    if (copyId) xo.push(`/Copy ${copyId} 0 R`);
    marketingIds.forEach((id, i) => xo.push(`/Marketing${i} ${id} 0 R`));
    if (xo.length) resources += `
/XObject <<
${xo.join("\n")}
>>`;
    resources += `
>>`;

    objects[3] = `<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}]
/Resources ${resources}
/Contents ${contentId} 0 R
>>`;
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
    objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>";

    let stream = "", y = pageHeight - 8;

    if (copyImage) {
      const x = (pageWidth - copyWidth) / 2; y -= copyHeight;
      stream += `q
${copyWidth.toFixed(2)} 0 0 ${copyHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm
/Copy Do
Q
`;
      y -= 10;
    }

    if (logo) {
      const x = (pageWidth - logoWidth) / 2; y -= logoHeight;
      stream += `q
${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm
/Logo Do
Q
`;
      y -= 17;
    }

    for (const line of styledLines) {
      let column = 0;
      for (const run of line) {
        if (!run.text.length) continue;

        const [r, g, bl] = run.colour;
        const fs = fontSize * (run.fontScale || 1), sy = run.scaleY || 1;
        const x = bodyOriginX + column * charWidth;

        stream += `${r.toFixed(4)} ${g.toFixed(4)} ${bl.toFixed(4)} rg
BT
${run.bold ? "/F2" : "/F1"} ${fs.toFixed(2)} Tf
1 0 0 ${sy.toFixed(3)} ${x.toFixed(2)} ${y.toFixed(2)} Tm
(${pdfString(run.text)}) Tj
ET
`;
        column += run.text.length * (run.fontScale || 1);
      }
      y -= lineHeight;
    }

    if (barcode) {
      const barcodeY = Math.max(marketingTotalHeight + 30, y - 40);
      stream += barcodeCommands(barcode, pageWidth, barcodeY);

      const bfs = 4.5, tw = barcode.length * bfs * 0.6;
      stream += `0 0 0 rg
BT
/F1 ${bfs} Tf
1 0 0 1 ${((pageWidth - tw) / 2).toFixed(2)} ${(barcodeY - 8).toFixed(2)} Tm
(${pdfString(barcode)}) Tj
ET
`;
    }

    let marketingY = 7;
    for (let i = marketingLayouts.length - 1; i >= 0; i--) {
      const m = marketingLayouts[i], x = (pageWidth - m.width) / 2;
      stream += `q
${m.width.toFixed(2)} 0 0 ${m.height.toFixed(2)} ${x.toFixed(2)} ${marketingY.toFixed(2)} cm
/Marketing${i} Do
Q
`;
      marketingY += m.height + 4;
    }

    objects[contentId] = { type: "stream", data: b(stream) };

    const imageObjects = new Map();
    if (logoId) imageObjects.set(logoId, logo);
    if (copyId) imageObjects.set(copyId, copyImage);
    marketingIds.forEach((id, i) => imageObjects.set(id, marketingLayouts[i].image));

    const parts = [], offsets = [0];
    let pos = 0;
    const header = b("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    parts.push(header); pos += header.length;

    for (let id = 1; id <= objectCount; id++) {
      offsets[id] = pos;
      let objectBytes;

      if (imageObjects.has(id)) {
        const im = imageObjects.get(id);
        objectBytes = concat(
          b(`${id} 0 obj
<<
/Type /XObject
/Subtype /Image
/Width ${im.width}
/Height ${im.height}
/ColorSpace /DeviceRGB
/BitsPerComponent 8
/Filter /DCTDecode
/Length ${im.data.length}
>>
stream
`),
          im.data,
          b(`
endstream
endobj
`)
        );
      } else if (objects[id]?.type === "stream") {
        const d = objects[id].data;
        objectBytes = concat(
          b(`${id} 0 obj
<< /Length ${d.length} >>
stream
`),
          d,
          b(`
endstream
endobj
`)
        );
      } else {
        objectBytes = b(`${id} 0 obj
${objects[id]}
endobj
`);
      }

      parts.push(objectBytes);
      pos += objectBytes.length;
    }

    const xrefPos = pos;
    let xref = `xref
0 ${objectCount + 1}
0000000000 65535 f 
`;
    for (let id = 1; id <= objectCount; id++) {
      xref += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
    }

    parts.push(b(`${xref}trailer
<< /Size ${objectCount + 1} /Root 1 0 R >>
startxref
${xrefPos}
%%EOF`));

    return concat(...parts);
  }

  const historyFrame = document.createElement("iframe");
  Object.assign(historyFrame.style, {
    position: "fixed", left: "-10000px", top: "0",
    width: "1200px", height: "4000px", border: "0", pointerEvents: "none"
  });
  document.body.appendChild(historyFrame);

  async function loadHistoryPage(url) {
    await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; reject(new Error(`History page load timeout: ${url}`)); }
      }, HISTORY_TIMEOUT);

      historyFrame.onload = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(); }
      };
      historyFrame.src = url;
    });

    const start = Date.now();
    while (Date.now() - start < HISTORY_TIMEOUT) {
      const doc = historyFrame.contentDocument;
      if (doc?.querySelector('[data-testid="purchase-history-content"]')) {
        await sleep(300);
        return doc;
      }
      await sleep(150);
    }
    throw new Error(`Purchase history content not found on ${url}`);
  }

  const params = new URLSearchParams(location.search);
  const historyBase = new URL("/mre/purchase-history", location.origin);
  historyBase.searchParams.set("client_id", params.get("client_id") || SITE.clientId);
  historyBase.searchParams.set("country_code", params.get("country_code") || SITE.countryCode);
  historyBase.searchParams.set("language", params.get("language") || SITE.language);

  const receiptURLs = [], seen = new Set();
  console.log(`Scanning Lidl ${SITE.label} receipt history...`);

  for (let page = 1; page <= MAX_HISTORY_PAGES; page++) {
    const url = new URL(historyBase);
    url.searchParams.set("page", String(page));

    let doc;
    try { doc = await loadHistoryPage(url.href); }
    catch (_) { console.log(`History ended at page ${page}.`); break; }

    const links = [...doc.querySelectorAll(
      '[data-testid="purchase-history-content"] a[href*="/mre/purchase-detail"]'
    )];

    let added = 0;
    for (const link of links) {
      const href = new URL(link.getAttribute("href"), location.origin).href;
      if (!seen.has(href)) { seen.add(href); receiptURLs.push(href); added++; }
    }

    console.log(`History page ${page}: ${links.length} receipt(s), ${added} new.`);
    if (!links.length || added === 0 || links.length < RECEIPTS_PER_PAGE) break;
  }

  historyFrame.remove();
  console.log(`Found ${receiptURLs.length} unique receipt(s).`);

  const popup = window.open(
    "about:blank",
    "lidlReceiptExporter",
    "width=700,height=900,left=50,top=50"
  );

  if (!popup) throw new Error(`Chrome blocked the receipt processing window. Allow pop-ups for ${location.hostname} and run again.`);

  async function loadStableReceipt(url) {
    if (popup.closed) throw new Error("The receipt processing window was closed.");
    popup.location.href = url;

    const start = Date.now();
    let lastHost = "";

    while (Date.now() - start < RECEIPT_TIMEOUT) {
      if (popup.closed) throw new Error("The receipt processing window was closed.");

      try {
        const host = popup.location.host;
        if (host !== lastHost) { console.log(`  Receipt window host: ${host}`); lastHost = host; }

        const doc1 = popup.document;
        const ticket1 = doc1.querySelector('[data-testid^="ticket-"]');

        if (ticket1 && doc1.defaultView && ticket1.isConnected) {
          await sleep(SETTLE_MS);

          let doc2;
          try { doc2 = popup.document; } catch (_) { continue; }
          if (doc2 !== doc1 || !doc2.defaultView) continue;

          const ticket2 = doc2.querySelector('[data-testid^="ticket-"]');
          if (!ticket2 || !ticket2.isConnected) continue;

          try {
            await Promise.race([doc2.fonts?.ready || Promise.resolve(), sleep(1500)]);
          } catch (_) {}

          let doc3;
          try { doc3 = popup.document; } catch (_) { continue; }
          if (doc3 !== doc2 || !doc3.defaultView) continue;

          const ticket3 = doc3.querySelector('[data-testid^="ticket-"]');
          if (!ticket3 || !ticket3.isConnected) continue;

          return { doc: doc3, ticket: ticket3 };
        }
      } catch (_) {
        /* Expected during accounts.lidl.com redirects. */
      }

      await sleep(200);
    }

    let finalURL = "(cross-origin/auth page)";
    try { finalURL = popup.location.href; } catch (_) {}
    return { doc: null, ticket: null, finalURL };
  }

  async function captureWithRetry(url, number) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_CAPTURE_ATTEMPTS; attempt++) {
      const result = await loadStableReceipt(url);
      if (!result.ticket) return { kind: "missing", finalURL: result.finalURL };

      const { doc, ticket } = result;

      try {
        assertLive(doc, ticket, popup);

        const pre = ticket.querySelector("pre");
        if (!pre) throw new Error("Receipt <pre> element not found.");

        /* Capture the vulnerable computed-style data immediately. */
        const styledLines = extractStyledLines(pre, popup);
        const plainText = normalise(pre.innerText);
        const barcode = getBarcodeCode(ticket);

        const copyEl = ticket.querySelector('[data-testid="copy"]');
        const marketingEls = [
          ...ticket.querySelectorAll(
            '[data-testid="marketingReturn"], [data-testid="marketingThank"]'
          )
        ];

        assertLive(doc, ticket, popup);
        const logo = await getLogoAsset(ticket, doc);

        assertLive(doc, ticket, popup);
        const copyImage = await textElementToJpeg(copyEl, popup);

        const marketingImages = [];
        for (const el of marketingEls) {
          assertLive(doc, ticket, popup);
          const image = await textElementToJpeg(el, popup);
          if (image) marketingImages.push(image);
        }

        assertLive(doc, ticket, popup);

        return {
          kind: "ok", styledLines, plainText, barcode,
          logo, copyImage, marketingImages
        };
      } catch (error) {
        lastError = error;

        const detached =
          error instanceof DetachedDocError ||
          /getComputedStyle|defaultView|detached|not connected/i.test(String(error?.message || error));

        if (detached && attempt < MAX_CAPTURE_ATTEMPTS) {
          console.warn(
            `  Receipt ${number}: document changed during capture; retrying (${attempt}/${MAX_CAPTURE_ATTEMPTS})...`
          );
          await sleep(500);
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error("Receipt capture failed.");
  }

  function validDate(year, month, day) {
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  function makeDate(year, month, day) {
    year = Number(year); month = Number(month); day = Number(day);
    if (year < 100) year += 2000;
    return validDate(year, month, day) ? { year, month, day } : null;
  }

  function dateFromText(text) {
    text = normalise(text);

    // UK receipts: "Date: 04/11/25 Time: ..."
    let m = text.match(
      /\bDate:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/i
    );
    if (m) {
      return makeDate(m[3], m[2], m[1]);
    }

    // Italian digital summary: "09-08-2026 18:37"
    m = text.match(
      /\b(\d{1,2})-(\d{1,2})-(\d{4})\s+\d{1,2}:\d{2}\b/
    );
    if (m) {
      return makeDate(m[3], m[2], m[1]);
    }

    // Italian card-terminal section: "DATA 09/08/26 ORA 18:38"
    m = text.match(
      /\bDATA\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/i
    );
    if (m) {
      return makeDate(m[3], m[2], m[1]);
    }

    return null;
  }

  function dateFromURL(url) {
    try {
      const t = new URL(url).searchParams.get("t") || "";
      for (const s of t.match(/20\d{6}/g) || []) {
        const d = makeDate(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
        if (d) return d;
      }
    } catch (_) {}
    return null;
  }

  const usedNames = new Map();
  function filenameFor(text, url) {
    const d = dateFromText(text) || dateFromURL(url);
    if (!d) return "unknown-date_lidl-receipt.pdf";

    const base = `${d.year}_${String(d.month).padStart(2, "0")}_${String(d.day).padStart(2, "0")}_lidl-receipt`;
    const n = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, n);
    return n === 1 ? `${base}.pdf` : `${base}_${n}.pdf`;
  }

  const pdfFiles = [];
  let success = 0, failed = 0, consecutiveMissing = 0;

  for (let i = 0; i < receiptURLs.length; i++) {
    const url = receiptURLs[i];
    console.log(`[${i + 1}/${receiptURLs.length}] Loading receipt...`);

    try {
      const captured = await captureWithRetry(url, i + 1);

      if (captured.kind === "missing") {
        failed++; consecutiveMissing++;
        console.warn(
          `✗ Receipt ${i + 1}: no ticket after ${RECEIPT_TIMEOUT / 1000}s (${consecutiveMissing}/${MAX_CONSECUTIVE_MISSING}).`,
          url, captured.finalURL || ""
        );

        if (consecutiveMissing >= MAX_CONSECUTIVE_MISSING) {
          console.warn(`Stopping after ${MAX_CONSECUTIVE_MISSING} consecutive genuinely unavailable receipt pages.`);
          break;
        }
        continue;
      }

      consecutiveMissing = 0;
      const filename = filenameFor(captured.plainText, url);

      console.log(`[${i + 1}/${receiptURLs.length}] Creating ${filename}`);

      const pdf = createReceiptPdf({
        styledLines: captured.styledLines,
        logo: captured.logo,
        copyImage: captured.copyImage,
        marketingImages: captured.marketingImages,
        barcode: captured.barcode
      });

      pdfFiles.push({ name: filename, data: pdf });
      success++;
      console.log(`✓ ${filename}`);
    } catch (error) {
      failed++;
      consecutiveMissing = 0;
      console.error(`✗ Receipt ${i + 1} failed after retries:`, url, error);
    }
  }

  try { popup.close(); } catch (_) {}

  if (!pdfFiles.length) throw new Error("No PDFs were generated.");

  console.log(`Creating ZIP containing ${pdfFiles.length} PDF(s)...`);

  const zipBlob = new Blob([createZip(pdfFiles)], { type: "application/zip" });
  const downloadURL = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = downloadURL;
  a.download = SITE.zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(downloadURL), 60000);
  console.log(`DONE: ${success} exported, ${failed} failed/skipped.`);
})();
