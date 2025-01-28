import React from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Bienvenue sur Agriconnect</h1>
        <p>Votre plateforme pour acheter et louer des outils agricoles.</p>
        <Link to="/login">
          <button>Se connecter</button>
        </Link>
        <Link to="/signup">
          <button>S'inscrire</button>
        </Link>
      </header>
    </div>
  );
}

export default HomePage;
