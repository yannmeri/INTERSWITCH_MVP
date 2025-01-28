const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/database");
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
app.use(bodyParser.json());

app.use("/api/users", userRoutes);
app.use('/api/payment', paymentRoutes);

sequelize.sync({ force: true })
  .then(() => console.log("Base de données synchronisée."))
  .catch((err) => console.error("Erreur lors de la synchronisation :", err));

const PORT = 5000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
