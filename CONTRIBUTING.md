# Contributing

Thanks for considering a contribution.

## Before opening an issue

Please check the existing issues first.

For bugs, include:

- Lidl site: UK or Italy;
- browser and version;
- approximate receipt date;
- the exporter's own Console messages around the failure;
- whether a popup/authentication redirect occurred;
- whether the failure is isolated or happens for several consecutive receipts.

Do **not** post an unredacted transaction URL.

## Redaction

Before sharing logs or screenshots, remove:

- transaction IDs;
- account identifiers;
- payment-card details;
- names and addresses;
- barcodes;
- receipt PDFs containing personal information;
- authentication/session data.

## Pull requests

Keep changes focused and explain why they are necessary.

Please preserve the project's current safety properties:

- no credential collection;
- no telemetry;
- no remote script loading;
- no account enumeration;
- no authentication bypass;
- no high-concurrency scraping;
- no access to data outside the signed-in account.

## Code style

The exporter intentionally remains a single browser-console JavaScript file with no build step.

Before submitting:

```bash
node --check lidl-receipt-exporter.js
```

The same check runs automatically in GitHub Actions.

## Adding another Lidl country

A new country should only be added when its web interface has been tested.

At minimum verify:

1. purchase-history URL parameters;
2. purchase-detail route;
3. receipt `ticket-*` selector;
4. date format;
5. logo location;
6. barcode representation;
7. marketing/footer structure;
8. authentication behaviour.

Avoid assuming that another country behaves identically to UK or Italy.

## Documentation

If behaviour changes, update:

- `README.md`;
- `CHANGELOG.md`;
- `docs/TECHNICAL_NOTES.md`;
- `docs/TROUBLESHOOTING.md` where relevant.
