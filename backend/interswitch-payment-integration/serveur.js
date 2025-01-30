require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

const {
  INTERSWITCH_CLIENT_ID,
  INTERSWITCH_CLIENT_SECRET,
  INTERSWITCH_BASE_URL,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  PORT
} = process.env;

let pool;
(async () => {
  pool = await mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, 
    queueLimit: 0
  });
})();

app.post('/initiate-payment', async (req, res) => {
  try {
    const { amount, customerId } = req.body;
    if (!amount || !customerId) {
      return res.status(400).json({ error: 'amount et customerId sont requis.' });
    }

    const insertQuery = `INSERT INTO transactions (transaction_ref, customer_id, amount, status)
                         VALUES (?, ?, ?, 'PENDING')`;
    const transactionRef = `TXN-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const [result] = await pool.execute(insertQuery, [
      transactionRef,
      customerId,
      amount
    ]);

    const authString = Buffer.from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const CREATE_TRANSACTION_ENDPOINT = '/api/v1/transactions';

    const requestData = {
      amount,
      customerId,
      currency: 'NGN',
      paymentMethod: 'CARD',
      redirectUrl: 'http://localhost:3000/payment-callback',
      reference: transactionRef
    };

    const response = await axios.post(
      `${INTERSWITCH_BASE_URL}${CREATE_TRANSACTION_ENDPOINT}`,
      requestData,
      { headers }
    );

    const { paymentUrl, transactionId } = response.data;

    const updateQuery = `UPDATE transactions 
                         SET transaction_ref = ?, 
                             status = 'INITIATED'
                         WHERE id = ?`;
    await pool.execute(updateQuery, [transactionId || transactionRef, result.insertId]);

    return res.json({
      success: true,
      message: 'Transaction initiée avec succès.',
      paymentUrl,
      transactionId
    });
  } catch (error) {
    console.error('Erreur initiate-payment :', error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’initiation du paiement.',
      error: error.response?.data || error.message
    });
  }
});

app.get('/payment-callback', async (req, res) => {
  try {
    const { transactionId, reference, status } = req.query;

    if (!transactionId && !reference) {
      return res.status(400).send('transactionId ou reference manquant dans la callback.');
    }

    const paymentStatusOk = await verifyPaymentStatus(transactionId || reference);

    const newStatus = paymentStatusOk ? 'SUCCESSFUL' : 'FAILED';

    const updateQuery = `UPDATE transactions
                         SET status = ?
                         WHERE transaction_ref = ?`;

    await pool.execute(updateQuery, [newStatus, transactionId || reference]);

    if (paymentStatusOk) {
      return res.send('Paiement validé avec succès. Merci !');
    } else {
      return res.send('Échec de paiement ou statut non confirmé.');
    }
  } catch (error) {
    console.error('Erreur payment-callback :', error.message);
    return res.status(500).send('Erreur interne lors du callback.');
  }
});

async function verifyPaymentStatus(transactionRef) {
  try {
    const authString = Buffer.from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const VERIFY_TRANSACTION_ENDPOINT = '/api/v1/transactions/status';

    const response = await axios.get(
      `${INTERSWITCH_BASE_URL}${VERIFY_TRANSACTION_ENDPOINT}?transactionRef=${transactionRef}`,
      { headers }
    );

    const { status } = response.data;
    return status === 'SUCCESSFUL';
  } catch (error) {
    console.error('Erreur verifyPaymentStatus :', error.message);
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
