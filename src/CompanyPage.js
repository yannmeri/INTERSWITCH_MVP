import React from "react";
import { useNavigate } from "react-router-dom";
import "./CompanyPage.css";

function CompanyPage() {
  const navigate = useNavigate();

  const handleSelectCompany = () => {
    navigate("/payment");
  };

  return (
    <div className="company-container">
      <h2>Choisissez une entreprise</h2>
      <div className="company-card">
        <h3>Entreprise 1</h3>
        <button onClick={handleSelectCompany}>Voir les services</button>
      </div>
      {/* Ajoute ici d'autres entreprises */}
    </div>
  );
}

export default CompanyPage;
