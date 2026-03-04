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

// Redirect må komme FØR static middleware
app.get("/hent-dokument/:dokumentType/:dokumentId.pdf", async (req, res) => {
  const dokumentId = req.params.dokumentId;
  const dokumentType = req.params.dokumentType;

  if (!GYLDIG_TYPE.has(dokumentType)) {
    return res.redirect(`/ugyldig`);
  }

  if (!dokumentId || !validate(dokumentId)) {
    return res.redirect(`/ugyldig`);
  }

  const token = getToken(req);
  if (!token) {
    return res.redirect(`/feilmelding`);
  }
  const validation = await validateToken(token);
  if (!validation.ok) {
    logger.error("Ugyldig token");
    return res.redirect(`/feilmelding`);
  }

  const obo = await requestOboToken(token, AUDIENCE);
  if (!obo.ok) {
    logger.error("Feil ved henting av OBO-token med audience " + AUDIENCE);
    return res.redirect(`/feilmelding`);
  }

  // eslint-disable-next-line no-undef
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
    /* håndter feil ved henting av dokument */
    // eslint-disable-next-line no-undef
    logger.error(
      `Feil ved henting av dokument: ${data.status} ${data.statusText}`,
    );
    if (data.status === 404) {
      return res.redirect(`/404`);
    }
    if (data.status === 403) {
      return res.redirect(`/403`);
    }
    return res.redirect(`/feilmelding`);
  }

  res.contentType("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${dokumentType}-${dokumentId}.pdf"`,
  );
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.info(`Serverer dokument ${dokumentType}-${dokumentId}.pdf`);
  logger.info(`Dokumentstørrelse: ${buffer.length} bytes`);

  res.status(data.status);
  res.send(buffer);
});

app.use("/assets", express.static("dist/assets"));

// Mount static files på /feilmelding path
app.use("/feilmelding", function (_req, res) {
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/feilmelding/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use("/404", function (_req, res) {
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/404/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.status(404);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use("/403", function (_req, res) {
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/403/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.status(403);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use("/ugyldig", function (_req, res) {
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/ugyldig/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.status(400);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use(function (req, res) {
  // eslint-disable-next-line no-undef
  logger.info("Server: Error 404", req.url);
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/404/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.status(404);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use(function (err, req, res) {
  // eslint-disable-next-line no-undef
  logger.error("Server: Error 500", err);
  const env =
    process.env.NEXT_PUBLIC_DECORATOR_ENV ??
    (process.env.NAIS_CLUSTER_NAME === "prod-gcp" ? "prod" : "dev");

  injectDecoratorServerSide({
    env,
    filePath: "dist/404/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env,
          params: { context: "arbeidsgiver" },
        },
      );
      res.setHeader("Content-Security-Policy", csp);
      res.send(html);
    })
    .catch((error) => {
      // eslint-disable-next-line no-undef
      logger.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
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
