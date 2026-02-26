import express from "express";
import { getToken, validateToken } from "@navikt/oasis";
const app = express();

// Redirect må komme FØR static middleware
app.get("/", async (req, res) => {
  const token = getToken(req);
  if (!token) {
    res.redirect(`/feilmelding`);
  }
  const validation = await validateToken(token);
  if (!validation.ok) {
    res.redirect(`/feilmelding`);
  }
  res.redirect(`/success`);
});

// Mount static files på /feilmelding path
app.use("/feilmelding", express.static("dist/feilmelding"));

app.use("/success", express.static("dist/success"));

// Start serveren bare hvis filen kjøres direkte (ikke under test)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
  console.log(`Server is running on port ${PORT}`);
}

// Eksporter app for testing
export default app;
