# Agriconnect

Agriconnect est une application web multi-client qui met en relation des entreprises proposant des outils agricoles et des agriculteurs.  
Les agriculteurs peuvent choisir de payer ou d'emprunter les outils dont ils ont besoin, tandis que les entreprises publient leurs outils avec des options de vente et de location.  
Le projet intègre également un système de paiement via l’API Interswitch (Create Bill) et une fonctionnalité de chat en temps réel (via Socket.IO) pour faciliter la communication entre les utilisateurs.

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Architecture du projet](#architecture-du-projet)
- [Installation](#installation)
- [Configuration (.env)](#configuration-env)
- [Structure du projet](#structure-du-projet)
- [Base de données](#base-de-données)
- [Intégration de l'API Interswitch](#intégration-de-lapi-interswitch)
- [Routes principales](#routes-principales)
- [Chat en temps réel avec Socket.IO](#chat-en-temps-réel-avec-socketio)
- [Utilisation](#utilisation)
- [Tests](#tests)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Fonctionnalités

- **Inscription & Authentification**  
  - Deux rôles distincts : *enterprise* et *farmer*.
  - Auto-login après inscription.
  - Navigation dynamique qui adapte l’affichage selon l’état de connexion.

- **Gestion des outils**  
  - Les entreprises peuvent ajouter des outils avec image, prix d’achat et de location.
  - Les outils sont affichés dans une grille horizontale.

- **Paiements via Interswitch**  
  - Intégration avec l’API Interswitch pour générer un lien de paiement (Create Bill).
  - Redirection avec la référence de transaction dans l’URL.
  - Finalisation du paiement via le callback `/payment-callback`, qui met à jour la base de données et envoie des notifications.

- **Notifications**  
  - Enregistrement et affichage des notifications pour les utilisateurs (farmer et enterprise) lors d'événements importants (paiement réussi, etc.).

- **Chat en temps réel**  
  - Utilisation de Socket.IO pour permettre aux agriculteurs de discuter en temps réel avec les entreprises au sujet des outils proposés.
  - Possibilité d'envoyer et de recevoir des messages instantanément.

## Architecture du projet

Le projet est construit en **Node.js/Express** pour le backend, avec une base de données **MySQL** pour stocker les utilisateurs, outils, paiements, notifications et messages de chat.  
Le frontend est composé de pages HTML et CSS dynamiques, avec quelques scripts JavaScript pour la mise à jour de l’interface et l’intégration de Socket.IO.

## Installation

### Prérequis

- [Node.js](https://nodejs.org/en/download/)
- [MySQL](https://dev.mysql.com/downloads/installer/)

### Étapes

1. **Clonez le dépôt** :

   ```bash
   git clone https://votre-dépôt.git
   cd agriconnect
   ```

2. **Installez les dépendances** :

   ```bash
   npm install express dotenv body-parser axios mysql2 multer express-session socket.io
   ```

3. **Créez la base de données et les tables**  
   Exécutez le script SQL fourni ci-dessous dans votre interface MySQL :

   ```sql
   CREATE DATABASE IF NOT EXISTS agriconnectdb;
   USE agriconnectdb;

   -- Table users
   CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(100) UNIQUE NOT NULL,
     password VARCHAR(255) NOT NULL,
     role ENUM('enterprise','farmer') NOT NULL,
     full_name VARCHAR(100),
     phone VARCHAR(50),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=INNODB;

   -- Table tools
   CREATE TABLE IF NOT EXISTS tools (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     image_path VARCHAR(255),
     buy_price INT,
     rent_price INT,
     owner_id INT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (owner_id) REFERENCES users(id)
   ) ENGINE=INNODB;

   -- Table payments
   CREATE TABLE IF NOT EXISTS payments (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     tool_id INT NOT NULL,
     amount INT NOT NULL,
     status VARCHAR(50) DEFAULT 'PENDING',
     transaction_ref VARCHAR(100),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id),
     FOREIGN KEY (tool_id) REFERENCES tools(id)
   ) ENGINE=INNODB;

   -- Table notifications
   CREATE TABLE IF NOT EXISTS notifications (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     message VARCHAR(255) NOT NULL,
     is_read TINYINT(1) DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   ) ENGINE=INNODB;

   -- Table messages (chat)
   CREATE TABLE IF NOT EXISTS messages (
     id INT AUTO_INCREMENT PRIMARY KEY,
     sender_id INT NOT NULL,
     receiver_id INT NOT NULL,
     message TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (sender_id) REFERENCES users(id),
     FOREIGN KEY (receiver_id) REFERENCES users(id)
   ) ENGINE=INNODB;
   ```

4. **Créez le fichier `.env`** à la racine (voir section suivante).

## Configuration (.env)

Créez un fichier nommé `.env` à la racine de votre projet :

```bash
PORT=3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=secret
DB_NAME=agriconnectdb

INTERSWITCH_BASE_URL=https://qa.interswitchng.com
INTERSWITCH_CLIENT_ID=YourClientID
INTERSWITCH_CLIENT_SECRET=YourClientSecret

APP_REDIRECT_URL=http://localhost:3000/payment-callback
```

*(Adaptez ces valeurs à votre environnement.)*

## Structure du projet

```
agriconnect/
├── .env
├── package.json
├── server.js
├── public/
│   ├── css/
│   │   └── style.css
│   └── images/          <-- Images des outils et slider
├── views/
│   ├── index.html       <-- Page d'accueil avec slider horizontal
│   ├── register.html    <-- Inscription
│   ├── login.html       <-- Connexion (pop-up en cas d'erreur)
│   ├── profile.html     <-- Profil (affiche les infos de l'utilisateur connecté)
│   ├── tools.html       <-- Liste des outils avec options Buy, Rent, Chat
│   ├── add-tool.html    <-- Pour que les entreprises ajoutent des outils
│   ├── notifications.html  <-- Liste des notifications
│   ├── chat.html        <-- Page de chat en temps réel avec Socket.IO
│   └── payment.html     <-- Page de redirection après paiement
└── README.md
```

## Intégration de l'API Interswitch

L'intégration de l’API Interswitch se fait en deux étapes principales :

1. **Récupération du token OAuth**  
   La fonction `getAccessToken()` effectue une requête POST à  
   ```
   {INTERSWITCH_BASE_URL}/passport/oauth/token
   ```  
   avec les identifiants (`INTERSWITCH_CLIENT_ID` et `INTERSWITCH_CLIENT_SECRET`) pour obtenir un token d'accès.

2. **Création d'un bill (lien de paiement)**  
   La route `/create-bill` effectue une requête POST à l’endpoint Interswitch :
   ```
   {INTERSWITCH_BASE_URL}/paymentgateway/api/v1/paybill
   ```  
   En incluant dans l'URL de redirection (redirectUrl) la référence de transaction (transactionRef) afin que la route `/payment-callback` puisse récupérer cette référence et finaliser le paiement.

3. **Callback de paiement**  
   La route `/payment-callback` (acceptant GET et POST) récupère la référence de transaction (via `transactionreference` ou `txnref`), vérifie le statut du paiement (en se basant sur le paramètre `resp` ou en appelant l’API GET de vérification) et met à jour la base de données. Des notifications sont ensuite créées pour l'utilisateur (farmer) et l'entreprise.

## Routes principales

- **Pages statiques (GET)**  
  - `/` : Page d'accueil avec un slider horizontal et une description.
  - `/register` : Formulaire d'inscription.
  - `/login` : Formulaire de connexion.
  - `/profile` : Profil de l'utilisateur connecté.
  - `/tools` : Liste des outils.
  - `/add-tool` : Page pour que les entreprises ajoutent un outil.
  - `/notifications` : Affichage des notifications.
  - `/chat` : Page de chat pour la messagerie en temps réel.
  - `/payment` : Page de redirection après paiement (peut être utilisée pour afficher un message de succès).

- **API REST**  
  - `POST /register` : Inscription (auto-login après inscription).
  - `POST /login` : Connexion (retourne une réponse JSON pour gérer les erreurs via pop-up).
  - `GET /logout` : Déconnexion.
  - `POST /profile` : Mise à jour du profil.
  - `GET /api/profile` : Récupérer les informations du profil de l'utilisateur connecté.
  - `GET /api/tools` : Récupérer la liste des outils (inclut l’email du propriétaire).
  - `POST /add-tool` : Ajouter un outil (accessible uniquement aux entreprises).
  - `POST /create-bill` : Créer un bill (intégration Interswitch, accessible uniquement aux fermiers).
  - `ALL /payment-callback` : Callback de paiement pour finaliser la transaction.
  - `GET /api/notifications` : Récupérer les notifications pour l'utilisateur connecté.
  - `POST /api/notifications/read` : Marquer une notification comme lue.
  - `POST /api/messages` : Envoyer un message (chat).
  - `GET /api/messages` : Récupérer la conversation entre l'utilisateur connecté et un autre utilisateur (via paramètre `with`).

- **Chat en temps réel avec Socket.IO**  
  - Le serveur intègre Socket.IO pour permettre une communication instantanée entre clients.
  - Les messages envoyés via le chat sont diffusés en temps réel à tous les clients connectés (vous pouvez améliorer cette diffusion pour cibler uniquement les destinataires).

## Chat en temps réel

La fonctionnalité de chat est implémentée en utilisant Socket.IO :

- **Serveur (server.js) :**  
  - Un serveur HTTP est créé avec `http.createServer(app)` et Socket.IO est attaché à cette instance.
  - Lorsque l'événement `sendMessage` est émis par un client, le message est enregistré dans la base de données et diffusé à tous les clients connectés via `io.emit('newMessage', data)`.

- **Client (chat.html) :**  
  - La page inclut le script Socket.IO (`/socket.io/socket.io.js`).
  - Le client se connecte à Socket.IO, envoie des messages via `socket.emit('sendMessage', data)` et écoute l'événement `newMessage` pour afficher les messages en temps réel.

## Utilisation

1. **Inscription et connexion**  
   - Les utilisateurs peuvent s'inscrire via la page `/register` et sont automatiquement connectés après l'inscription.
   - La connexion se fait via la page `/login` et, en cas d'erreur (mauvais mot de passe, par exemple), un pop-up affiche un message d'erreur.

2. **Navigation**  
   - Si l'utilisateur est connecté, la barre de navigation affiche des liens vers Tools, Profile, Notifications, Chat et Logout.
   - Sinon, seuls les liens Login et Register sont affichés.

3. **Ajout d'outils**  
   - Les entreprises (role = enterprise) peuvent ajouter des outils via la page `/add-tool`.  
   - Chaque outil inclut un nom, des prix (achat et location) et une image.

4. **Paiement**  
   - Les fermiers (role = farmer) consultent la liste des outils sur `/tools`.  
   - Ils peuvent cliquer sur "Buy" ou "Rent" pour initier un paiement.  
   - La route `/create-bill` crée une demande de paiement via l’API Interswitch et redirige l'utilisateur vers la page de paiement avec la référence de transaction incluse dans l'URL.
   - Une fois le paiement effectué, la route `/payment-callback` finalise la transaction, met à jour le statut, et envoie des notifications.

5. **Notifications**  
   - Les utilisateurs peuvent consulter leurs notifications via la page `/notifications`.

6. **Chat**  
   - Les fermiers peuvent cliquer sur le bouton "Chat" associé à un outil sur la page `/tools` pour discuter directement avec l'entreprise propriétaire.
   - La page `/chat` permet la communication en temps réel grâce à Socket.IO.

## Tests

- **Déploiement local :**  
  1. Configurez votre fichier `.env` et exécutez le script SQL pour créer les tables.
  2. Installez les dépendances avec `npm install`.
  3. Lancez le serveur avec `node server.js`.
  4. Accédez à `http://localhost:3000/` pour tester l'ensemble du flux (inscription, connexion, ajout d'outils, paiement, notifications, chat).

- **Multi-client :**  
  Ouvrez plusieurs onglets ou navigateurs pour vérifier que les actions (chat, paiement, etc.) d'un utilisateur n'affectent pas celles d'un autre.

## Contribuer

Les contributions sont les bienvenues !  
Pour contribuer, veuillez soumettre une pull request avec des descriptions détaillées des modifications apportées.

## Licence

Ce projet est sous licence MIT. Consultez le fichier `LICENSE` pour plus d’informations.
```
