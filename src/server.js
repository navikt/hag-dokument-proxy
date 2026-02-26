const express = require('express');
const app = express();

// Redirect må komme FØR static middleware
app.get("/", (req, res) => {
  res.redirect(`/feilmelding`);
});

// Mount static files på /feilmelding path
app.use('/feilmelding', express.static('feilmelding'));

// Eksporter app for testing
module.exports = app;

// Start serveren bare hvis filen kjøres direkte (ikke under test)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
  console.log(`Server is running on port ${PORT}`);
}