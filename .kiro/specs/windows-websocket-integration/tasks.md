# Implementation Plan: Windows WebSocket Integration

## Overview

This implementation plan adds real-time account synchronization to the Windows login manager by integrating the existing WebSocket client with the application lifecycle. The tasks are organized to build incrementally, starting with the WebSocket manager, then integrating it with the main process, adding IPC handlers, and finally connecting the renderer process.

## Tasks

- [ ] 1. Create WebSocket Manager
  - Create `windows-login-manager/electron/websocket/manager.ts`
  - Implement WebSocketManager class with initialization, connection, and lifecycle management
  - Add URL derivation logic (HTTP/HTTPS to WS/WSS)
  - Add event handler setup for account events
  - Add local cache update logic for account events
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3_

- [ ] 1.1 Write property test for URL derivation
  - **Property 1: WebSocket URL Derivation Consistency**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 1.2 Write unit tests for WebSocket Manager
  - Test initialization with valid configuration
  - Test connection lifecycle (connect, disconnect, reconnect)
  - Test error handling for invalid URLs
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Integrate WebSocket Manager with Main Process
  - Modify `windows-login-manager/electron/main.ts`
  - Add WebSocketManager instance to ApplicationManager
  - Add `initializeWebSocket()` method to load config and initialize WebSocket
  - Add `deriveWebSocketUrl()` helper method
  - Call `initializeWebSocket()` during application initialization
  - Add WebSocket disconnection to `handleAppQuit()`
  - _Requirements: 1.1, 1.2, 4.1, 6.4_

- [ ] 2.1 Write integration test for WebSocket initialization
  - Test WebSocket initializes on app startup
  - Test WebSocket uses correct URL from configuration
  - Test WebSocket disconnects on app quit
  - _Requirements: 1.1, 4.1_

- [ ] 3. Extend IPC Handler for WebSocket Events
  - Modify `windows-login-manager/electron/ipc/handler.ts`
  - Add WebSocketManager reference to IPCHandler
  - Add `registerWebSocketHandlers()` method
  - Implement `get-websocket-status` IPC handler
  - Implement `reconnect-websocket` IPC handler
  - Add `broadcastAccountEvent()` method to forward events to all renderer processes
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.1 Write property test for event forwarding
  - **Property 3: Event Forwarding Completeness**
  - **Validates: Requirements 3.1, 3.2**

- [ ] 3.2 Write unit tests for IPC WebSocket handlers
  - Test `get-websocket-status` returns correct status
  - Test `reconnect-websocket` triggers reconnection
  - Test `broadcastAccountEvent` forwards to all windows
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Connect WebSocket Events to IPC Handler
  - Modify WebSocketManager to accept IPC handler reference
  - In `setupEventHandlers()`, call `ipcHandler.broadcastAccountEvent()` when account events are received
  - Ensure event forwarding happens after cache update
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

- [ ] 4.1 Write property test for cache synchronization
  - **Property 2: Event Cache Synchronization**
  - **Validates: Requirements 2.4**

- [ ] 4.2 Write integration test for event flow
  - Test account.created event updates cache and forwards to renderer
  - Test account.updated event updates cache and forwards to renderer
  - Test account.deleted event updates cache and forwards to renderer
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

- [ ] 5. Update Preload Script for Event Forwarding
  - Modify `windows-login-manager/electron/preload.ts`
  - Expose `ipcRenderer.on('account-event', callback)` to renderer
  - Expose `ipcRenderer.removeListener('account-event', callback)` to renderer
  - Expose `invoke('get-websocket-status')` to renderer
  - Expose `invoke('reconnect-websocket')` to renderer
  - _Requirements: 3.2_

- [ ] 6. Add Renderer Process Event Listener
  - Identify the main account management component in the renderer
  - Add `useEffect` hook to listen for 'account-event' IPC messages
  - Implement event handler to update local state based on event type
  - Add cleanup to remove listener on component unmount
  - _Requirements: 3.2_

- [ ] 6.1 Write integration test for renderer event handling
  - Test renderer receives account.created event and updates UI
  - Test renderer receives account.updated event and updates UI
  - Test renderer receives account.deleted event and updates UI
  - _Requirements: 3.2_

- [ ] 7. Add WebSocket Reconnection on Configuration Change
  - Modify the config save handler in IPC handler
  - When server URL changes, call `wsManager.reconnect()` with new URL
  - When tokens are refreshed, call `wsManager.reconnect()` with new token
  - _Requirements: 4.2, 4.3, 6.4_

- [ ] 7.1 Write integration test for configuration changes
  - Test WebSocket reconnects when server URL changes
  - Test WebSocket re-authenticates when token refreshes
  - _Requirements: 4.2, 4.3, 6.4_

- [ ] 8. Add Error Handling and Logging
  - Add comprehensive error logging to WebSocketManager
  - Add error handling for connection failures
  - Add error handling for authentication failures
  - Add error handling for event processing failures
  - Ensure application continues functioning if WebSocket fails
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8.1 Write unit tests for error scenarios
  - Test connection failure handling
  - Test authentication failure handling
  - Test invalid event format handling
  - Test reconnection after errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 9. Checkpoint - Manual Testing
  - Ensure all tests pass
  - Test real-time synchronization between Windows and web clients
  - Test network disconnection and reconnection
  - Test configuration changes
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- The checkpoint ensures incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
