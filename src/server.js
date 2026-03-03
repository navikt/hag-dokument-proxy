import express from "express";
import { getToken, validateToken, requestOboToken } from "@navikt/oasis";
import { fileURLToPath } from "node:url";
import {
  buildCspHeader,
  injectDecoratorServerSide,
} from "@navikt/nav-dekoratoren-moduler/ssr/index.js";

const app = express();

const API_BASEPATH = process.env.API_BASEPATH || "";
const AUDIENCE = process.env.AUDIENCE || "";
const GYLDIG_TYPE = new Set(["sykmelding", "soknad"]);

// Redirect må komme FØR static middleware
app.get("/hent-dokument/:dokumentType/:dokumentId.pdf", async (req, res) => {
  const dokumentId = req.params.dokumentId;
  const dokumentType = req.params.dokumentType;

  if (!GYLDIG_TYPE.has(dokumentType)) {
    return res.redirect(`/feilmelding`);
  }

  if (!dokumentId) {
    return res.redirect(`/feilmelding`);
  }

  const token = getToken(req);
  if (!token) {
    return res.redirect(`/feilmelding`);
  }
  const validation = await validateToken(token);
  if (!validation.ok) {
    return res.redirect(`/feilmelding`);
  }

  const obo = await requestOboToken(token, AUDIENCE);
  if (!obo.ok) {
    /* håndter obo-feil */
    // eslint-disable-next-line no-undef
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
    console.error(
      `Feil ved henting av dokument: ${data.status} ${data.statusText}`,
    );
    return res.redirect(`/feilmelding`);
  }

  res.contentType("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${dokumentType}-${dokumentId}.pdf"`,
  );
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`Serverer dokument ${dokumentType}-${dokumentId}.pdf`);
  console.log(`Dokumentstørrelse: ${buffer.length} bytes`);

  res.status(data.status);
  res.send(buffer);
});

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
      console.error("Server: SSR error", error);
      res.status(500).send("500 Error");
    });
});

app.use("/success", express.static("dist/success"));

// Start serveren bare hvis filen kjøres direkte (ikke under test)
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
  console.log(`Server is running on port ${PORT}`);
}

// Eksporter app for testing
export default app;
