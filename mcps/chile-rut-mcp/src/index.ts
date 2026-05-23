#!/usr/bin/env node
/**
 * chile-rut-mcp — MCP server for Chilean RUT validation tools.
 *
 * Transport: stdio (designed to run as a local subprocess from Claude Code).
 *
 * Tools exposed:
 *   - rut_validate         Full structured validation of any RUT.
 *   - rut_format           Format a body+DV pair as XX.XXX.XXX-Y.
 *   - rut_normalize        Strip formatting to compact "12345678-K" form.
 *   - rut_calculate_dv     Compute the check digit for a given body.
 *   - rut_batch_validate   Validate many RUTs at once (1-1000).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { calculateDv, formatRut, validateRut, normalizeRut } from "./rut.js";

const server = new Server(
  { name: "chile-rut-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ---------- Input schemas ----------

const SingleRutSchema = z.object({
  rut: z.string().min(2).max(20).describe(
    "RUT chileno en cualquier formato común: '12.345.678-K', '12345678-K', '12345678K'."
  )
});

const FormatSchema = z.object({
  body: z.string().regex(/^\d{1,8}$/).describe("Cuerpo del RUT: 1 a 8 dígitos, sin separadores ni DV."),
  dv: z.string().regex(/^[0-9Kk]$/).describe("Dígito verificador: 0-9 o K.")
});

const CalculateDvSchema = z.object({
  body: z.string().regex(/^\d{1,8}$/).describe("Cuerpo del RUT sin DV (1-8 dígitos).")
});

const BatchSchema = z.object({
  ruts: z.array(z.string()).min(1).max(1000).describe(
    "Lista de RUTs en cualquier formato. Máximo 1000 por llamada."
  )
});

// ---------- Tool definitions ----------

const tools = [
  {
    name: "rut_validate",
    description:
      "Valida un RUT chileno completo. Acepta formato con o sin puntos/guion. Devuelve estructura con valid, body, dv calculado vs recibido, normalizado y formateado.",
    inputSchema: {
      type: "object",
      properties: {
        rut: { type: "string", description: "RUT en cualquier formato común." }
      },
      required: ["rut"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "rut_format",
    description:
      "Formatea un par body+DV como 'XX.XXX.XXX-Y'. NO valida el DV — usá rut_validate para eso.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "1-8 dígitos." },
        dv: { type: "string", description: "0-9 o K." }
      },
      required: ["body", "dv"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "rut_normalize",
    description:
      "Quita puntos, guiones y espacios; uppercase la K. Devuelve forma compacta '12345678-K'. Lanza error si el RUT no es procesable.",
    inputSchema: {
      type: "object",
      properties: {
        rut: { type: "string", description: "RUT en cualquier formato común." }
      },
      required: ["rut"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "rut_calculate_dv",
    description:
      "Calcula el dígito verificador (módulo 11) para un cuerpo de RUT. Devuelve un único carácter: '0'-'9' o 'K'.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Cuerpo del RUT sin DV (1-8 dígitos)." }
      },
      required: ["body"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "rut_batch_validate",
    description:
      "Valida múltiples RUTs en una sola llamada (1-1000). Útil para auditar listas de clientes. Devuelve array con un resultado por entrada en el mismo orden.",
    inputSchema: {
      type: "object",
      properties: {
        ruts: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 1000,
          description: "Lista de RUTs."
        }
      },
      required: ["ruts"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
];

// ---------- Handlers ----------

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "rut_validate": {
        const { rut } = SingleRutSchema.parse(args);
        const result = validateRut(rut);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      }

      case "rut_format": {
        const { body, dv } = FormatSchema.parse(args);
        const formatted = formatRut(body, dv.toUpperCase());
        return {
          content: [{ type: "text", text: formatted }],
          structuredContent: { formatted }
        };
      }

      case "rut_normalize": {
        const { rut } = SingleRutSchema.parse(args);
        try {
          const normalized = normalizeRut(rut);
          return {
            content: [{ type: "text", text: normalized }],
            structuredContent: { normalized }
          };
        } catch (e: any) {
          return {
            content: [{ type: "text", text: `Error: ${e.message}` }],
            isError: true
          };
        }
      }

      case "rut_calculate_dv": {
        const { body } = CalculateDvSchema.parse(args);
        const dv = calculateDv(body);
        return {
          content: [{ type: "text", text: dv }],
          structuredContent: { dv, body }
        };
      }

      case "rut_batch_validate": {
        const { ruts } = BatchSchema.parse(args);
        const results = ruts.map((r) => validateRut(r));
        const valid = results.filter((r) => r.valid).length;
        const summary = {
          total: results.length,
          valid,
          invalid: results.length - valid,
          results
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          structuredContent: summary
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Herramienta desconocida: ${name}` }],
          isError: true
        };
    }
  } catch (e: any) {
    const msg = e instanceof z.ZodError
      ? `Validación de entrada falló: ${JSON.stringify(e.errors)}`
      : `Error inesperado: ${e.message ?? String(e)}`;
    return {
      content: [{ type: "text", text: msg }],
      isError: true
    };
  }
});

// ---------- Entry point ----------

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("chile-rut-mcp failed to connect:", err);
  process.exit(1);
});
