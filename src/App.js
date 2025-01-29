import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import HomePage from "./HomePage";
import LoginPage from "./LoginPage";
import SignUpPage from "./SignUpPage";
import CompanyPage from "./CompanyPage";
import PaymentPage from "./PaymentPage";
import MachinesPage from './MachinesPage';

import "./App.css";

function NotFound() {
  return <h2 style={{ textAlign: "center", marginTop: "50px" }}>Page non trouvée !</h2>;
}

function App() {
  return (
    <Router>
      <div className="App">
        {/* Navigation */}
        <nav>
          <ul>
            <li><Link to="/">Accueil</Link></li>
            <li><Link to="/machines">Machines</Link></li>
            <li><Link to="/company">Entreprises</Link></li>
            <li><Link to="/login">Connexion</Link></li>
            <li><Link to="/signup">Inscription</Link></li>
          </ul>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="*" element={<NotFound />} /> {/* Page 404 */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
