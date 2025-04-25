# Custom Logs System Documentation

## Issue Analysis & Solution

### The Problem
The bot was experiencing duplicate logging issues where:
1. Multiple logging systems (Logger and CustomLogs) were both capturing the same events
2. Some event handlers had redundant logging calls
3. The logUserActivity method wasn't handling object parameters consistently

### Changes Made

1. **Enhanced `logUserActivity` Method**:
   - Now accepts either a user ID or a userData object
   - Extracts relevant information from userData objects
   - Implements duplicate detection to prevent logging the same activity multiple times within 3 seconds
   - Properly consolidates properties from userData into the log details

2. **Improved Event Handler Logging**:
   - Updated `channelCreate.js` to use `logSecurity` instead of generic `log` method
   - Standardized the parameter passing in `messageCreate.js`
   - Removed redundant log calls that were causing duplication

## Best Practices for Logging

### When to Use Each Method

- **logUserActivity**: For user-related actions (messages, voice activity, etc.)
  ```js
  client.customLogs.logUserActivity('actionType', userData, guildId, additionalDetails);
  ```

- **logSecurity**: For security-related events (channel creation/deletion, permission changes)
  ```js
  client.customLogs.logSecurity('eventType', userId, guildId, details);
  ```

- **logCommand**: For tracking command executions
  ```js
  client.customLogs.logCommand(commandName, userId, guildId, success, latency, error);
  ```

- **logError**: For error tracking
  ```js
  client.customLogs.logError(error, context, userId, guildId);
  ```

- **logPerformance**: For performance monitoring
  ```js
  client.customLogs.logPerformance(operation, latency, success, details);
  ```

### Avoiding Duplicate Logs

1. Don't mix Logger and CustomLogs for the same event
2. Pass complete objects to logUserActivity rather than individual fields
3. For server events, use logSecurity instead of the generic log method
4. Set proper severity levels to ensure logs appear in the right channels

## System Architecture

- **Logger**: Handles direct Discord webhook integration and file-based logging
- **CustomLogs**: Provides analytics, security monitoring, and specialized logging methods
- **InMemoryStorage**: Stores recent logs for quick access and duplicate detection

The two systems complement each other but should be used for different purposes to avoid duplication. 