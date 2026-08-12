# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and the project uses semantic-style version numbers.

## [1.0.0] - 2026-08-12

### Added

- Unified Lidl UK and Lidl Italy support.
- Automatic site detection.
- Purchase-history pagination.
- PDF reconstruction with centred monospace receipt layout.
- Preservation of basic receipt colour and bold styling.
- Runtime Lidl logo retrieval and whitespace cropping.
- UK and Italian receipt date parsing.
- Duplicate-date filename handling.
- Numeric ITF barcode recreation where available.
- Italian `bottom-barcode-*` handling.
- Reusable popup processing for receipt pages.
- Support for authentication redirects through `accounts.lidl.com`.
- Stable-document checks to avoid detached popup DOM errors.
- Automatic retries when Lidl replaces a receipt document during capture.
- Three-consecutive-missing-ticket historical cutoff.
- Self-contained ZIP generation without third-party libraries.
