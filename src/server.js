import express from "express";
import { getToken, validateToken, requestOboToken } from "@navikt/oasis";
import { fileURLToPath } from "node:url";
import {
  buildCspHeader,
  injectDecoratorServerSide,
} from "@navikt/nav-dekoratoren-moduler/ssr/index.js";
import { logger } from "@navikt/pino-logger";
import { validate } from "uuid";

const app = express();

const API_BASEPATH = process.env.API_BASEPATH || "";
const AUDIENCE = process.env.AUDIENCE || "";
const GYLDIG_TYPE = new Set(["sykmelding", "soknad"]);

function getDecoratorEnv() {
  return (
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev")
  );
}

async function renderDecoratedPage(res, filePath, statusCode = 200) {
  const env = getDecoratorEnv();
  const params = { context: "arbeidsgiver" };

  try {
    const html = await injectDecoratorServerSide({ env, filePath, params });
    const csp = buildCspHeader({}, { env, params });
    res.setHeader("Content-Security-Policy", csp);
    res.status(statusCode).send(html);
  } catch (error) {
    logger.error("Server: SSR error", error);
    res.status(500).send("500 Error");
  }
}

// Redirect må komme FØR static middleware
app.get("/hent-dokument/:dokumentType/:dokumentId.pdf", async (req, res) => {
  const { dokumentId, dokumentType } = req.params;

  if (!GYLDIG_TYPE.has(dokumentType) || !dokumentId || !validate(dokumentId)) {
    return res.redirect("/ugyldig");
  }

  const token = getToken(req);
  if (!token) {
    return res.redirect("/feilmelding");
  }

  const validation = await validateToken(token);
  if (!validation.ok) {
    logger.error("Ugyldig token");
    return res.redirect("/feilmelding");
  }

  const obo = await requestOboToken(token, AUDIENCE);
  if (!obo.ok) {
    logger.error(`Feil ved henting av OBO-token med audience ${AUDIENCE}`);
    return res.redirect("/feilmelding");
  }

  const data = await fetch(
    `${API_BASEPATH}/${dokumentType}/${dokumentId}/pdf`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/pdf",
        Authorization: `Bearer ${obo.token}`,
      },
    },
  );

  if (!data.ok) {
    logger.error(
      `Feil ved henting av dokument: ${data.status} ${data.statusText}`,
    );
    if (data.status === 404) return res.redirect("/404");
    if (data.status === 403) return res.redirect("/403");
    return res.redirect("/feilmelding");
  }

  logger.info(`Serverer dokument ${dokumentType}-${dokumentId}.pdf`);

  res.status(data.status);
  res.contentType("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${dokumentType}-${dokumentId}.pdf"`,
  );

  if (data.headers.get("content-length")) {
    res.setHeader("Content-Length", data.headers.get("content-length"));
  }

  data.body.pipe(res);
});

app.use("/assets", express.static("dist/assets"));

app.use("/feilmelding", (_req, res) =>
  renderDecoratedPage(res, "dist/feilmelding/index.html"),
);
app.use("/404", (_req, res) =>
  renderDecoratedPage(res, "dist/404/index.html", 404),
);
app.use("/403", (_req, res) =>
  renderDecoratedPage(res, "dist/403/index.html", 403),
);
app.use("/ugyldig", (_req, res) =>
  renderDecoratedPage(res, "dist/ugyldig/index.html", 400),
);

app.use((req, _res, next) => {
  logger.info("Server: Error 404", req.url);
  next();
});

app.use((_req, res) => renderDecoratedPage(res, "dist/404/index.html", 404));

app.use((err, _req, res, _next) => {
  logger.error("Server: Error 500", err);
  renderDecoratedPage(res, "dist/404/index.html");
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
