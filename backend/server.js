const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/database");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.use(bodyParser.json());

// Utiliser les routes
app.use("/api/users", userRoutes);

// Synchroniser la base de données
sequelize.sync({ force: true }) // `force: true` recrée les tables à chaque redémarrage.
  .then(() => console.log("Base de données synchronisée."))
  .catch((err) => console.error("Erreur lors de la synchronisation :", err));

// Lancer le serveur
const PORT = 5000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
