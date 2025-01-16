import EventEmitter from 'node:events';
import { MCPError, MCPErrorCode } from '../errors.js';

/**
 * All possible server states
 */
export type ServerState =
  | 'not_installed'
  | 'installing'
  | 'installed'
  | 'starting'
  | 'initializing'
  | 'connected'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * State transition events
 */
export type StateTransitionEvent =
  | 'install'
  | 'install_complete'
  | 'start'
  | 'initialize'
  | 'connect'
  | 'stop'
  | 'error'
  | 'recover';

/**
 * State metadata for persistence and recovery
 */
export interface StateMetadata {
  timestamp: number;
  error?: Error;
  retryCount: number;
  lastSuccessfulState?: ServerState;
  capabilities?: string[];
}

/**
 * Server state machine with validation and recovery
 */
export class ServerStateMachine extends EventEmitter {
  private currentState: ServerState = 'not_installed';
  private metadata: StateMetadata = {
    timestamp: Date.now(),
    retryCount: 0,
  };

  // Valid state transitions
  private readonly transitions = new Map<ServerState, Set<StateTransitionEvent>>([
    ['not_installed', new Set(['install'])],
    ['installing', new Set(['install_complete', 'error'])],
    ['installed', new Set(['start', 'error'])],
    ['starting', new Set(['initialize', 'error'])],
    ['initializing', new Set(['connect', 'error'])],
    ['connected', new Set(['stop', 'error'])],
    ['stopping', new Set(['stop', 'error'])],
    ['stopped', new Set(['start', 'error'])],
    ['error', new Set(['recover'])],
  ]);

  /**
   * Get current state
   */
  getState(): ServerState {
    return this.currentState;
  }

  /**
   * Get state metadata
   */
  getMetadata(): StateMetadata {
    return { ...this.metadata };
  }

  /**
   * Attempt state transition
   */
  transition(event: StateTransitionEvent, metadata?: Partial<StateMetadata>): boolean {
    const allowedEvents = this.transitions.get(this.currentState);
    if (!allowedEvents?.has(event)) {
      throw new MCPError(MCPErrorCode.ValidationError, `Invalid transition ${event} from state ${this.currentState}`, {
        currentState: this.currentState,
        event,
      });
    }

    const previousState = this.currentState;
    this.metadata = {
      ...this.metadata,
      ...metadata,
      timestamp: Date.now(),
    };

    switch (event) {
      case 'install':
        this.currentState = 'installing';
        break;
      case 'install_complete':
        this.currentState = 'installed';
        this.metadata.lastSuccessfulState = 'installed';
        break;
      case 'start':
        this.currentState = 'starting';
        break;
      case 'initialize':
        this.currentState = 'initializing';
        break;
      case 'connect':
        this.currentState = 'connected';
        this.metadata.lastSuccessfulState = 'connected';
        this.metadata.retryCount = 0;
        break;
      case 'stop':
        this.currentState = this.currentState === 'stopping' ? 'stopped' : 'stopping';
        break;
      case 'error':
        this.currentState = 'error';
        this.metadata.retryCount++;
        break;
      case 'recover':
        if (this.metadata.lastSuccessfulState) {
          this.currentState = this.metadata.lastSuccessfulState;
          this.metadata.error = undefined;
        } else {
          this.currentState = 'not_installed';
        }
        break;
    }

    this.emit('transition', {
      from: previousState,
      to: this.currentState,
      event,
      metadata: this.metadata,
    });

    return true;
  }

  /**
   * Check if a transition is valid
   */
  canTransition(event: StateTransitionEvent): boolean {
    return this.transitions.get(this.currentState)?.has(event) ?? false;
  }

  /**
   * Get valid transitions from current state
   */
  getValidTransitions(): StateTransitionEvent[] {
    return Array.from(this.transitions.get(this.currentState) ?? []);
  }

  /**
   * Restore state from persisted data
   */
  restore(state: ServerState, metadata: StateMetadata): void {
    this.currentState = state;
    this.metadata = { ...metadata, timestamp: Date.now() };
    this.emit('restored', { state, metadata });
  }

  /**
   * Check if state requires recovery
   */
  needsRecovery(): boolean {
    return (
      this.currentState === 'error' && this.metadata.retryCount <= 3 && this.metadata.lastSuccessfulState !== undefined
    );
  }

  /**
   * Get recovery action if needed
   */
  getRecoveryAction(): StateTransitionEvent | null {
    if (!this.needsRecovery()) {
      return null;
    }

    if (this.metadata.lastSuccessfulState === 'connected') {
      return 'recover';
    }

    if (this.metadata.lastSuccessfulState === 'installed') {
      return 'start';
    }

    return 'install';
  }

  // Event type definitions
  declare emit: {
    (
      event: 'transition',
      data: { from: ServerState; to: ServerState; event: StateTransitionEvent; metadata: StateMetadata },
    ): boolean;
    (event: 'restored', data: { state: ServerState; metadata: StateMetadata }): boolean;
  };

  declare on: {
    (
      event: 'transition',
      listener: (data: {
        from: ServerState;
        to: ServerState;
        event: StateTransitionEvent;
        metadata: StateMetadata;
      }) => void,
    ): ServerStateMachine;
    (event: 'restored', listener: (data: { state: ServerState; metadata: StateMetadata }) => void): ServerStateMachine;
  };
}
