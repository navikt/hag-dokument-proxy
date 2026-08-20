import { logger } from "@navikt/pino-logger";
import { validerDialogToken } from "./dialogToken.js";
import { validate } from "uuid";

const DIALOG_FCE_BASEPATH = process.env.DIALOG_FCE_BASEPATH || "";

export default async function settTransmissionLest(token, transmissionId) {
  const validation = await validerDialogToken(token);
  if (!validation.ok) {
    logger.error(`Ugyldig dialogtoken for transmission ${transmissionId}`);
    return;
  }

  // henter ut dialogId fra token claim "i" ref: https://docs.altinn.studio/en/dialogporten/reference/authorization/dialog-tokens/
  const dialogId = validation.payload.i;
  if (!dialogId || !validate(dialogId)) {
    logger.error(
      `FCE-forespørsel mottatt med ugyldig dialogId:${dialogId} i dialog token for transmission ${transmissionId}`,
    );
    return;
  }

  const url = new URL(`${DIALOG_FCE_BASEPATH}/transmission-lest`);
  url.searchParams.set("dialogId", dialogId);
  url.searchParams.set("transmissionId", transmissionId);

  try {
    const response = await fetch(url, { method: "PUT" });
    if (!response.ok) {
      logger.error(
        `Feil ved kall til dialog-appen for å sette transmission lest (${url}): ${response.status} ${response.statusText}`,
      );
      return;
    }
    logger.info(`Kalte dialog-appen for å sette transmission lest: ${url}`);
  } catch (error) {
    logger.error(
      `Feil ved kall til dialog-appen for å sette transmission lest (${url}): ${error.message}`,
    );
  }
}

export function setFceCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}
