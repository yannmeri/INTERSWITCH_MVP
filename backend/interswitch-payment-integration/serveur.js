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

async function getAccessToken() {
  const url = `${INTERSWITCH_BASE_URL}/passport/oauth/token`;
  const authString = Buffer.from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(url, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Erreur getAccessToken:', error.response?.data || error.message);
    throw new Error('Impossible de récupérer le token OAuth.');
  }
}

app.post('/initiate-payment', async (req, res) => {
  try {
    const { customerId, amount, authData, transactionRef } = req.body;

    if (!customerId || !amount || !authData || !transactionRef) {
      return res.status(400).json({
        success: false,
        message: 'Requête invalide. Paramètres requis: customerId, amount, authData, transactionRef.'
      });
    }

    const insertSQL = `
      INSERT INTO transactions (transaction_ref, customer_id, amount, status)
      VALUES (?, ?, ?, 'PENDING')
    `;
    await pool.execute(insertSQL, [transactionRef, customerId, amount]);

    const accessToken = await getAccessToken();

    const url = `${INTERSWITCH_BASE_URL}/api/v3/purchases`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const body = {
      customerId,
      amount,      
      currency: 'NGN',
      authData,     
      transactionRef 
    };

    const response = await axios.post(url, body, { headers });
    const data = response.data;

    console.log('Purchase API response:', data);

    let status = '';
    let paymentId = data.paymentId || null;

    switch (data.responseCode) {
      case '00':
        status = 'SUCCESSFUL';
        break;
      case 'T0':
        status = 'OTP_REQUIRED';
        break;
      case 'S0':
        status = '3DSECURE_REQUIRED';
        break;
      default:
        status = 'FAILED';
        break;
    }

    const updateSQL = `
      UPDATE transactions
      SET status = ?, payment_id = ?
      WHERE transaction_ref = ?
    `;
    await pool.execute(updateSQL, [status, paymentId, transactionRef]);

    return res.json({
      success: true,
      message: data.message || 'Transaction initiée',
      responseCode: data.responseCode,
      transactionRef: data.transactionRef,
      paymentId: data.paymentId,
      status
    });

  } catch (error) {
    console.error('Erreur initiate-payment:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’initiation du paiement.',
      error: error.response?.data || error.message
    });
  }
});

app.post('/authenticate-otp', async (req, res) => {
  try {
    const { paymentId, otp, transactionId, eciFlag } = req.body;
    if (!paymentId || !otp || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres requis: paymentId, otp, transactionId'
      });
    }

    const accessToken = await getAccessToken();

    const url = `${INTERSWITCH_BASE_URL}/api/v3/purchases/otps/auths`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const body = {
      paymentId,
      otp,
      transactionId,
      eciFlag
    };

    const response = await axios.post(url, body, { headers });
    const data = response.data;

    console.log('Authenticate OTP response:', data);

    let status = (data.responseCode === '00') ? 'SUCCESSFUL' : 'FAILED';

    if (data.transactionRef) {
      const updateSQL = `
        UPDATE transactions
        SET status = ?
        WHERE transaction_ref = ?
      `;
      await pool.execute(updateSQL, [status, data.transactionRef]);
    }

    return res.json({
      success: true,
      responseCode: data.responseCode,
      message: data.message,
      status
    });

  } catch (error) {
    console.error('Erreur authenticate-otp:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’authentification OTP.',
      error: error.response?.data || error.message
    });
  }
});

app.get('/transaction-status', async (req, res) => {
  try {
    const { merchantcode, transactionreference, amount } = req.query;
    if (!merchantcode || !transactionreference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'merchantcode, transactionreference et amount requis en query.'
      });
    }

    const accessToken = await getAccessToken();
    const url = `${INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction?merchantcode=${merchantcode}&transactionreference=${transactionreference}&amount=${amount}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const response = await axios.get(url, { headers });
    const data = response.data;
    if (data.ResponseCode === '00') {
            const updateSQL = `UPDATE transactions SET status = 'SUCCESSFUL' WHERE transaction_ref = ?`;
      await pool.execute(updateSQL, [transactionreference]);
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erreur transaction-status:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut.',
      error: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
