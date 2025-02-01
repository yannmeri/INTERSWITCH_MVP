require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectOptions: {
        // Ajout des options MariaDB ou MySQL
        ssl: false,  // Activer SSL si nécessaire
        // Ajouter l'option `allowPublicKeyRetrieval`
        allowPublicKeyRetrieval: true,  // Permet la récupération de la clé publique RSA
      },
  }
);

// Vérifier la connexion
sequelize
  .authenticate()
  .then(() => console.log("Connexion à la base de données réussie."))
  .catch((err) => console.error("Erreur de connexion à la base de données :", err));

module.exports = sequelize;
