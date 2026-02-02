/**
 * Event Emitter System
 * 
 * Provides an event bus for the MCP server to emit and subscribe to events.
 * Supports both polling and webhook delivery modes.
 * 
 * Event Types:
 * - job.created - New job added to database
 * - job.updated - Job fields updated
 * - job.deleted - Job removed from database
 * - task.created - New task queued
 * - task.claimed - Task locked by an agent
 * - task.completed - Task finished and removed
 * - research.saved - Research notes saved for a job
 * - materials.saved - Cover letter or email saved
 * 
 * @module lib/event-emitter
 */

import crypto from 'crypto';

/**
 * Valid event types
 * @type {string[]}
 */
export const EVENT_TYPES = [
  'job.created',
  'job.updated',
  'job.deleted',
  'task.created',
  'task.claimed',
  'task.completed',
  'research.saved',
  'materials.saved'
];

/**
 * In-memory event store
 * Stores recent events for polling
 * @type {Event[]}
 */
let eventStore = [];

/**
 * Maximum events to keep in memory
 */
const MAX_EVENTS = 1000;

/**
 * Event retention period (1 hour)
 */
const EVENT_RETENTION_MS = 60 * 60 * 1000;

/**
 * Subscription store
 * @type {Map<string, Subscription>}
 */
const subscriptions = new Map();

/**
 * Pending poll requests (for long-polling)
 * @type {Map<string, PendingPoll>}
 */
const pendingPolls = new Map();

/**
 * Generate a unique ID
 * @returns {string} UUID
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Event class
 * @typedef {Object} Event
 * @property {string} id - Unique event ID
 * @property {string} type - Event type
 * @property {string} timestamp - ISO timestamp
 * @property {Object} payload - Event-specific data
 */

/**
 * Subscription class
 * @typedef {Object} Subscription
 * @property {string} id - Subscription ID
 * @property {string[]} event_types - Event types to subscribe to
 * @property {string} webhook_url - Optional webhook URL
 * @property {string} callback_id - Optional callback identifier
 * @property {string} created_at - ISO timestamp
 * @property {string} last_event_id - Last event ID delivered
 */

/**
 * Emit an event
 * 
 * Creates an event, stores it, and notifies subscribers.
 * 
 * @param {string} type - Event type
 * @param {Object} payload - Event payload
 * @returns {Event} The emitted event
 */
export function emit(type, payload = {}) {
  if (!EVENT_TYPES.includes(type)) {
    console.warn(`Unknown event type: ${type}`);
  }

  const event = {
    id: generateId(),
    type,
    timestamp: new Date().toISOString(),
    payload
  };

  // Store event
  eventStore.push(event);

  // Trim old events
  pruneEvents();

  // Notify polling subscribers
  notifyPollers(event);

  // Notify webhook subscribers (async)
  notifyWebhooks(event);

  console.log(`[Event] ${type}:`, JSON.stringify(payload));

  return event;
}

/**
 * Remove old events from store
 */
function pruneEvents() {
  const now = Date.now();
  const cutoff = now - EVENT_RETENTION_MS;

  // Remove events older than retention period
  eventStore = eventStore.filter(e => {
    return new Date(e.timestamp).getTime() > cutoff;
  });

  // Also enforce max count
  if (eventStore.length > MAX_EVENTS) {
    eventStore = eventStore.slice(-MAX_EVENTS);
  }
}

/**
 * Notify long-polling subscribers
 * @param {Event} event - The emitted event
 */
function notifyPollers(event) {
  for (const [pollId, poll] of pendingPolls) {
    const subscription = subscriptions.get(poll.subscription_id);
    if (!subscription) continue;

    // Check if subscription is interested in this event type
    if (subscription.event_types.includes(event.type)) {
      // Resolve the poll
      poll.resolve([event]);
      pendingPolls.delete(pollId);
    }
  }
}

/**
 * Notify webhook subscribers
 * @param {Event} event - The emitted event
 */
