const express = require('express');
const paymentService = require('../services/paymentService');
const router = express.Router();

router.post('/generate-qr', async (req, res) => {
  const { amount, surcharge, currencyCode, merchantTransactionReference } = req.body;

  if (!amount || !surcharge || !currencyCode || !merchantTransactionReference) {
    return res.status(400).json({ error: 'Les paramètres amount, surcharge, currencyCode et merchantTransactionReference sont requis.' });
  }

  try {
    const result = await paymentService.generateQRCode(amount, surcharge, currencyCode, merchantTransactionReference);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur lors de la génération du QR code.', details: error?.response?.data || error.message });
  }
});

module.exports = router;
