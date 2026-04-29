import express from "express";
import { getToken, validateToken } from "@navikt/oasis";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { logger } from "@navikt/pino-logger";
import { validate } from "uuid";
import { hentSykmeldingDokument } from "./hentSykmeldingDokument.js";
import { hentFritakagpDokument, FRITAKAGP_TYPE } from "./hentFritakagpDokument.js";

const app = express();
app.disable("x-powered-by");

const GYLDIG_TYPE = new Set(["sykmelding", "sykepengesoeknad"]);
const BASE_PATH = "/dokument";
let decoratorModulePromise;

function getDecoratorEnv() {
  return (
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev")
  );
}

async function getDecoratorModule() {
  if (!decoratorModulePromise) {
    decoratorModulePromise = import(
      "@navikt/nav-dekoratoren-moduler/ssr/index.js",
    ).catch((error) => {
      decoratorModulePromise = undefined;
      throw error;
    });
  }
  return decoratorModulePromise;
}

async function renderDecoratedPage(res, filePath, statusCode = 200) {
  const env = getDecoratorEnv();
  const params = { context: "arbeidsgiver" };

  try {
    const { injectDecoratorServerSide, buildCspHeader } =
      await getDecoratorModule();
    const html = await injectDecoratorServerSide({ env, filePath, params });
    const csp = buildCspHeader({}, { env, params });
    res.setHeader("Content-Security-Policy", csp);
    res.status(statusCode).send(html);
  } catch (error) {
    logger.error("Server: SSR error, falling back to plain HTML", error);
    res.status(statusCode).sendFile(filePath, { root: process.cwd() }, (err) => {
      if (err) {
        logger.error("Server: sendFile error", err);
        if (!res.headersSent) {
          res.status(500).send("500 Error");
        }
      }
    });
  }
}

app.use(`${BASE_PATH}/assets`, express.static("dist/assets"));

app.use(`${BASE_PATH}/feilmelding`, (_req, res) =>
  renderDecoratedPage(res, "dist/feilmelding/index.html"),
);
app.use(`${BASE_PATH}/404`, (_req, res) =>
  renderDecoratedPage(res, "dist/404/index.html", 404),
);
app.use(`${BASE_PATH}/403`, (_req, res) =>
  renderDecoratedPage(res, "dist/403/index.html", 403),
);
app.use(`${BASE_PATH}/ugyldig`, (_req, res) =>
  renderDecoratedPage(res, "dist/ugyldig/index.html", 400),
);

app.get(`${BASE_PATH}/:dokumentType/:dokumentId.pdf`, async (req, res) => {
  const { dokumentId, dokumentType } = req.params;

  if (!dokumentId || !validate(dokumentId)) {
    return res.redirect(`${BASE_PATH}/ugyldig`);
  }

  const isSykepenger = GYLDIG_TYPE.has(dokumentType);
  const isFritakagp = FRITAKAGP_TYPE.has(dokumentType);

  if (!isSykepenger && !isFritakagp) {
    return res.redirect(`${BASE_PATH}/ugyldig`);
  }

  const token = getToken(req);
  if (!token) {
    return res.redirect(`${BASE_PATH}/feilmelding`);
  }

  const validation = await validateToken(token);
  if (!validation.ok) {
    logger.error("Ugyldig token");
    return res.redirect(`${BASE_PATH}/feilmelding`);
  }

  let result;
  if (isSykepenger) {
    result = await hentSykmeldingDokument(token, dokumentType, dokumentId);
  } else if (isFritakagp) {
    result = await hentFritakagpDokument(token, dokumentType, dokumentId);
  }

  if (!result.ok) {
    return res.redirect(`${BASE_PATH}${result.redirect}`);
  }

  const { data } = result;

  logger.info(`Serverer dokument ${dokumentType}-${dokumentId}.pdf`);

  res.status(data.status ?? 200);
  res.contentType("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${dokumentType}-${dokumentId}.pdf"`,
  );

  if (data.headers.get("content-length")) {
    res.setHeader("Content-Length", data.headers.get("content-length"));
  }

  Readable.fromWeb(data.body).pipe(res);
});

app.use((req, _res, next) => {
  logger.info("Server: Error 404", req.url);
  next();
});

app.use((_req, res) => renderDecoratedPage(res, "dist/404/index.html", 404));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error("Server: Error 500", err);
  renderDecoratedPage(res, "dist/500/index.html", 500);
});

// Start serveren bare hvis filen kjøres direkte (ikke under test)
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
  logger.info(`Server is running on port ${PORT}`);
}

// Eksporter app for testing
export default app;
