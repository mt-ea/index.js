
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());


const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

// Webhook endpoint
app.post('/webhook/clickfunnels-to-slack', async (req, res) => {
  try {
    // Extract data from ClickFunnels
    const first_name = req.body.first_name || '';
    const last_name = req.body.last_name || '';
    const email = req.body.email_address || 'N/A';
    const phone = req.body.phone_number || 'N/A';

    // Format message
    const message = {
      text: `New Lead\nName: ${first_name} ${last_name}\nEmail: ${email}\nPhone: ${phone}`
    };

    // Send to Slack
    await axios.post(SLACK_WEBHOOK_URL, message);

    res.status(200).send('Sent to Slack');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
