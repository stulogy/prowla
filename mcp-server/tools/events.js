/**
 * Events Tools
 * 
 * MCP tools for subscribing to and receiving events from the job tracker.
 * Supports both polling and webhook delivery modes.
 * 
 * Event Types:
 * - job.created: New job added
 * - job.updated: Job fields changed
 * - job.deleted: Job removed
 * - task.created: New task queued
 * - task.claimed: Task locked by agent
 * - task.completed: Task finished
 * - research.saved: Research notes saved
 * - materials.saved: Cover letter or email saved
 * 
 * Tools:
 * - events_subscribe: Register for event notifications
 * - events_unsubscribe: Remove subscription
 * - events_list: Get recent events
 * - events_poll: Long-poll for new events
 * 
 * @module tools/events
 */

import { 
  EVENT_TYPES,
  subscribe, 
  unsubscribe, 
  listEvents, 
  poll,
  getSubscription 
} from '../lib/event-emitter.js';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'events_subscribe',
    description: 'Subscribe to events. Returns a subscription ID for polling or use with webhooks.',
    inputSchema: {
      type: 'object',
      properties: {
        event_types: {
          type: 'array',
          items: { 
            type: 'string',
            enum: EVENT_TYPES
          },
          description: `Event types to subscribe to. Valid types: ${EVENT_TYPES.join(', ')}`
        },
        webhook_url: {
          type: 'string',
          description: 'Optional webhook URL for push delivery. Events will be POSTed to this URL.'
        },
        callback_id: {
          type: 'string',
          description: 'Optional identifier for the subscriber (e.g., agent name)'
        }
      },
      required: ['event_types']
    }
  },
  {
    name: 'events_unsubscribe',
    description: 'Remove an event subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'string',
          description: 'The subscription ID to remove'
        }
      },
      required: ['subscription_id']
    }
  },
  {
    name: 'events_list',
    description: 'Get recent events. Useful for checking what happened while agent was offline.',
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'Return events after this ISO timestamp'
        },
        type: {
          type: 'string',
          description: 'Filter by event type',
          enum: EVENT_TYPES
        },
        limit: {
          type: 'number',
          description: 'Maximum events to return (default: 100)',
          default: 100
        }
      }
    }
  },
  {
    name: 'events_poll',
    description: 'Long-poll for new events. Waits until events occur or timeout. Returns events since last poll for this subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'string',
          description: 'The subscription ID to poll for'
        },
        timeout_ms: {
          type: 'number',
          description: 'How long to wait for events in milliseconds (default: 30000)',
          default: 30000
        }
      },
      required: ['subscription_id']
    }
  }
];

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * Subscribe to events
   */
  events_subscribe: ({ event_types, webhook_url = null, callback_id = null }) => {
    // Validate event types
    const invalidTypes = event_types.filter(t => !EVENT_TYPES.includes(t));
    if (invalidTypes.length > 0) {
      return { 
        error: 'Invalid event types', 
        invalid_types: invalidTypes,
        valid_types: EVENT_TYPES
      };
    }
    
    return subscribe({ event_types, webhook_url, callback_id });
  },

  /**
   * Unsubscribe from events
   */
  events_unsubscribe: ({ subscription_id }) => {
    return unsubscribe(subscription_id);
  },

  /**
   * List recent events
   */
  events_list: ({ since = null, type = null, limit = 100 }) => {
    const events = listEvents({ since, type, limit });
    return {
      events,
      count: events.length,
      available_types: EVENT_TYPES
    };
  },

  /**
   * Long-poll for events
   */
  events_poll: async ({ subscription_id, timeout_ms = 30000 }) => {
    // Verify subscription exists
    const subscription = getSubscription(subscription_id);
    if (!subscription) {
      return { 
        error: 'Subscription not found', 
        subscription_id 
      };
    }
    
    // Poll for events
    const result = await poll(subscription_id, timeout_ms);
    
    return {
      ...result,
      subscription_id,
      event_types: subscription.event_types,
      count: result.events?.length || 0
    };
  }
};

export default { toolDefinitions, handlers };
