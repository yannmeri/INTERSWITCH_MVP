import React from 'react';

function Login() {
  return (
    <div>
      <h2>Connexion</h2>
      <form>
        <input type="email" placeholder="Email" required />
        <input type="password" placeholder="Mot de passe" required />
        <select>
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
        </select>
        <button type="submit">Connexion</button>
      </form>
    </div>
  );
}

export default Login;
