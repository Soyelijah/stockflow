# Internal Communications Skill

## Overview

Enterprise internal communications require multi-channel delivery, template management, delivery tracking, and user preference respect. This skill covers building robust notification systems supporting push, email, in-app, and SMS notifications.

---

## Notification Architecture Design

### Multi-Channel Notification Service

```javascript
// src/services/notificationService.js
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.channels = {};
    this.queue = [];
    this.templates = new Map();
    this.preferences = new Map();
    this.deliveryLog = [];
  }

  registerChannel(channelName, handler) {
    this.channels[channelName] = handler;
    console.log(`Channel registered: ${channelName}`);
  }

  async registerTemplate(templateId, template) {
    this.templates.set(templateId, template);
  }

  async notify(userId, notification) {
    // Get user preferences
    const userPrefs = this.preferences.get(userId) || {
      channels: ['email', 'inApp'],
      quiet_hours: null,
      language: 'en'
    };

    // Check quiet hours
    if (this.isInQuietHours(userPrefs.quiet_hours)) {
      // Queue for later
      this.queue.push({ userId, notification, scheduledFor: this.getQuietHoursEnd(userPrefs) });
      return;
    }

    // Get enabled channels for user
    const enabledChannels = userPrefs.channels;

    // Send across channels in parallel
    const deliveryPromises = enabledChannels.map(channel =>
      this.sendToChannel(channel, userId, notification, userPrefs.language)
    );

    try {
      const results = await Promise.all(deliveryPromises);
      return {
        userId,
        notificationId: notification.id,
        channels: results,
        status: 'delivered',
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Notification failed for user ${userId}:`, error);
      this.logDelivery(userId, notification, 'failed', error.message);
      throw error;
    }
  }

  async sendToChannel(channelName, userId, notification, language) {
    const channel = this.channels[channelName];
    if (!channel) {
      throw new Error(`Channel not found: ${channelName}`);
    }

    try {
      const result = await channel.send(userId, notification, language);
      this.logDelivery(userId, notification, 'delivered', null, channelName);
      return { channel: channelName, status: 'sent', result };
    } catch (error) {
      this.logDelivery(userId, notification, 'failed', error.message, channelName);
      throw error;
    }
  }

  async renderTemplate(templateId, data) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return {
      subject: this.interpolate(template.subject, data),
      body: this.interpolate(template.body, data),
      html: this.interpolate(template.html, data),
      data: template.data
    };
  }

  interpolate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  setUserPreferences(userId, preferences) {
    this.preferences.set(userId, preferences);
  }

  isInQuietHours(quietHours) {
    if (!quietHours) return false;
    const now = new Date().getHours();
    return now >= quietHours.start && now < quietHours.end;
  }

  getQuietHoursEnd(userPrefs) {
    if (!userPrefs.quiet_hours) return new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(userPrefs.quiet_hours.end, 0, 0);
    return tomorrow;
  }

  logDelivery(userId, notification, status, errorMessage = null, channel = null) {
    this.deliveryLog.push({
      userId,
      notificationId: notification.id,
      status,
      channel,
      error: errorMessage,
      timestamp: new Date()
    });
  }

  getDeliveryLog(userId) {
    return this.deliveryLog.filter(log => log.userId === userId);
  }
}

module.exports = NotificationService;
```

### Message Queue Integration

```javascript
// src/services/notificationQueue.js
const amqp = require('amqplib');

