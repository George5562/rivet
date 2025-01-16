import type { Opaque } from 'type-fest';
import {
  type Settings,
  type NativeApi,
  type Project,
  type DataValue,
  type ExternalFunction,
  type Outputs,
  type GraphId,
  type GraphProcessor,
  type ScalarOrArrayDataValue,
  type DatasetProvider,
  type ChartNode,
  type AttachedNodeData,
  type AudioProvider,
} from '../index.js';
import type { Tokenizer } from '../integrations/Tokenizer.js';
import type { MCPBrowserClient } from '@ironclad/rivet-mcp/src/browser/MCPBrowserClient.js';
import type { GraphExecutor } from './GraphExecutor.js';
import type { GraphEvent } from './GraphEvents.js';
import type { NodeEvent } from './NodeEvents.js';
import type { Project } from './Project.js';
import type { DataValue } from './DataValue.js';
import type { ChartNode } from './NodeBase.js';

export type ProcessContext = {
  settings: Settings;
  nativeApi?: NativeApi;

  /** Sets the dataset provider to be used for all dataset node calls. */
  datasetProvider?: DatasetProvider;

  /** The provider responsible for being able to play audio. Undefined if unsupported in this context. */
  audioProvider?: AudioProvider;

  /** Sets the tokenizer that will be used for all nodes. If unset, the default GptTokenizerTokenizer will be used. */
  tokenizer?: Tokenizer;

  /**
   * If implemented, chat nodes will first call this to resolve their configured endpoint to a final endpoint.
   * You can use this for adding auth headers, or to load balance between multiple endpoints.
   */
  getChatNodeEndpoint?: (
    configuredEndpoint: string,
    configuredModel: string,
  ) => ChatNodeEndpointInfo | Promise<ChatNodeEndpointInfo>;

  /** Gets a string plugin config value from the settings, falling back to a specified environment variable if set. */
  getPluginConfig(name: string): string | undefined;
};

export type ChatNodeEndpointInfo = {
  endpoint: string;
  headers: Record<string, string>;
};

export type ProcessId = Opaque<string, 'ProcessId'>;

export interface InternalProcessContext extends ProcessContext {
  executor: GraphExecutor;
  project: Project;
  signal: AbortSignal;
  processId: string;
  contextValues: Record<string, DataValue>;
  graphInputs: Record<string, DataValue>;
  graphOutputs: Record<string, DataValue>;
  tokenizer: Tokenizer;
  node?: ChartNode;
  attachedData?: Record<string, unknown>;
  mcpClient?: MCPBrowserClient;
  onProgress?: (progress: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;

  // Event handling
  onGraphEvent: (event: GraphEvent) => void;
  onNodeEvent: (event: NodeEvent) => void;

  // Global variable management
  getGlobalVariable: (name: string) => Promise<DataValue | undefined>;
  setGlobalVariable: (name: string, value: DataValue) => Promise<void>;

  // Graph execution control
  runGraph: (graphId: string, inputs?: Record<string, DataValue>) => Promise<Record<string, DataValue>>;
  abortGraph: (graphId: string) => void;
}