async function notifyWebhooks(event) {
  for (const [subId, subscription] of subscriptions) {
    if (!subscription.webhook_url) continue;
    if (!subscription.event_types.includes(event.type)) continue;

    try {
      await fetch(subscription.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      
      // Update last event ID
      subscription.last_event_id = event.id;
    } catch (e) {
      console.error(`Webhook delivery failed for ${subscription.webhook_url}:`, e.message);
    }
  }
}

/**
 * Subscribe to events
 * 
 * @param {Object} options - Subscription options
 * @param {string[]} options.event_types - Event types to subscribe to
 * @param {string} options.webhook_url - Optional webhook URL for push delivery
 * @param {string} options.callback_id - Optional identifier for the subscriber
 * @returns {Object} Subscription result
 */
export function subscribe({ event_types, webhook_url = null, callback_id = null }) {
  // Validate event types
  const validTypes = event_types.filter(t => EVENT_TYPES.includes(t));
  if (validTypes.length === 0) {
    return { success: false, error: 'No valid event types specified' };
  }

  const subscription = {
    id: generateId(),
    event_types: validTypes,
    webhook_url,
    callback_id,
    created_at: new Date().toISOString(),
    last_event_id: null
  };

  subscriptions.set(subscription.id, subscription);

  return { 
    success: true, 
    subscription_id: subscription.id,
    event_types: validTypes
  };
}

/**
 * Unsubscribe from events
 * 
 * @param {string} subscriptionId - Subscription ID to remove
 * @returns {Object} Result
 */
export function unsubscribe(subscriptionId) {
  if (!subscriptions.has(subscriptionId)) {
    return { success: false, error: 'Subscription not found' };
  }

  subscriptions.delete(subscriptionId);

  // Also cancel any pending polls for this subscription
  for (const [pollId, poll] of pendingPolls) {
    if (poll.subscription_id === subscriptionId) {
      poll.resolve([]);
      pendingPolls.delete(pollId);
    }
  }

  return { success: true };
}

/**
 * List recent events
 * 
 * @param {Object} options - Query options
 * @param {string} options.since - Return events after this timestamp
 * @param {string} options.type - Filter by event type
 * @param {number} options.limit - Max events to return
 * @returns {Event[]} Array of events
 */
export function listEvents({ since = null, type = null, limit = 100 } = {}) {
  let events = [...eventStore];

  // Filter by timestamp
  if (since) {
    const sinceTime = new Date(since).getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() > sinceTime);
  }

  // Filter by type
  if (type) {
    events = events.filter(e => e.type === type);
  }

  // Sort by timestamp (newest first)
  events.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Apply limit
  return events.slice(0, limit);
}

/**
 * Long-poll for events
 * 
 * Waits for new events matching the subscription, or returns after timeout.
 * 
 * @param {string} subscriptionId - Subscription ID
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise<Event[]>} Array of events (may be empty on timeout)
 */
export function poll(subscriptionId, timeoutMs = 30000) {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) {
    return Promise.resolve({ error: 'Subscription not found', events: [] });
  }

  // Check for any events since last poll
  const lastEventTime = subscription.last_event_id 
    ? eventStore.find(e => e.id === subscription.last_event_id)?.timestamp
    : null;

  const pendingEvents = eventStore.filter(e => {
    if (!subscription.event_types.includes(e.type)) return false;
    if (lastEventTime && new Date(e.timestamp) <= new Date(lastEventTime)) return false;
    return true;
  });

  // If we have pending events, return them immediately
  if (pendingEvents.length > 0) {
    subscription.last_event_id = pendingEvents[pendingEvents.length - 1].id;
    return Promise.resolve({ events: pendingEvents });
  }

  // Otherwise, set up long-poll
  return new Promise((resolve) => {
    const pollId = generateId();
    const timeout = setTimeout(() => {
      pendingPolls.delete(pollId);
      resolve({ events: [] }); // Timeout with no events
    }, timeoutMs);

    pendingPolls.set(pollId, {
      subscription_id: subscriptionId,
      resolve: (events) => {
        clearTimeout(timeout);
        if (events.length > 0) {
          subscription.last_event_id = events[events.length - 1].id;
        }
        resolve({ events });
      }
    });
  });
}

/**
 * Get subscription info
 * @param {string} subscriptionId - Subscription ID
 * @returns {Subscription|null} Subscription or null
 */
export function getSubscription(subscriptionId) {
  return subscriptions.get(subscriptionId) || null;
}

/**
 * List all subscriptions
 * @returns {Subscription[]} Array of subscriptions
 */
export function listSubscriptions() {
  return Array.from(subscriptions.values());
}

/**
 * Clear all events and subscriptions (for testing)
 */
export function reset() {
  eventStore = [];
  subscriptions.clear();
  for (const [pollId, poll] of pendingPolls) {
    poll.resolve([]);
  }
  pendingPolls.clear();
}

export default {
  EVENT_TYPES,
  emit,
  subscribe,
  unsubscribe,
  listEvents,
  poll,
  getSubscription,
  listSubscriptions,
  reset
};
