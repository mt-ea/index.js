
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Prevent duplicate notifications for the same event.
// Works within one running Render instance.
const processedEvents = new Map();
const processingEvents = new Set();

const DUPLICATE_WINDOW = 24 * 60 * 60 * 1000;

app.get('/health', (req, res) => {
  res.status(200).send('Server running');
});

app.post('/webhook/clickfunnels-to-slack', async (req, res) => {
  const body = req.body || {};
  const eventId = body.event_id;

  try {
    console.log('Webhook received:', {
      event_id: eventId,
      event_type: body.event_type,
      api_version: body.api_version,
      page: body.page?.name,
      funnel: body.funnel?.name
    });

    // Ignore duplicate events.
    if (eventId && (
      processedEvents.has(eventId) ||
      processingEvents.has(eventId)
    )) {
      console.log('Duplicate event skipped:', eventId);
      return res.status(200).send('Duplicate skipped');
    }

    if (body.event_type && body.event_type !== 'contact.created') {
      console.log('Event type skipped:', body.event_type);
      return res.status(200).send('Event ignored');
    }

    // Support both ClickFunnels V1 and V2 payloads.
    const attributes =
      body.data?.attributes ||
      body.data ||
      {};

    const firstName = attributes.first_name || '';
    const lastName = attributes.last_name || '';

    const fullName =
      `${firstName} ${lastName}`.trim() || 'N/A';

    const email =
      attributes.email_address ||
      attributes.email ||
      'N/A';

    const phone =
      attributes.phone_number ||
      attributes.phone ||
      'N/A';

    if (fullName === 'N/A' && email === 'N/A' && phone === 'N/A') {
      console.error('Missing lead information');
      return res.status(422).send('Missing lead information');
    }

    if (!SLACK_WEBHOOK_URL) {
      console.error('Slack webhook is not configured');
      return res.status(500).send('Slack configuration missing');
    }

    const message = {
      text:
        `New Lead\n` +
        `Name: ${fullName}\n` +
        `Email: ${email}\n` +
        `Phone: ${phone}`
    };

    if (eventId) {
      processingEvents.add(eventId);
    }

    try {
      await axios.post(SLACK_WEBHOOK_URL, message, {
        timeout: 10000
      });

      if (eventId) {
        processedEvents.set(eventId, Date.now());
      }

      console.log('Lead successfully sent to Slack');
      res.status(200).send('Sent to Slack');

    } finally {
      if (eventId) {
        processingEvents.delete(eventId);
      }
    }

  } catch (error) {
    console.error('Webhook processing error:', {
      status: error.response?.status,
      message: error.message
    });

    res.status(500).send('Error processing webhook');
  }
});

// Periodically remove old duplicate tracking records.
const cleanup = setInterval(() => {
  const now = Date.now();

  for (const [id, timestamp] of processedEvents) {
    if (now - timestamp > DUPLICATE_WINDOW) {
      processedEvents.delete(id);
    }
  }
}, 60 * 60 * 1000);

cleanup.unref();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

