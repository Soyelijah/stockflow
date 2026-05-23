/**
 * Chilean RUT (Rol Único Tributario) validation library.
 *
 * The Chilean RUT is a national identification number formatted as:
 *   XX.XXX.XXX-Y    where Y is a check digit (0-9 or "K")
 *
 * The check digit is computed via the módulo 11 algorithm:
 *   1. Walk the body digits right-to-left, multiplying by 2,3,4,5,6,7,2,3,...
 *   2. Sum the products.
 *   3. Compute (11 - (sum mod 11)).
 *   4. If 11 → "0", if 10 → "K", else stringify.
 *
 * Pure functions only. No I/O. Fully unit-testable.
 */

export type RutValidationResult = {
  valid: boolean;
  /** Body digits without dots/hyphen, e.g. "12345678" */
  body: string;
  /** Provided check digit normalized (uppercase, e.g. "K") */
  dv: string;
  /** Check digit computed from body, for comparison */
  calculatedDv: string;
  /** Compact form: "12345678-K" */
  normalized: string;
  /** Human form: "12.345.678-K" */
  formatted: string;
  /** Empty if valid; otherwise a short Spanish reason */
  reason?: string;
};

const RUT_BODY_REGEX = /^\d{1,8}$/;
const RUT_DV_REGEX = /^[0-9K]$/;

/**
 * Strip dots, hyphens, spaces and uppercase the K. Does NOT validate.
 * Returns the bare alphanumeric form, e.g. "12345678K".
 */
export function stripFormatting(raw: string): string {
  return raw.replace(/[.\s\-]/g, "").toUpperCase();
}

/**
 * Compute the módulo 11 check digit for the body of a RUT.
 * @param body String of 1-8 digits (no separators, no DV).
 * @returns Check digit as a single character: "0"-"9" or "K".
 * @throws If body contains non-digit characters or is empty / too long.
 */
export function calculateDv(body: string): string {
  if (!RUT_BODY_REGEX.test(body)) {
    throw new Error(`Invalid RUT body: "${body}" — must be 1 to 8 digits, no separators.`);
  }

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

/**
 * Validate a Chilean RUT in any common format.
 * Accepts: "12.345.678-K", "12345678-K", "12345678K", "12.345.678K", etc.
 *
 * @param raw Raw RUT string.
 * @returns Structured validation result. Always returns; never throws on bad input.
 */
export function validateRut(raw: string): RutValidationResult {
  const empty = {
    valid: false,
    body: "",
    dv: "",
    calculatedDv: "",
    normalized: "",
    formatted: ""
  };

  if (typeof raw !== "string" || raw.trim() === "") {
    return { ...empty, reason: "RUT vacío o no es texto." };
  }

  const bare = stripFormatting(raw);
  if (bare.length < 2) {
    return { ...empty, reason: "RUT demasiado corto (mínimo cuerpo + DV)." };
  }
  if (bare.length > 9) {
    return { ...empty, reason: "RUT demasiado largo (máximo 8 dígitos + DV)." };
  }

  const body = bare.slice(0, -1);
  const dv = bare.slice(-1);

  if (!RUT_BODY_REGEX.test(body)) {
    return { ...empty, body, dv, reason: "Cuerpo del RUT contiene caracteres no numéricos." };
  }
  if (!RUT_DV_REGEX.test(dv)) {
    return { ...empty, body, dv, reason: "Dígito verificador inválido (debe ser 0-9 o K)." };
  }

  const calculatedDv = calculateDv(body);
  const valid = calculatedDv === dv;

  return {
    valid,
    body,
    dv,
    calculatedDv,
    normalized: `${body}-${dv}`,
    formatted: formatRut(body, dv),
    ...(valid ? {} : { reason: `DV no coincide (esperado: ${calculatedDv}, recibido: ${dv}).` })
  };
}

/**
 * Format a RUT body+dv as "XX.XXX.XXX-Y".
 * Does NOT validate the DV.
 */
export function formatRut(body: string, dv: string): string {
  const rev = body.split("").reverse().join("");
  const grouped = (rev.match(/.{1,3}/g) ?? []).join(".");
  return `${grouped.split("").reverse().join("")}-${dv}`;
}

/**
 * Normalize a RUT to compact form: "12345678-K".
 * Throws if the input cannot be parsed; use validateRut() for graceful handling.
 */
export function normalizeRut(raw: string): string {
  const result = validateRut(raw);
  if (!result.valid) {
    throw new Error(result.reason ?? "RUT no procesable.");
  }
  return result.normalized;
}
