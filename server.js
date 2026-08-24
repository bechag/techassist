require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendConfirmationEmail(data) {
  var methodLabels = { telephone:'Par telephone', whatsapp:'Par WhatsApp', visio:'Par visioconférence', remote:'Par prise en main a distance', physical:'Par intervention physique' };
  var teamviewerBlock = '';
  if (data.method === 'remote') {
    teamviewerBlock = '<div style="background:#f0fdf4;border:2px solid #10b981;border-radius:12px;padding:20px;margin-top:20px;text-align:center"><h3 style="color:#065f46;margin:0 0 10px 0">Prise en main a distance</h3><p style="color:#047857;margin:0 0 15px 0;font-size:14px">Telechargez TeamViewer QuickSupport puis communiquez votre ID.</p><a href="https://download.teamviewer.com/download/TeamViewerQS.exe" style="display:inline-block;background:#065f46;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">Telecharger TeamViewer</a></div>';
  }
  await transporter.sendMail({
    from: '"TechAssist" <' + process.env.EMAIL_USER + '>',
    to: data.email,
    subject: 'Confirmation de votre rendez-vous TechAssist',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden"><div style="background:#0a1814;padding:30px;text-align:center"><h1 style="color:#10b981;margin:0;font-size:24px">TechAssist</h1></div><div style="padding:30px"><h2 style="color:#022c22;margin:0 0 20px 0">Rendez-vous confirme</h2><p style="font-size:14px;color:#374151"><b>Probleme :</b> ' + data.problem + '</p><p style="font-size:14px;color:#374151"><b>Date :</b> ' + data.date + ' a ' + data.time + '</p><p style="font-size:14px;color:#374151"><b>Nom :</b> ' + data.name + '</p><p style="font-size:14px;color:#374151"><b>Assistance :</b> ' + (methodLabels[data.method] || data.method) + '</p><p style="font-size:18px;color:#10b981;font-weight:700;margin-top:15px">39 EUR</p>' + teamviewerBlock + '</div></div>'
  });
  console.log('Email envoye a ' + data.email);
}

app.post('/create-payment', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { problem: req.body.problem, name: req.body.name, email: req.body.email, phone: req.body.phone, date: req.body.date, time: req.body.time, method: req.body.method }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Erreur paiement:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook', async (req, res) => {
  var sig = req.headers['stripe-signature'];
  var rawBody = '';

  await new Promise(function(resolve) {
    req.on('data', function(chunk) { rawBody += chunk; });
    req.on('end', resolve);
  });

  var event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook invalide:', err.message);
    return res.status(400).send('Webhook Error');
  }

  if (event.type === 'payment_intent.succeeded') {
    var meta = event.data.object.metadata;
    console.log('Paiement recu : ' + meta.email);
    try {
      await sendConfirmationEmail({ problem: meta.problem, name: meta.name, email: meta.email, phone: meta.phone, date: meta.date, time: meta.time, method: meta.method });
    } catch (err) {
      console.error('Erreur email:', err.message);
    }
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Serveur lance sur le port ' + PORT); });