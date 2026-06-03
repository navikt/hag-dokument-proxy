import { logger } from "@navikt/pino-logger";

const PDFGEN_BASEPATH = process.env.PDFGEN_BASEPATH || "";

export async function hentFraPdfgen(pdfgenEndpoint, jsonData, retry = true) {
  const url = `${PDFGEN_BASEPATH}${pdfgenEndpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonData),
  });

  if (!response.ok) {
    if (retry) {
      return hentFraPdfgen(pdfgenEndpoint, jsonData, false);
    }
    logger.error(
      `Feil ved generering av PDF fra pdfgen (${url}): ${response.status} ${response.statusText}`,
    );
  }

  return response;
}
