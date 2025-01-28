import React from 'react';

function Signup() {
  return (
    <div>
      <h2>Inscription</h2>
      <form>
        <input type="text" placeholder="Nom" required />
        <input type="text" placeholder="Prénom" required />
        <input type="email" placeholder="Email" required />
        <input type="tel" placeholder="Numéro de téléphone" required />
        <input type="password" placeholder="Mot de passe" required />
        <select>
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
        </select>
        <button type="submit">S'inscrire</button>
      </form>
    </div>
  );
}

export default Signup;
