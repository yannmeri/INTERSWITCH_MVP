import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MachinesPage.css';

const machinesData = [
    { id: 1, name: "Tracteur X100", image: "Tracteur_moderne.jpg", description: "Puissant tracteur pour les grandes exploitations.", price: "200€/jour" },
    { id: 2, name: "Moissonneuse-batteuse", image: "Moissonneuse_batteuse.jpg", description: "Idéale pour la récolte des céréales.", price: "500€/jour" },
    { id: 3, name: "Tronçonneuse professionnelle", image: "Tronçonneuse_professionnelle.jpg", description: "Pour l'entretien des arbres et des haies.", price: "50€/jour" },
    { id: 4, name: "Brouette robuste", image: "wBrouette.jpg", description: "Parfaite pour le transport de matériaux.", price: "10€/jour" },
];

const MachinesPage = () => {
    const navigate = useNavigate();

    return (
        <div className="machines-container">
            <h2>Machines et Outils Agricoles</h2>
            <div className="machines-grid">
                {machinesData.map((machine) => (
                    <div key={machine.id} className="machine-card">
                        <img src={`./images/${machine.image}`} alt={machine.name} />
                        <h3>{machine.name}</h3>
                        <p>{machine.description}</p>
                        <p><strong>Tarif :</strong> {machine.price}</p>
                        <button>Réserver</button>
                    </div>
                ))}
            </div>
            <button className="navigate-button" onClick={() => navigate('/company')}>
                Voir les entreprises
            </button>
        </div>
    );
};

export default MachinesPage;
