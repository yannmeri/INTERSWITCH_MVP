const bcrypt = require("bcrypt");
const User = require("../models/User");

// Fonction pour enregistrer un utilisateur
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Vérifier si l'email existe déjà
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      message: "Utilisateur créé avec succès.",
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

