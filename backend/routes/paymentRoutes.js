const express = require('express');
const paymentService = require('../services/paymentService');
const router = express.Router();

router.post('/generate-qr', async (req, res) => {
  const { qrCodeId, transactionReference, rawQRData } = req.body;

  if (!qrCodeId || !transactionReference || !rawQRData) {
    return res.status(400).json({ error: 'Les paramètres qrCodeId, transactionReference et rawQRData sont requis.' });
  }

  try {
    const result = await paymentService.generateQRCode(qrCodeId, transactionReference, rawQRData);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur lors de la génération du QR code.' });
  }
});

module.exports = router;
