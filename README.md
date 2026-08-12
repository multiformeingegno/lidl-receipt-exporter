# Lidl Receipt Exporter

Unofficial browser-based exporter for **your own Lidl Plus digital receipts**.

It currently supports:

- **Lidl UK** (`lidl.co.uk`)
- **Lidl Italy** (`lidl.it`)
- **Lidl Greece** (`lidl-hellas.gr`)

The exporter runs locally in your browser while you are signed in to your Lidl account. It scans the purchase-history pages, recreates each available digital receipt as a PDF, and downloads the results as a ZIP archive.

> [!IMPORTANT]
> This project is **not affiliated with, endorsed by, or supported by Lidl**. Lidl and Lidl Plus are trademarks of their respective owners.

## What it does

The exporter:

- detects whether it is running on Lidl UK, Lidl Italy or Lidl Greece;
- scans all available purchase-history pages;
- opens receipt detail pages using a reusable browser window;
- handles Lidl authentication redirects that cannot run inside an iframe;
- preserves receipt text, basic emphasis, colours and layout;
- embeds the Lidl logo from the receipt page at runtime;
- recreates the receipt barcode where a numeric ITF value is available;
- names files as `YYYY_MM_DD_lidl-receipt.pdf`;
- adds `_2`, `_3`, etc. when multiple receipts share a date;
- stops after three consecutive historical receipt pages have no usable ticket data;
- packages all successfully generated PDFs into a ZIP file.

No external JavaScript libraries are loaded.

## Supported sites

| Site | Purchase-history domain | Output ZIP |
| --- | --- | --- |
| Lidl UK | `www.lidl.co.uk` | `lidl-uk-receipts.zip` |
| Lidl Italy | `www.lidl.it` | `lidl-it-receipts.zip` |
| Lidl Greece | `www.lidl-hellas.gr` | `lidl-greece-receipts.zip` |

Tested against the Lidl web interfaces available in **August 2026**. Lidl can change these interfaces at any time.

## Requirements

- A desktop Chromium-based browser such as Google Chrome or Microsoft Edge.
- A Lidl Plus account with digital receipts.
- You must already be signed in to the relevant Lidl website.
- Pop-ups must be allowed for the Lidl website while the exporter is running.

Other browsers may work, but are not currently tested.

## Quick start

### 1. Sign in

Open the relevant Lidl purchase-history page while signed in.

UK:

```text
https://www.lidl.co.uk/mre/purchase-history?client_id=GreatBritainRetailClient&country_code=gb&language=en-GB&page=1
```

Italy:

```text
https://www.lidl.it/mre/purchase-history?client_id=ItalyRetailClient&country_code=it&language=it-IT&page=1
```

Greece:

```text
https://www.lidl-hellas.gr/mre/purchase-history?client_id=greeceretailclient&country_code=gr&language=el-GR&page=1
```

### 2. Open DevTools

Open the browser Developer Tools and select the **Console** tab.

### 3. Review the script

Download or open [`lidl-receipt-exporter.js`](./lidl-receipt-exporter.js) and review it before running it.

Do not paste code into your browser console unless you understand and trust what it does.

### 4. Run it

Paste the full contents of `lidl-receipt-exporter.js` into the Console and press Enter.

The exporter will open one reusable receipt-processing window. **Do not close this window** while the exporter is running.

If the browser blocks it, allow pop-ups for the current Lidl domain and run the exporter again.

### 5. Wait for completion

Progress is shown in the Console.

A successful run ends with output similar to:

```text
Creating ZIP containing 123 PDF(s)...
DONE: 123 exported, 0 failed/skipped.
```

The ZIP will then download automatically.

## Privacy

The exporter has no analytics, telemetry or external backend.

Receipt data is processed in the browser and written into the generated PDF/ZIP files on your device. The script does not intentionally send your receipt data to the project maintainer or to a third-party service.

It does, however, make the normal authenticated requests needed to load pages and assets from the Lidl website. See [PRIVACY.md](./PRIVACY.md).

## Historical receipt availability

A transaction appearing in Lidl's purchase-history list does not necessarily mean its full digital receipt is still renderable.

The exporter therefore stops after **three consecutive receipt detail pages** fail to expose the expected receipt ticket. This avoids spending a long time retrying an older historical range that Lidl no longer makes available through the current interface.

A single isolated failure does **not** trigger the cutoff.

## Authentication redirects

Some Lidl receipt pages may temporarily redirect through `accounts.lidl.com`.

That authentication page cannot be embedded in an iframe because of its browser security policy. The exporter therefore processes receipt detail pages in a single reusable top-level window instead.

This is expected behaviour.

## Harmless-looking Console errors

Depending on Lidl's current frontend, you may see unrelated network errors such as:

```text
cdn.cookielaw.org ... ERR_NAME_NOT_RESOLVED
/mlap/web/assets/... 404
/not-found?... 404
```

These are not automatically evidence that the export failed. Use the exporter's own `✓`, `✗`, retry and final `DONE` messages to determine the result.

See [Troubleshooting](./docs/TROUBLESHOOTING.md) for more detail.

## Security

This script runs in the context of an authenticated Lidl page, so it should be treated as security-sensitive browser code.

The project intentionally does **not**:

- ask for your Lidl password;
- store authentication cookies;
- transmit authentication tokens to a project server;
- attempt to bypass Lidl authentication;
- access accounts other than the one already signed in;
- run receipt requests concurrently at high volume.

See [SECURITY.md](./SECURITY.md).

## Personal use and Lidl terms

This project is intended for **personal archival/export of receipts belonging to the signed-in user**.

You are responsible for ensuring that your use complies with the terms, policies and laws applicable to your account and jurisdiction. Do not use this project to access another person's account or data, circumvent access controls, or build a commercial scraping service.

See [DISCLAIMER.md](./DISCLAIMER.md).

## Known limitations

- Lidl may change its HTML, CSS, routes, authentication flow or receipt format without notice.
- Some older receipts may remain visible in purchase history but no longer have renderable detail data.
- The generated PDF is a reconstruction of the digital receipt, not a byte-for-byte copy of Lidl's own rendering.
- Greek receipt bodies are rendered as an image in the PDF so their Unicode text remains readable.
- Browser popup/privacy extensions can interfere with receipt processing.
- Firefox and Safari are not currently tested.

## Repository structure

```text
lidl-receipt-exporter/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── workflows/
│   │   └── syntax-check.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── TECHNICAL_NOTES.md
│   └── TROUBLESHOOTING.md
├── screenshots/
│   └── README.md
├── .gitattributes
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── DISCLAIMER.md
├── LICENSE
├── PRIVACY.md
├── README.md
├── SECURITY.md
└── lidl-receipt-exporter.js
```

## Contributing

Bug reports and pull requests are welcome. Please remove all personal information from logs and screenshots before posting them publicly.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

The project code is licensed under the [MIT License](./LICENSE).

The licence applies to this project's original code only. It does not grant any rights in Lidl trademarks, branding, receipt content, website code or other third-party material.
