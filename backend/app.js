const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(bodyParser.json());

// Import des routes
const userRoutes = require('./routes/users');

// Définition des routes
app.use('/api/users', userRoutes);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const sequelize = require('./config/database');
sequelize.authenticate()
  .then(() => console.log('Database connected!'))
  .catch(err => console.log('Error: ' + err));

const User = require('./models/User');
sequelize.sync({ force: true }).then(() => {
    console.log('Database synchronized!');
  });
  