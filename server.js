const express = require('express');
const app = express();


app.use(express.static('feilmelding'));

app.get("/", (req, res) => {
  res.redirect(`/feilmelding`);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT);
console.log(`Server is running on port ${PORT}`);