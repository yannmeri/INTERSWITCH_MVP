import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("buyer");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
  
    navigate("/company");
  };

  return (
    <div className="login-container">
      <h2>Connexion</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
        </select>
        <button type="submit">Connexion</button>
      </form>
    </div>
  );
}

export default LoginPage;
