# Troubleshooting

## The script says the popup was blocked

Allow pop-ups for the current Lidl domain, then run the exporter again.

The exporter intentionally uses one reusable popup because Lidl authentication may redirect through `accounts.lidl.com`, which cannot be embedded in an iframe.

## I see `frame-ancestors 'self'`

An older iframe-based version of the exporter could trigger:

```text
Framing 'https://accounts.lidl.com/' violates ... frame-ancestors 'self'
```

The current unified exporter avoids this by using a top-level receipt-processing window.

## I see `getComputedStyle` / `defaultView` errors

Older popup versions could occasionally capture a receipt while Lidl was replacing the popup document.

The current exporter verifies that the DOM is still attached to the active popup document and retries automatically.

A retry message such as this is expected:

```text
Receipt 18: document changed during capture; retrying...
```

## I see `cdn.cookielaw.org ... ERR_NAME_NOT_RESOLVED`

This is usually unrelated to PDF creation.

Judge success using the exporter's own progress messages.

## I see `/mlap/web/assets/... 404`

Lidl's frontend may request assets that return 404 while the receipt itself still renders successfully.

Again, use the exporter's `✓` or `✗` messages rather than treating every browser-network error as fatal.

## The exporter stops after three missing receipts

This is intentional.

Some historical transactions remain in purchase history even when the current Lidl frontend no longer exposes a renderable receipt.

After three consecutive detail pages fail to provide a `ticket-*` element, the exporter assumes it has reached such a historical boundary and creates the ZIP from everything exported successfully so far.

## One receipt fails but later receipts work

The three-receipt cutoff applies only to genuinely missing ticket pages.

Isolated processing failures are logged and the exporter continues.

If an isolated receipt consistently fails, open an issue with a redacted Console extract.

## The ZIP contains fewer receipts than purchase history

Possible causes include:

- historical receipt detail no longer available;
- isolated frontend/rendering failures;
- browser extensions interfering with popups;
- authentication/session expiry;
- Lidl changing the receipt DOM;
- the processing window being closed manually.

## The filename is `unknown-date_lidl-receipt.pdf`

The exporter first tries to read the date from the receipt text and then falls back to the transaction identifier.

If both fail, it cannot safely infer a date.

## Multiple receipts have the same date

They are named:

```text
2026_08_01_lidl-receipt.pdf
2026_08_01_lidl-receipt_2.pdf
2026_08_01_lidl-receipt_3.pdf
```

## The PDF does not look exactly like Lidl's screen

The PDF is reconstructed from the receipt DOM rather than using the browser's native Print-to-PDF function.

This allows unattended bulk export but means there may be small visual differences.

## The Lidl logo is missing

Check whether the Console contains:

```text
Could not load logo
```

The logo is loaded from Lidl's own receipt page at runtime and is not bundled in this repository.

## Browser freezes or export takes a long time

The exporter processes receipts sequentially to avoid aggressive load on Lidl systems.

Large histories can therefore take several minutes.

Do not run multiple exporters simultaneously.
