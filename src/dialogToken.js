import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "@navikt/pino-logger";

const DIALOGPORTEN_JWKS_URI = process.env.DIALOGPORTEN_JWKS_URI || "";
const DIALOGPORTEN_ISSUER = process.env.DIALOGPORTEN_ISSUER || "";

let jwksPromise;

// JWK endepunkt dokumentert her https://docs.altinn.studio/en/dialogporten/reference/authorization/dialog-tokens/#well-known-endpoints
function getJwks() {
  if (!jwksPromise) {
    jwksPromise = createRemoteJWKSet(new URL(DIALOGPORTEN_JWKS_URI));
  }
  return jwksPromise;
}

/**
 * Verifiserer signaturen til et dialogtoken utstedt av Dialogporten mot
 * nøkkelsettet publisert på JWKS-endepunktet, og returnerer innholdet i
 * tokenet ved gyldig signatur.
 *
 * @param token Dialogtoken hentet fra Authorization-headeren.
 */
// Bruker EdDSA ref: https://docs.altinn.studio/en/dialogporten/reference/authorization/dialog-tokens/#token-signature-cipher
export async function validerDialogToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["EdDSA"],
      issuer: DIALOGPORTEN_ISSUER,
    });
    return { ok: true, payload };
  } catch (error) {
    logger.error(`Feil ved verifisering av dialogtoken: ${error.message}`);
    return { ok: false, error: "Noe gikk galt" };
  }
}
