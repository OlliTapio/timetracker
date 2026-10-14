# 2. TypeScript, with Win32 sampling through koffi

Date: 2026-10-14 · Status: accepted

## Context

The first version was Python, with `ctypes` for the Win32 calls. The author's other projects
(supaslot) are TypeScript with a strict lint and test gate built for agent-written code, and
the MCP TypeScript SDK is first-party. The open question was how a Node program reads the
foreground window, the window under the cursor and idle time.

## Decision

- Rewrite in TypeScript on Node 24, which runs `.ts` sources directly; there is no build step.
- Sample through [koffi](https://koffi.dev), an FFI library that ships prebuilt binaries, so
  `src/infra/sampler.ts` declares the eight Win32 functions it needs, as the Python did, with
  no compiler or node-gyp.
- The sampler is a function behind the `Sampler` type; everything else is tested with a fake.

Rejected:

- `get-windows` (npm): only the focused window; no window under the cursor, no idle time.
- A Node-API addon in C++ or Rust: a second toolchain for about 80 lines of API calls.
- A sidecar binary (Rust, Go or C#) streaming JSON lines: clean, but a second language.
  Worth revisiting if sampling ever needs more than API calls (e.g. UI Automation).
- PowerShell per sample: around 300 ms to start, every 5 seconds.

## Consequences

One language and one gate. The sampler is the only Windows-only module; it is excluded from
the coverage gate and smoke-tested on the Windows CI runner.
