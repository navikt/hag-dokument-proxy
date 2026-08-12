import { logger } from "@navikt/pino-logger";
import { validerDialogToken } from "./dialogToken.js";

const DIALOG_FCE_BASEPATH = process.env.DIALOG_FCE_BASEPATH || "";

export default async function settTransmissionLest(
  token,
  dialogId,
  transmissionId,
) {
  const validation = await validerDialogToken(token);
  if (!validation.ok) {
    logger.error(`Ugyldig dialogtoken for dialog:${dialogId}`);
    return;
  }

  // henter ut dialogId fra token claim "i" ref: https://docs.altinn.studio/en/dialogporten/reference/authorization/dialog-tokens/
  const tokenDialogId = validation.payload.i;
  if (tokenDialogId !== dialogId) {
    logger.error(
      `dialogId mottatt (${dialogId}) samsvarer ikke med dialogId i dialogtoken (${tokenDialogId})`,
    );
    return;
  }

  const url = new URL(`${DIALOG_FCE_BASEPATH}/sett-transmission-lest`);
  url.searchParams.set("dialogId", dialogId);
  url.searchParams.set("transmissionId", transmissionId);

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      logger.error(
        `Feil ved kall til dialog-appen for å sette transmission lest (${url}): ${response.status} ${response.statusText}`,
      );
      return;
    }
    logger.info(`Kalte dialog-appen for å sette transmission lest: ${url}`);
  } catch (error) {
    logger.error(
      `Feil ved kall til dialog-appen for å sette transmission lest (${url}): ${error}`,
    );
  }
}

// const FCE_ALLOWED_HEADERS = [
//   "Accept-Language",
//   "Prefer",
//   "Authorization",
//   "Content-Type",
// ].join(", ");

export function setFceCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
}
