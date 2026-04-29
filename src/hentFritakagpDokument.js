import { requestOboToken } from "@navikt/oasis";
import { logger } from "@navikt/pino-logger";
import { hentFraPdfgen } from "./pdfgen.js";

const FRITAKAGP_API_BASEPATH = process.env.FRITAKAGP_API_BASEPATH || "";
const FRITAKAGP_AUDIENCE = process.env.FRITAKAGP_AUDIENCE || "";

const FRITAKAGP_TYPE = new Map([
  ["gravid-soeknad", { apiPath: "/api/v1/gravid/soeknad", pdfgenPath: "/api/v1/genpdf/fritakagp/gravid-soknad" }],
  ["gravid-krav", { apiPath: "/api/v1/gravid/krav", pdfgenPath: "/api/v1/genpdf/fritakagp/gravid-krav" }],
  ["kronisk-soeknad", { apiPath: "/api/v1/kronisk/soeknad", pdfgenPath: "/api/v1/genpdf/fritakagp/kronisk-soknad" }],
  ["kronisk-krav", { apiPath: "/api/v1/kronisk/krav", pdfgenPath: "/api/v1/genpdf/fritakagp/kronisk-krav" }],
]);

export function isFritakagpType(type) {
  return FRITAKAGP_TYPE.has(type);
}

export async function hentFritakagpDokument(token, dokumentType, dokumentId) {
  const config = FRITAKAGP_TYPE.get(dokumentType);

  const obo = await requestOboToken(token, FRITAKAGP_AUDIENCE);
  if (!obo.ok) {
    logger.error(`Feil ved henting av OBO-token med audience ${FRITAKAGP_AUDIENCE}: ${obo.error}`);
    return { ok: false, redirect: "/feilmelding" };
  }

  const fritakagpUrl = `${FRITAKAGP_API_BASEPATH}${config.apiPath}/${encodeURIComponent(dokumentId)}`;
  logger.info(`Henter fritakagp-data fra ${fritakagpUrl}`);
  const jsonResponse = await fetch(
    fritakagpUrl,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${obo.token}`,
      },
    },
  );

  if (!jsonResponse.ok) {
    logger.error(
      `Feil ved henting av fritakagp-data fra ${fritakagpUrl}: ${jsonResponse.status} ${jsonResponse.statusText}`,
    );
    if (jsonResponse.status === 404) return { ok: false, redirect: "/404" };
    if (jsonResponse.status === 403) return { ok: false, redirect: "/403" };
    if (jsonResponse.status === 401) return { ok: false, redirect: "/403" };
    return { ok: false, redirect: "/feilmelding" };
  }

  const jsonData = await jsonResponse.json();

  const pdfResponse = await hentFraPdfgen(config.pdfgenPath, jsonData);

  if (!pdfResponse.ok) {
    logger.error(`Feil ved henting av PDF fra pdfgen for ${dokumentType} med ID ${dokumentId}: ${pdfResponse.status} ${pdfResponse.statusText}`);
    return { ok: false, redirect: "/feilmelding" };
  }

  return { ok: true, data: pdfResponse };
}
