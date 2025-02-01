const axios = require('axios');

const PAYMENT_API_URL = 'https://payment-service.k8.isw.la/collections/api/v1/sdk/qr/generate';
const BEARER_TOKEN = process.env.PAYMENT_BEARER_TOKEN; // Mets ici le bon token

const generateQRCode = async (amount, surcharge, currencyCode, merchantTransactionReference) => {
  try {
    const response = await axios.post(PAYMENT_API_URL, {
      amount: amount,
      surcharge: surcharge,
      currencyCode: currencyCode,
      merchantTransactionReference: merchantTransactionReference
    }, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Erreur lors de la génération du QR code:', error?.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  generateQRCode
};
