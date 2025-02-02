require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

const {
  PORT,
  INTERSWITCH_BASE_URL,
  INTERSWITCH_CLIENT_ID,
  INTERSWITCH_CLIENT_SECRET,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME
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
  try {

    const url = `${INTERSWITCH_BASE_URL}/passport/oauth/token`;
    const authString = Buffer.from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`).toString('base64');

    
    const response = await axios.post(
      url,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authString}`
        }
      }
    );

    return response.data.access_token;  
  } catch (error) {
    console.error('Erreur lors de la récupération du token OAuth :', error.response?.data || error.message);
    throw new Error('Impossible de récupérer le token OAuth.');
  }
}

app.post('/create-bill', async (req, res) => {
  try {
    const {
      merchantCode,
      payableCode,
      amount,
      redirectUrl,
      customerId,
      currencyCode,
      customerEmail,
      transactionReference
    } = req.body;

    if (!merchantCode || !payableCode || !amount || !redirectUrl || !customerId || !currencyCode) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (merchantCode, payableCode, amount, redirectUrl, customerId, currencyCode).'
      });
    }

    const accessToken = await getAccessToken();

    const url = `${INTERSWITCH_BASE_URL}/paymentgateway/api/v1/paybill`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const body = {
      merchantCode,
      payableCode,
      amount, 
      redirectUrl,
      customerId,
      currencyCode,
      customerEmail,
      transactionReference
    };

    const response = await axios.post(url, body, { headers });
    const data = response.data;
    console.log('Create Bill response:', data);

    const insertSQL = `
      INSERT INTO bills (
        bill_id, merchant_code, payable_code, amount,
        redirect_url, customer_id, currency_code, customer_email,
        reference, payment_url, code
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(insertSQL, [
      data.id,
      data.merchantCode,
      data.payableCode,
      data.amount,
      data.redirectUrl,
      data.customerId,
      data.currencyCode,
      data.customerEmail,
      data.reference,
      data.paymentUrl,
      data.code
    ]);

    return res.json({
      success: true,
      message: 'Bill créé avec succès.',
      responseData: data
    });

  } catch (error) {
    console.error('Erreur create-bill :', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du bill',
      error: error.response?.data || error.message
    });
  }
});

app.get('/confirm-bill', async (req, res) => {
  try {
    const { merchantCode, reference, amount } = req.query;
    if (!merchantCode || !reference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres requis : merchantCode, reference, amount.'
      });
    }

    const accessToken = await getAccessToken();
    const url = `${INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction?merchantcode=${merchantCode}&transactionreference=${reference}&amount=${amount}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const response = await axios.get(url, { headers });
    const data = response.data;
    console.log('Confirm Bill response:', data);

    if (data.ResponseCode === '00') {
      const updateSQL = `UPDATE bills SET status = 'PAID' WHERE reference = ?`;
      await pool.execute(updateSQL, [reference]);

      return res.json({
        success: true,
        message: 'Le bill est payé avec succès.',
        data
      });
    } else {
      return res.json({
        success: false,
        message: 'Le bill n’est pas payé ou est en attente.',
        data
      });
    }

  } catch (error) {
    console.error('Erreur confirm-bill:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du bill',
      error: error.response?.data || error.message
    });
  }
});

app.listen(PORT || 3000, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT || 3000}`);
});
