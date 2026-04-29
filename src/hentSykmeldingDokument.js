import { requestOboToken } from "@navikt/oasis";
import { logger } from "@navikt/pino-logger";

const API_BASEPATH = process.env.API_BASEPATH || "";
const AUDIENCE = process.env.AUDIENCE || "";

export async function hentSykmeldingDokument(token, dokumentType, dokumentId) {
  const obo = await requestOboToken(token, AUDIENCE);
  if (!obo.ok) {
    logger.error(`Feil ved henting av OBO-token med audience ${AUDIENCE}`);
    return { ok: false, redirect: "/feilmelding" };
  }

  const data = await fetch(
    `${API_BASEPATH}/${dokumentType}/${dokumentId}/pdf`,
    {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${obo.token}`,
      },
    },
  );

  if (!data.ok) {
    logger.error(`Feil ved henting av ${dokumentType} med ID ${dokumentId}: ${data.status} ${data.statusText}`);
    if (data.status === 404) return { ok: false, redirect: "/404" };
    if (data.status === 403) return { ok: false, redirect: "/403" };
    if (data.status === 401) return { ok: false, redirect: "/403" };
    return { ok: false, redirect: "/feilmelding" };
  }

  return { ok: true, data };
}
