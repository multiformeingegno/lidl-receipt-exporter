# Security Policy

## Scope

Lidl Receipt Exporter runs JavaScript inside an authenticated Lidl browser session. Bugs that expose, transmit or mishandle authenticated data are therefore considered security-sensitive.

Examples include:

- sending receipt data to an unexpected third-party domain;
- exposing authentication cookies or tokens;
- opening attacker-controlled URLs;
- executing remote code not present in the repository;
- processing data from an account other than the signed-in user's account;
- unsafe handling of generated files.

## Reporting a vulnerability

If the repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**.

Please do not publish a security issue containing live credentials, cookies, session tokens, transaction identifiers, payment information or unredacted receipts.

If private reporting is not available, open a minimal public issue stating that you have found a security problem, without including sensitive details.

## Safe testing

When testing changes:

- use only accounts and receipt data you are authorised to access;
- do not test against other users' accounts;
- do not bypass authentication;
- do not increase request concurrency aggressively;
- do not publish live session data;
- redact screenshots and logs.

## Dependencies

The current exporter is self-contained and does not load third-party JavaScript dependencies at runtime.

The GitHub workflow only runs a Node.js syntax check against the source file.