class NotificationQueue {
  constructor(rabbitmqUrl) {
    this.url = rabbitmqUrl;
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      // Declare exchange and queues
      await this.channel.assertExchange('notifications', 'topic', { durable: true });

      // Create queues for different priorities
      await this.channel.assertQueue('notifications.high', { durable: true });
      await this.channel.assertQueue('notifications.normal', { durable: true });
      await this.channel.assertQueue('notifications.low', { durable: true });

      // Bind queues to exchange
      await this.channel.bindQueue('notifications.high', 'notifications', 'high.*');
      await this.channel.bindQueue('notifications.normal', 'notifications', 'normal.*');
      await this.channel.bindQueue('notifications.low', 'notifications', 'low.*');

      console.log('Connected to message queue');
    } catch (error) {
      console.error('Queue connection error:', error);
      throw error;
    }
  }

  async publish(notification) {
    const priority = notification.priority || 'normal';
    const routingKey = `${priority}.${notification.type}`;

    try {
      const message = JSON.stringify({
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority,
        createdAt: new Date().toISOString(),
        maxRetries: notification.maxRetries || 3,
        retryCount: 0
      });

      const published = this.channel.publish(
        'notifications',
        routingKey,
        Buffer.from(message),
        { persistent: priority !== 'low' }
      );

      if (!published) {
        throw new Error('Failed to publish message to queue');
      }

      console.log(`Published notification: ${notification.id} (${priority})`);
      return { id: notification.id, queued: true };
    } catch (error) {
      console.error('Publish error:', error);
      throw error;
    }
  }

  async consume(queueName, handler) {
    try {
      await this.channel.prefetch(1); // Process one message at a time

      const consumerTag = await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const notification = JSON.parse(msg.content.toString());
          await handler(notification);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Handler error:', error);
          this.channel.nack(msg, false, true); // Requeue message
        }
      });

      console.log(`Consumer started on queue: ${queueName}`);
      return consumerTag;
    } catch (error) {
      console.error('Consumer setup error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

module.exports = NotificationQueue;
```

---

## Template Management

### Template Engine with Localization

```javascript
// src/services/templateManager.js
class TemplateManager {
  constructor() {
    this.templates = new Map();
    this.locales = new Map();
  }

  registerTemplate(templateId, defaultLocale, templates) {
    this.templates.set(templateId, {
      id: templateId,
      createdAt: new Date(),
      updatedAt: new Date(),
      locales: defaultLocale,
      templates
    });
  }

  registerLocale(templateId, locale, template) {
    const stored = this.templates.get(templateId);
    if (!stored) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!stored.locales) {
      stored.locales = {};
    }

    stored.locales[locale] = template;
    stored.updatedAt = new Date();
  }

  async render(templateId, locale, variables) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const localeTemplate = template.locales[locale] || template.locales['en'];
    if (!localeTemplate) {
      throw new Error(`No locale found for template: ${templateId}`);
    }

    return {
      subject: this.interpolate(localeTemplate.subject, variables),
      body: this.interpolate(localeTemplate.body, variables),
      html: this.interpolate(localeTemplate.html, variables),
      data: localeTemplate.data
    };
  }

  interpolate(template, variables) {
    if (!template) return '';

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const keys = key.split('.');
      let value = variables;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }

      return value !== undefined ? value : match;
    });
  }

  // Test template rendering
  async testTemplate(templateId, locale, testVariables) {
    try {
      return await this.render(templateId, locale, testVariables);
    } catch (error) {
      return { error: error.message };
    }
  }

  listTemplates() {
    return Array.from(this.templates.values()).map(t => ({
      id: t.id,
      locales: Object.keys(t.locales),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
  }
}

// Template definitions
const notificationTemplates = {
  'user.welcome': {
    'en': {
      subject: 'Welcome to {{appName}}!',
      body: 'Hi {{firstName}}, welcome aboard!',
      html: '<p>Hi <strong>{{firstName}}</strong>, welcome to {{appName}}!</p>'
    },
    'es': {
      subject: '¡Bienvenido a {{appName}}!',
      body: 'Hola {{firstName}}, ¡bienvenido!',
      html: '<p>Hola <strong>{{firstName}}</strong>, ¡bienvenido a {{appName}}!</p>'
    }
  },
  'order.confirmation': {
    'en': {
      subject: 'Order #{{orderId}} Confirmed',
      body: 'Your order has been confirmed. Total: ${{totalPrice}}',
      html: '<p>Your order <strong>#{{orderId}}</strong> has been confirmed.</p><p>Total: <strong>${{totalPrice}}</strong></p>'
    }
  }
};

module.exports = { TemplateManager, notificationTemplates };
```

---

## Email Service Integration

### SendGrid Integration

```javascript
// src/channels/emailChannel.js
const sgMail = require('@sendgrid/mail');

class EmailChannel {
  constructor(apiKey, fromEmail) {
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
  }

  async send(userId, notification, language) {
    try {
      const message = {
        to: userId, // Or look up user email from database
        from: this.fromEmail,
        subject: notification.subject,
        text: notification.body,
        html: notification.html,
        trackingSettings: {
          clickTracking: { enabled: true },
          openTracking: { enabled: true }
        },
        customArgs: {
          notificationId: notification.id,
          userId: userId,
          language: language
        }
      };

      const response = await sgMail.send(message);
      return {
        messageId: response[0].headers['x-message-id'],
        status: 'sent'
      };
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }

  // Handle bounce/complaint events
  async handleWebhook(event) {
    switch (event.event) {
      case 'bounce':
        return this.handleBounce(event);
      case 'complaint':
        return this.handleComplaint(event);
      case 'dropped':
        return this.handleDropped(event);
      default:
        return null;
    }
  }

  handleBounce(event) {
    return {
      type: 'bounce',
      email: event.email,
      bounceType: event.bounce_type, // permanent or temporary
      bounceSubType: event.bounce_subtype
    };
  }

  handleComplaint(event) {
    return {
      type: 'complaint',
      email: event.email,
      complaintFeedbackType: event.complaint_feedback_type
    };
  }

  handleDropped(event) {
    return {
      type: 'dropped',
      email: event.email,
      reason: event.reason
    };
  }
}

module.exports = EmailChannel;
```

### AWS SES Integration

```javascript
// src/channels/sesChannel.js
const AWS = require('aws-sdk');

class SESChannel {
  constructor(region) {
    this.ses = new AWS.SES({ region });
  }

  async send(userId, notification, language) {
    try {
      const params = {
        Source: 'noreply@example.com',
        Destination: { ToAddresses: [userId] },
        Message: {
          Subject: { Data: notification.subject },
          Body: {
            Html: { Data: notification.html },
            Text: { Data: notification.body }
          }
        },
        Tags: [
          { Name: 'NotificationId', Value: notification.id },
          { Name: 'Language', Value: language }
        ]
      };

      const response = await this.ses.sendEmail(params).promise();
      return {
        messageId: response.MessageId,
        status: 'sent'
      };
    } catch (error) {
      console.error('SES send error:', error);
      throw error;
    }
  }

  async getSendingQuota() {
    const quota = await this.ses.getSendQuota().promise();
    return {
      max24HourSend: quota.Max24HourSend,
      maxSendRate: quota.MaxSendRate,
      sent: quota.Sent
    };
  }
}

module.exports = SESChannel;
```

---

## Slack and Teams Integration

### Slack Channel

```javascript
// src/channels/slackChannel.js
const { WebClient } = require('@slack/web-api');

class SlackChannel {
  constructor(botToken) {
    this.client = new WebClient(botToken);
  }

  async send(userId, notification, language) {
    try {
      // userId should be Slack user ID
      const blocks = this.buildSlackBlocks(notification);

      const response = await this.client.chat.postMessage({
        channel: userId,
        blocks,
        text: notification.body
      });

      return {
        messageId: response.ts,
        status: 'sent'
      };
    } catch (error) {
      console.error('Slack send error:', error);
      throw error;
    }
  }

  buildSlackBlocks(notification) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${notification.title}*\n${notification.body}`
        }
      },
      {
        type: 'actions',
        elements: notification.actions?.map(action => ({
          type: 'button',
          text: { type: 'plain_text', text: action.label },
          value: action.value,
          url: action.url
        })) || []
      }
    ];
  }

  // Send to channel
  async sendToChannel(channelId, notification) {
    try {
      const response = await this.client.chat.postMessage({
        channel: channelId,
        text: notification.body,
        blocks: this.buildSlackBlocks(notification)
      });

      return { messageId: response.ts, status: 'sent' };
    } catch (error) {
      console.error('Channel message error:', error);
      throw error;
    }
  }
}

module.exports = SlackChannel;
```

### Teams Channel

```javascript
// src/channels/teamsChannel.js
const axios = require('axios');

class TeamsChannel {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async send(userId, notification, language) {
    try {
      const card = this.buildAdaptiveCard(notification);

      const response = await axios.post(this.webhookUrl, {
        @type: 'MessageCard',
        @context: 'https://schema.org/extensions',
        summary: notification.title,
        themeColor: notification.color || '0078D7',
        sections: [
          {
            activityTitle: notification.title,
            activitySubtitle: notification.subtitle,
            text: notification.body,
            markdown: true
          }
        ],
        potentialAction: notification.actions?.map(action => ({
          @type: 'OpenUri',
          name: action.label,
          targets: [{ os: 'default', uri: action.url }]
        })) || []
      });

      return { status: 'sent' };
    } catch (error) {
      console.error('Teams send error:', error);
      throw error;
    }
  }

  buildAdaptiveCard(notification) {
    return {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: notification.title,
          weight: 'bolder',
          size: 'large'
        },
        {
          type: 'TextBlock',
          text: notification.body,
          wrap: true
        }
      ],
      actions: notification.actions?.map(action => ({
        type: 'Action.OpenUrl',
        title: action.label,
        url: action.url
      })) || []
    };
  }
}

module.exports = TeamsChannel;
```

---

## Push Notifications

### Firebase Cloud Messaging

```javascript
// src/channels/pushChannel.js
const admin = require('firebase-admin');

class PushChannel {
  constructor(serviceAccountKey) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey)
      });
    }
    this.messaging = admin.messaging();
  }

  async send(userId, notification, language) {
    try {
      // Get FCM token for user (usually stored in database)
      const fcmToken = await this.getFCMToken(userId);

      if (!fcmToken) {
        throw new Error(`No FCM token found for user: ${userId}`);
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: {
          notificationId: notification.id,
          deepLink: notification.deepLink,
          ...notification.data
        },
        token: fcmToken,
        android: {
          priority: notification.priority === 'high' ? 'high' : 'normal',
          notification: {
            clickAction: notification.deepLink,
            color: '#FF6B6B'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default'
            }
          }
        }
      };

      const response = await this.messaging.send(message);
      return { messageId: response, status: 'sent' };
    } catch (error) {
      console.error('Push send error:', error);
      throw error;
    }
  }

  async sendMulticast(userIds, notification) {
    const tokens = await Promise.all(
      userIds.map(userId => this.getFCMToken(userId))
    );

    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data
    };

    const response = await this.messaging.sendMulticast({ ...message, tokens });
    return {
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  }

  async getFCMToken(userId) {
    // In real implementation, fetch from database
    // For now, mock implementation
    return `fcm_token_${userId}`;
  }

  // Handle token refresh
  async onTokenRefresh(userId, newToken) {
    // Update token in database
    console.log(`Token refreshed for user ${userId}`);
  }

  // Handle error responses
  async handleSendError(error) {
    if (error.code === 'messaging/invalid-registration-token') {
      return 'invalid_token';
    }
    if (error.code === 'messaging/registration-token-not-registered') {
      return 'token_not_registered';
    }
    return 'unknown_error';
  }
}

module.exports = PushChannel;
```

---

## Notification Deduplication and Throttling

### Deduplication Engine

```javascript
// src/services/deduplicationService.js
const crypto = require('crypto');

class DeduplicationService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  // Create fingerprint for notification
  createFingerprint(userId, notificationType, data) {
    const content = `${userId}:${notificationType}:${JSON.stringify(data)}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Check if notification was recently sent
  async isDuplicate(userId, notificationType, data, deduplicationWindowMs = 3600000) {
    const fingerprint = this.createFingerprint(userId, notificationType, data);
    const key = `notif_dedup:${fingerprint}`;

    const exists = await this.redis.get(key);
    if (exists) {
      return true;
    }

    // Mark as sent
    await this.redis.setex(key, Math.ceil(deduplicationWindowMs / 1000), '1');
    return false;
  }

  // Throttle notifications per user
  async isThrottled(userId, maxPerHour = 10) {
    const key = `notif_throttle:${userId}:${new Date().getHours()}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 3600); // 1 hour
    }

    return count > maxPerHour;
  }

  async clearThrottle(userId) {
    const pattern = `notif_throttle:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

module.exports = DeduplicationService;
```

### Throttling Strategies

```javascript
// src/services/throttlingService.js
class ThrottlingService {
  constructor() {
    this.userNotificationCounts = new Map();
  }

  // Token bucket algorithm
  async canSendNotification(userId, capacity = 5, refillRatePerHour = 10) {
    const now = Date.now();
    const userBucket = this.userNotificationCounts.get(userId) || {
      tokens: capacity,
      lastRefill: now
    };

    // Refill tokens based on time elapsed
    const timeSinceLastRefill = now - userBucket.lastRefill;
    const tokensToAdd = (timeSinceLastRefill / (3600 * 1000)) * refillRatePerHour;
    userBucket.tokens = Math.min(capacity, userBucket.tokens + tokensToAdd);

    if (userBucket.tokens >= 1) {
      userBucket.tokens -= 1;
      userBucket.lastRefill = now;
      this.userNotificationCounts.set(userId, userBucket);
      return { allowed: true, tokensRemaining: Math.floor(userBucket.tokens) };
    }

    return {
      allowed: false,
      retryAfterMs: (1 - userBucket.tokens) * (3600 * 1000) / refillRatePerHour
    };
  }

  // Daily digest mode
  async shouldDigest(userId, digestTime = '08:00') {
    const userPrefs = this.getUserPreferences(userId);
    if (!userPrefs.digestMode) return false;

    const now = new Date();
    const [hour, minute] = digestTime.split(':').map(Number);

    const nextDigestTime = new Date();
    nextDigestTime.setHours(hour, minute, 0);

    // If current time is past digest time, schedule for tomorrow
    if (now > nextDigestTime) {
      nextDigestTime.setDate(nextDigestTime.getDate() + 1);
    }

    return { shouldDigest: true, nextDigestTime };
  }

  getUserPreferences(userId) {
    // Mock implementation
    return { digestMode: false };
  }
}

module.exports = ThrottlingService;
```

---

## Delivery Tracking and Analytics

### Delivery Status Tracking

```javascript
// src/services/deliveryTracking.js
class DeliveryTracking {
  constructor(elasticsearchClient) {
    this.es = elasticsearchClient;
  }

  async trackDelivery(notificationId, userId, channel, status, metadata = {}) {
    const document = {
      notificationId,
      userId,
      channel,
      status, // sent, delivered, failed, bounced, complained
      timestamp: new Date().toISOString(),
      ...metadata
    };

    await this.es.index({
      index: 'notification_delivery',
      body: document
    });
  }

  async getDeliveryMetrics(timeRangeMinutes = 1440) {
    const searchBody = {
      query: {
        range: {
          timestamp: { gte: `now-${timeRangeMinutes}m` }
        }
      },
      aggs: {
        byStatus: {
          terms: { field: 'status.keyword' }
        },
        byChannel: {
          terms: { field: 'channel.keyword' }
        },
        deliveryRate: {
          filter: { term: { status: 'delivered' } }
        },
        bounceRate: {
          filter: { term: { status: 'bounced' } }
        }
      },
      size: 0
    };

    const result = await this.es.search({
      index: 'notification_delivery',
      body: searchBody
    });

    const totalDocs = result.hits.total.value;
    const delivered = result.aggregations.deliveryRate.doc_count;
    const bounced = result.aggregations.bounceRate.doc_count;

    return {
      totalSent: totalDocs,
      deliveryRate: ((delivered / totalDocs) * 100).toFixed(2),
      bounceRate: ((bounced / totalDocs) * 100).toFixed(2),
      byStatus: result.aggregations.byStatus.buckets,
      byChannel: result.aggregations.byChannel.buckets
    };
  }

  async getFailedNotifications(limit = 50) {
    const searchBody = {
      query: {
        term: { status: 'failed' }
      },
      sort: [{ timestamp: { order: 'desc' } }],
      size: limit
    };

    const result = await this.es.search({
      index: 'notification_delivery',
      body: searchBody
    });

    return result.hits.hits.map(hit => hit._source);
  }
}

module.exports = DeliveryTracking;
```

---

## User Preference Management

### Preference Storage and Retrieval

```javascript
// src/services/userPreferences.js
class UserPreferences {
  constructor(database) {
    this.db = database;
  }

  async getPreferences(userId) {
    const prefs = await this.db.query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );

    return prefs.rows[0] || this.getDefaultPreferences();
  }

  async updatePreferences(userId, preferences) {
    const allowedKeys = [
      'email_enabled',
      'push_enabled',
      'sms_enabled',
      'in_app_enabled',
      'digest_enabled',
      'digest_frequency',
      'quiet_hours_start',
      'quiet_hours_end',
      'language',
      'notification_categories'
    ];

    // Validate preferences
    for (const key of Object.keys(preferences)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Invalid preference key: ${key}`);
      }
    }

    const updateQuery = `
      UPDATE user_notification_preferences
      SET ${Object.keys(preferences).map((k, i) => `${k} = $${i + 2}`).join(', ')}
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.db.query(updateQuery, [userId, ...Object.values(preferences)]);
    return result.rows[0];
  }

  async getChannelsForUser(userId) {
    const prefs = await this.getPreferences(userId);
    const channels = [];

    if (prefs.email_enabled) channels.push('email');
    if (prefs.push_enabled) channels.push('push');
    if (prefs.sms_enabled) channels.push('sms');
    if (prefs.in_app_enabled) channels.push('inApp');

    return channels;
  }

  async unsubscribeFromCategory(userId, category) {
    const prefs = await this.getPreferences(userId);
    const categories = prefs.notification_categories || [];

    const updated = categories.filter(c => c !== category);

    await this.updatePreferences(userId, {
      notification_categories: updated
    });
  }

  getDefaultPreferences() {
    return {
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      in_app_enabled: true,
      digest_enabled: false,
      digest_frequency: 'daily',
      quiet_hours_start: null,
      quiet_hours_end: null,
      language: 'en',
      notification_categories: []
    };
  }
}

module.exports = UserPreferences;
```

---

## Complete Integration Example

```javascript
// src/index.js
const NotificationService = require('./services/notificationService');
const NotificationQueue = require('./services/notificationQueue');
const { TemplateManager } = require('./services/templateManager');
const EmailChannel = require('./channels/emailChannel');
const PushChannel = require('./channels/pushChannel');
const SlackChannel = require('./channels/slackChannel');

async function setupNotificationSystem() {
  // Initialize services
  const notificationService = new NotificationService();
  const queue = new NotificationQueue('amqp://guest:guest@localhost');
  const templateManager = new TemplateManager();

  // Register channels
  const emailChannel = new EmailChannel('sendgrid-api-key', 'noreply@example.com');
  const pushChannel = new PushChannel(require('./firebase-config.json'));
  const slackChannel = new SlackChannel('xoxb-slack-bot-token');

  notificationService.registerChannel('email', emailChannel);
  notificationService.registerChannel('push', pushChannel);
  notificationService.registerChannel('slack', slackChannel);

  // Register templates
  templateManager.registerTemplate('user.welcome', 'en', {
    'en': {
      subject: 'Welcome to Our Platform',
      body: 'Welcome {{firstName}}!',
      html: '<p>Welcome <strong>{{firstName}}</strong>!</p>'
    }
  });

  await queue.connect();

  // Start consuming notifications
  await queue.consume('notifications.high', async (notification) => {
    const rendered = await templateManager.render(
      notification.type,
      notification.language,
      notification.variables
    );

    await notificationService.notify(notification.userId, {
      ...notification,
      ...rendered
    });
  });

  return { notificationService, queue, templateManager };
}

module.exports = { setupNotificationSystem };
```

---

## Best Practices Summary

1. **Respect User Preferences**: Always check channel preferences before sending
2. **Deduplicate Aggressively**: Prevent notification fatigue with smart deduplication
3. **Monitor Delivery**: Track metrics on delivery success, bounces, complaints
4. **Template Everything**: Use templates for consistency and maintainability
5. **Queue Intelligently**: Separate high/normal/low priority queues
6. **Handle Failures Gracefully**: Implement retry logic with exponential backoff
7. **Track Engagement**: Monitor open rates, click rates, unsubscribes
8. **Localize Content**: Support multiple languages and regions
9. **Implement Throttling**: Prevent users from being overwhelmed
10. **Test Extensively**: Test templates, channels, and integration points

---

## Resources

- RabbitMQ Messaging: https://www.rabbitmq.com/
- SendGrid Email API: https://sendgrid.com/docs/
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
- Slack API Documentation: https://api.slack.com/
- Microsoft Teams Webhooks: https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/
