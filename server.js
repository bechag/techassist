// ─────────────────────────────────────────────
//  server.js — Backend Stripe pour TechAssist
// ─────────────────────────────────────────────
//  npm init -y
//  npm install express stripe cors dotenv
//  node server.js
// ─────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // placez votre index.html dans /public

// ── Créer une intention de paiement ──
app.post('/create-payment', async (req, res) => {
  try {
    const { amount, problem, name, email, phone, date, time, method } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // en centimes (3900 = 39,00 €)
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        problem,
        name,
        email,
        phone,
        date,
        time,
        method
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Erreur création paiement:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook : confirmation de paiement ──
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── Paiement réussi ──
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const meta = pi.metadata;

    console.log('✅ Paiement reçu !');
    console.log('  Client :', meta.name);
    console.log('  Email  :', meta.email);
    console.log('  Problème:', meta.problem);
    console.log('  Montant :', (pi.amount / 100).toFixed(2), '€');
    console.log('  Méthode assistance:', meta.method);
    console.log('  RDV    :', meta.date, 'à', meta.time);

    // ── ICI : votre logique métier ──
    // - Envoyer un email de confirmation (avec Nodemailer, SendGrid, etc.)
    // - Créer le RDV dans votre base de données
    // - Envoyer un SMS de confirmation
    // - Notifier le technicien
    //
    // Exemple avec Nodemailer :
    //
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS }
    // });
    // await transporter.sendMail({
    //   from: '"TechAssist" <contact@techassist.fr>',
    //   to: meta.email,
    //   subject: 'Confirmation de votre rendez-vous',
    //   html: `<h1>Bonjour ${meta.name}</h1>
    //          <p>Votre RDV est confirmé pour le ${meta.date} à ${meta.time}.</p>
    //          <p>Problème : ${meta.problem}</p>
    //          <p>Montant : ${(pi.amount/100).toFixed(2)} €</p>`
    // });
  }

  // ── Paiement échoué ──
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    console.log('❌ Paiement échoué pour:', pi.metadata.email);
  }

  res.json({ received: true });
});

// ── Démarrage ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur TechAssist lancé sur http://localhost:${PORT}`);
});