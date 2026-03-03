import express from "express";
import { getToken, validateToken } from "@navikt/oasis";
import { fileURLToPath } from "node:url";
import {
  buildCspHeader,
  injectDecoratorServerSide,
} from "@navikt/nav-dekoratoren-moduler/ssr/index.js";

const app = express();

// Redirect må komme FØR static middleware
app.get("/", async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.redirect(`/feilmelding`);
  }
  const validation = await validateToken(token);
  if (!validation.ok) {
    return res.redirect(`/feilmelding`);
  }
  res.redirect(`/success`);
});

// Mount static files på /feilmelding path
app.use("/feilmelding", function (req, res) {
  injectDecoratorServerSide({
    env: "prod",
    filePath: "dist/feilmelding/index.html",
    params: { context: "arbeidsgiver" },
  })
    .then((html) => {
      const csp = buildCspHeader(
        {},
        {
          env: "prod",
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
