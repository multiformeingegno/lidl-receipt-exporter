# Technical Notes

## Overview

The exporter is deliberately self-contained.

It does not depend on npm packages, CDNs, PDF libraries or ZIP libraries.

The main stages are:

1. detect Lidl UK, Lidl Italy or Lidl Greece from `location.hostname`;
2. build the appropriate purchase-history URL parameters;
3. enumerate receipt detail links page by page;
4. load each receipt in one reusable top-level window;
5. wait for a stable same-origin Lidl receipt document;
6. extract receipt text and computed styles;
7. reconstruct the receipt as a PDF;
8. add each PDF to an in-memory ZIP;
9. download the final ZIP.

## Why purchase history uses an iframe

Purchase-history pages can be loaded same-origin and queried for receipt links without requiring a visible browser window.

This keeps enumeration unobtrusive.

## Why receipt details use a popup

Some Lidl receipt requests may pass through `accounts.lidl.com`.

That authentication site uses a `frame-ancestors` policy that prevents it from loading inside the Lidl page's iframe.

A top-level popup avoids that restriction without bypassing authentication.

The same popup is reused for every receipt.

## Stable-document handling

Lidl may replace the popup document shortly after a `ticket-*` element first appears.

A stale DOM node can then have:

```text
ownerDocument.defaultView === null
```

Calling `getComputedStyle()` on such nodes fails.

The exporter therefore:

- waits briefly after the ticket appears;
- checks that the active popup document has not changed;
- checks that the ticket remains connected;
- waits briefly for fonts;
- checks the document again;
- retries capture when a detached document is detected.

## Receipt body

The receipt body is read from its `<pre>` element.

Text nodes are traversed while their computed:

- colour;
- font weight;
- relative font size;
- vertical scale

are recorded.

The PDF body uses built-in Courier / Courier-Bold fonts to preserve the fixed-width receipt grid.

## Centring

The widest logical line determines the width of the receipt grid.

The entire grid is centred on an 80 mm PDF page rather than using a fixed left margin.

## Logo

The Lidl logo is not stored in the repository.

At runtime the exporter finds the logo element already referenced by the receipt, fetches the same Lidl-hosted asset using the current browser session, removes surrounding whitespace, and embeds the result in the PDF.

## Marketing/footer text

Non-monospace elements such as the receipt heading and footer/marketing messages are rasterised separately using their computed browser font styles and embedded as JPEG image objects.

## Barcode

The exporter supports numeric ITF reconstruction.

For Italy and Greece, the receipt may expose an alphanumeric or URL-valued `bottom-barcode-*` identifier that is not itself an ITF value. The exporter therefore scans all numeric `bottom-barcode-*` and `*-ITF` identifiers before using a numeric `data-return-code` fallback.

For the UK, a numeric `data-return-code` may be used as a fallback.

## Dates

Supported text patterns currently include:

UK:

```text
Date: DD/MM/YY
```

Italy:

```text
DD-MM-YYYY HH:MM
DATA DD/MM/YY
```

Greece:

```text
DD.MM.YY HH:MM
HM/NIA:YYYY/MM/DD
```

Greek receipt bodies contain Unicode text that cannot be represented by the PDF base fonts used for the ASCII/Latin vector path. When the receipt body contains non-ASCII characters, it is rasterized with the browser's loaded receipt font and embedded as a JPEG image instead.

If text parsing fails, the exporter searches the Lidl transaction identifier for a plausible `YYYYMMDD` sequence.

## ZIP generation

The project contains a minimal ZIP writer using uncompressed STORE entries plus CRC32.

This avoids external dependencies and CDN restrictions.

## Historical cutoff

The exporter only stops early when three consecutive receipt detail pages fail to expose the expected `ticket-*` element.

Processing/rendering exceptions do not count towards this cutoff.

## Compatibility strategy

This project depends on undocumented frontend details.

Selectors and behaviour should therefore be treated as compatibility code rather than a stable API.
