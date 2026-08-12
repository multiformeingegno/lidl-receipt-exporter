# Privacy

## Summary

Lidl Receipt Exporter is designed to process receipt data locally in the browser.

The project does not include:

- analytics;
- telemetry;
- a project-operated server;
- a user database;
- tracking pixels;
- advertising code;
- third-party JavaScript dependencies.

## Data processed

While running, the exporter may read information that is already visible to your authenticated Lidl session, including:

- receipt dates;
- store information;
- purchased items;
- prices and discounts;
- payment-related receipt text;
- receipt transaction identifiers;
- barcode values;
- Lidl-provided receipt branding and footer text.

This information is used to construct the PDFs you request.

## Network activity

The exporter navigates to Lidl purchase-history and purchase-detail pages using your existing authenticated browser session.

It may also fetch a Lidl-hosted logo image from the same Lidl website so that it can be embedded in the generated PDF.

The exporter does not intentionally send receipt data to the project maintainer or to a project-controlled service.

Normal browser/Lidl requests remain subject to Lidl's own privacy practices.

## Files created

Generated PDF files and the final ZIP are created in browser memory and downloaded to your device.

The project itself does not retain a copy.

## Logs

Progress and errors are written to the browser Console.

If you share Console logs in a public issue, inspect and redact them first. URLs may contain transaction identifiers.

## Sensitive information

Do not publish:

- Lidl authentication cookies;
- passwords;
- session tokens;
- receipt transaction IDs unless appropriately redacted;
- payment-card details;
- names, addresses or other personal data from receipts;
- unredacted receipt PDFs or screenshots.

## Changes

If future versions add any analytics, remote service, storage or additional network destinations, this document should be updated before release.
