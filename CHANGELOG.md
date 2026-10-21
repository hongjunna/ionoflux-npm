# Changelog

## 0.1.4 — Unreleased

- Point the npm Homepage to the official Node.js SDK guide and link its English/Korean pages from the README.
- Update SDK version and request-origin tags to 0.1.4; the API surface is unchanged.

## 0.1.3 — 2026-10-21

First Node.js release, aligned with the Python 0.1.3 API surface.

- Promise-based Node.js 22+ client with ESM, CommonJS and TypeScript declarations; no runtime dependencies.
- Space weather, solar/geomagnetic series, statistics, alerts, public sources/status, ionosphere, propagation and reception observations.
- Local validation, UTC inputs, lossless response bytes, safe quota metadata, stable error classes and bounded retries.
- Missing-key issuance link, fixed SDK request tags, redirect refusal and secret-safe error handling.

Model predictions and reception observations retain their distinct meanings and provider attribution. This release supports Node.js; browser applications must keep Server API keys on a backend.
