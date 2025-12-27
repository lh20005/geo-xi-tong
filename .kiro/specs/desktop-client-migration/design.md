# Design Document: Desktop Client Migration

## Overview

This document describes the technical design for migrating the complete web-based frontend application to the existing Windows desktop client. The migration will transform the current browser-based React application into a native Electron desktop application while preserving all functionality, UI design, and user experience.

### Goals

1. **Complete Feature Parity**: All 30+ pages and features from the web frontend available in desktop client
2. **Pixel-Perfect UI**: Exact visual replication of web frontend design
3. **Performance Improvement**: Faster load times and better responsiveness through local rendering
4. **Seamless Integration**: Preserve existing login management functionality
5. **Maintainability**: Clean architecture that supports future development

### Non-Goals

1. Changing backend API contracts or server-side logic
2. Modifying existing database schema
3. Implementing new features not present in web frontend
4. Supporting platforms other than Windows (initially)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop Application                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Electron Main Process                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │ Window Mgmt  │  │  IPC Handler │  │  WebSocket  │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │ Auth Manager │  │ Storage Mgr  │  │   Logger    │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕ IPC                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Electron Renderer Process                   │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │              React Application                    │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │ │  │
│  │  │  │   Router   │  │  Layout    │  │   Pages    │ │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘ │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │ │  │
│  │  │  │ Components │  │   State    │  │  Services  │ │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘ │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                      Backend Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │   Database   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Separation of Concerns**: Main process handles system operations, renderer handles UI
2. **Security First**: Context isolation, sandboxing, and secure IPC communication
3. **Progressive Enhancement**: Graceful degradation when services unavailable
4. **Code Reuse**: Maximum reuse of existing web frontend code
5. **Type Safety**: Full TypeScript coverage for reliability

## Components and Interfaces

### 1. Main Process Components

#### 1.1 Application Manager

**Responsibility**: Manages application lifecycle, window creation, and coordination

```typescript
interface ApplicationManager {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Window Management
  createMainWindow(): BrowserWindow;
  getMainWindow(): BrowserWindow | null;
  focusMainWindow(): void;
  
  // State
  hasWindow(): boolean;
  isQuitting(): boolean;
}
```

**Key Features**:
- Single instance enforcement
- Window state persistence (size, position)
- Graceful shutdown handling
- Crash recovery integration

#### 1.2 IPC Handler

**Responsibility**: Handles inter-process communication between main and renderer

```typescript
interface IPCHandler {
  // Registration
  registerHandlers(): Promise<void>;
  
  // Authentication
  handleLogin(credentials: LoginCredentials): Promise<AuthResult>;
  handleLogout(): Promise<void>;
  handleCheckAuth(): Promise<AuthStatus>;
  handleRefreshToken(): Promise<TokenResult>;
  
  // Platform Management (existing)
  handleGetPlatforms(): Promise<Platform[]>;
  handleSaveAccount(account: Account): Promise<SaveResult>;
  handleGetAccounts(platform: string): Promise<Account[]>;
  handleDeleteAccount(id: string): Promise<void>;
  handleRefreshAccount(id: string): Promise<Account>;
  
  // API Proxy
  handleApiRequest(request: ApiRequest): Promise<ApiResponse>;
  
  // Storage
  handleGetConfig(): Promise<Config>;
  handleSaveConfig(config: Config): Promise<void>;
  handleGetUserData(key: string): Promise<any>;
  handleSetUserData(key: string, value: any): Promise<void>;
  
  // System
  handleOpenExternal(url: string): Promise<void>;
  handleShowItemInFolder(path: string): Promise<void>;
  handleGetAppVersion(): Promise<string>;
}
```

**Security Considerations**:
- Input validation for all IPC messages
- Rate limiting for sensitive operations
- Audit logging for security-relevant actions

#### 1.3 WebSocket Manager

**Responsibility**: Manages WebSocket connections for real-time updates

```typescript
interface WebSocketManager {
  // Connection
  initialize(config: WSConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // Messaging
  send(message: WSMessage): void;
  subscribe(channels: string[]): void;
  unsubscribe(channels: string[]): void;
  
  // Events
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  
  // State
  isConnected(): boolean;
  getConnectionState(): ConnectionState;
}
```

**Features**:
- Automatic reconnection with exponential backoff
- Heartbeat/ping-pong for connection health
- Message queuing during disconnection
- Event-based architecture for loose coupling

#### 1.4 Storage Manager

**Responsibility**: Manages persistent data storage using electron-store

```typescript
interface StorageManager {
  // Configuration
  getConfig(): Promise<Config>;
  saveConfig(config: Config): Promise<void>;
  
  // Authentication
  getTokens(): Promise<Tokens | null>;
  saveTokens(tokens: Tokens): Promise<void>;
  clearTokens(): Promise<void>;
  
  // User Data
  getUserData(key: string): Promise<any>;
  setUserData(key: string, value: any): Promise<void>;
  deleteUserData(key: string): Promise<void>;
  
  // Window State
  getWindowState(): Promise<WindowState>;
  saveWindowState(state: WindowState): Promise<void>;
  
  // Cache
  getCacheItem(key: string): Promise<any>;
  setCacheItem(key: string, value: any, ttl?: number): Promise<void>;
  clearCache(): Promise<void>;
}
```

**Storage Schema**:
```type