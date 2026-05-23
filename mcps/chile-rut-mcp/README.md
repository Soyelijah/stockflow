# chile-rut-mcp

MCP (Model Context Protocol) server exposing Chilean RUT (Rol Único Tributario) validation and normalization tools to Claude Code.

Built for [StockFlow](../../). Pure functions, zero I/O, zero credentials, zero side effects.

---

## What is a RUT?

The Chilean **RUT** is a national identification number (also used as tax ID, "Rol Único Tributario"). Format:

```
XX.XXX.XXX-Y
└──body───┘└─ check digit (0-9 or K)
```

The check digit `Y` is computed via the **módulo 11 algorithm**:

1. Walk the body digits right-to-left, multiplying by `2, 3, 4, 5, 6, 7, 2, 3, ...`
2. Sum the products.
3. Compute `11 - (sum mod 11)`.
4. If result is `11` → `"0"`, if `10` → `"K"`, else stringify.

---

## Tools exposed

| Tool | Inputs | Output |
|---|---|---|
| `rut_validate` | `rut: string` | Structured result: `{valid, body, dv, calculatedDv, normalized, formatted, reason?}` |
| `rut_format` | `body: string, dv: string` | `"XX.XXX.XXX-Y"` |
| `rut_normalize` | `rut: string` | `"12345678-K"` compact form |
| `rut_calculate_dv` | `body: string` | Single char: `"0"-"9"` or `"K"` |
| `rut_batch_validate` | `ruts: string[]` (1-1000) | `{total, valid, invalid, results: [...]}` |

All tools are **read-only**, **idempotent**, **non-destructive** (annotations set in the tool registry).

---

## Installation in this project

The MCP is registered in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "chile-rut": {
      "command": "node",
      "args": ["./mcps/chile-rut-mcp/dist/index.js"]
    }
  }
}
```

To activate after pulling fresh:

```bash
cd mcps/chile-rut-mcp
pnpm install
pnpm build
```

Then restart Claude Code. The 5 tools become available as `mcp__chile-rut__rut_validate`, etc.

---

## Local development

```bash
# From mcps/chile-rut-mcp/
pnpm install
pnpm test        # run unit tests (no framework, plain assertions)
pnpm build       # compile to dist/
pnpm dev         # run via tsx without building
```

---

## Example usage (from Claude Code)

> _"Validá el RUT 12.345.678-5 y formatealo correctamente."_

Claude invokes `mcp__chile-rut__rut_validate` with `{rut: "12.345.678-5"}` and gets:

```json
{
  "valid": true,
  "body": "12345678",
  "dv": "5",
  "calculatedDv": "5",
  "normalized": "12345678-5",
  "formatted": "12.345.678-5"
}
```

> _"Auditá esta lista de 200 RUTs de clientes y decime cuáles son inválidos."_

Claude invokes `mcp__chile-rut__rut_batch_validate` with the full array; gets per-entry results plus an aggregate `{total, valid, invalid}` summary. No round-trips per RUT — single call.

---

## Why this MCP exists for StockFlow

StockFlow stores customer RUTs in `/customers/{docId}.rut`. Validation today is either:

- **Client-side only** (JS in the React form) — bypassed by anyone who POSTs directly to Firestore
- **Missing on server-side endpoints** (`/api/audit/log`, claim creation, etc.)

This MCP gives Claude the ability to validate RUTs as part of any audit, data-cleaning task, or analysis workflow — without baking the algorithm into the prompt every time.

---

## Algorithm reference

See `src/rut.ts` — `calculateDv()` is the canonical implementation. Tests in `tests/rut.test.ts` cover:

- Real-world RUTs (76.086.428-5, 11.111.111-1, 22.222.222-2)
- Edge case: check digit = `K` (18.765.432-K)
- Edge case: check digit = `0` (1.234.567-0)
- Single-digit bodies (9-9)
- Format variants (with/without dots, lowercase k, leading/trailing whitespace)
- Negative cases (wrong DV, non-digits, too long, empty, garbage)

Run `pnpm test` to verify.
