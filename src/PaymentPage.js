import React from "react";
import { useNavigate } from "react-router-dom";
import "./PaymentPage.css";

function PaymentPage() {
  const navigate = useNavigate();

  const handlePayment = () => {
  
    alert("Paiement effectué !");
    navigate("/");
  };

  return (
    <div className="payment-container">
      <h2>Page de paiement</h2>
      <div>
        <label>Montant</label>
        <input type="number" placeholder="Montant à payer" />
      </div>
      <div>
        <label>Moyen de paiement</label>
        <select>
          <option value="credit-card">Carte de crédit</option>
          <option value="bank-transfer">Virement bancaire</option>
        </select>
      </div>
      <button onClick={handlePayment}>Payer</button>
    </div>
  );
}

export default PaymentPage;
