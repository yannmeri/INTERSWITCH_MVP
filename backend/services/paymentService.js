const axios = require('axios');

const PAYMENT_API_URL = 'https://payment-service.k8.isw.la/collections/api/v1/sdk/qr/generate';
const API_KEY = process.env.PAYMENT_API_KEY;

const generateQRCode = async (qrCodeId, transactionReference, rawQRData) => {
  try {
    const response = await axios.post(PAYMENT_API_URL, {
      qrCodeId: qrCodeId,
      qrCodeIdMasterPass: qrCodeId,  // Si tu souhaites utiliser le même qrCodeId pour MasterPass
      rawQRData: rawQRData,
      transactionReference: transactionReference
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Erreur lors de la génération du QR code:', error);
    throw error;
  }
};

module.exports = {
  generateQRCode
};
