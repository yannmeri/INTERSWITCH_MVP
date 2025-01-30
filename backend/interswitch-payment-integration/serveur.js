require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const {
  INTERSWITCH_CLIENT_ID,
  INTERSWITCH_CLIENT_SECRET,
  INTERSWITCH_BASE_URL,
  PORT
} = process.env;

const CREATE_TRANSACTION_ENDPOINT = '/api/v1/transactions';
const VERIFY_TRANSACTION_ENDPOINT = '/api/v1/transactions/status';

app.post('/initiate-payment', async (req, res) => {
  try {
    const { amount, customerId } = req.body;

    const requestData = {
      amount,
      customerId,
      currency: 'NGN',
      paymentMethod: 'CARD',
      redirectUrl: 'http://localhost:3000/payment-callback'
    };

    const authString = Buffer
      .from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`)
      .toString('base64');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const response = await axios.post(
      `${INTERSWITCH_BASE_URL}${CREATE_TRANSACTION_ENDPOINT}`,
      requestData,
      { headers }
    );

    const { paymentUrl, transactionId } = response.data;

    return res.json({
      success: true,
      paymentUrl,
      transactionId
    });

  } catch (error) {
    console.error('Erreur lors de la création de la transaction :', error.message);

    return res.status(500).json({
      success: false,
      message: 'Impossible d’initier la transaction',
      error: error.response?.data || error.message
    });
  }
});

app.get('/payment-callback', async (req, res) => {
  try {
    const { transactionId, status } = req.query;

    if (transactionId) {
      const verified = await verifyPaymentStatus(transactionId);
      if (verified) {
        return res.send('Paiement validé avec succès !');
      } else {
        return res.send('Échec de paiement ou statut non confirmé.');
      }
    } else {
      return res.send('Aucun identifiant de transaction fourni dans la callback.');
    }

  } catch (error) {
    console.error('Erreur dans le callback :', error.message);
    return res.status(500).send('Une erreur est survenue lors du traitement du paiement.');
  }
});

async function verifyPaymentStatus(transactionId) {
  try {
    const authString = Buffer
      .from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`)
      .toString('base64');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const response = await axios.get(
      `${INTERSWITCH_BASE_URL}${VERIFY_TRANSACTION_ENDPOINT}/${transactionId}`,
      { headers }
    );

    const { status } = response.data;
    return status === 'SUCCESSFUL';

  } catch (error) {
    console.error('Erreur de vérification de paiement :', error.message);
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
