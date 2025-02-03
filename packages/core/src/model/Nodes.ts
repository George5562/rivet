import { NodeRegistration } from './NodeRegistration.js';

import { userInputNode } from './nodes/UserInputNode.js';
export * from './nodes/UserInputNode.js';

import { textNode } from './nodes/TextNode.js';
export * from './nodes/TextNode.js';

import { chatNode } from './nodes/ChatNode.js';
export * from './nodes/ChatNode.js';

import { promptNode } from './nodes/PromptNode.js';
export * from './nodes/PromptNode.js';

import { extractRegexNode } from './nodes/ExtractRegexNode.js';
export * from './nodes/ExtractRegexNode.js';

import { codeNode } from './nodes/CodeNode.js';
export * from './nodes/CodeNode.js';

import { matchNode } from './nodes/MatchNode.js';
export * from './nodes/MatchNode.js';

import { ifNode } from './nodes/IfNode.js';
export * from './nodes/IfNode.js';

import { readDirectoryNode } from './nodes/ReadDirectoryNode.js';
export * from './nodes/ReadDirectoryNode.js';

import { readFileNode } from './nodes/ReadFileNode.js';
export * from './nodes/ReadFileNode.js';

import { ifElseNode } from './nodes/IfElseNode.js';
export * from './nodes/IfElseNode.js';

import { chunkNode } from './nodes/ChunkNode.js';
export * from './nodes/ChunkNode.js';

import { graphInputNode } from './nodes/GraphInputNode.js';
export * from './nodes/GraphInputNode.js';

import { graphOutputNode } from './nodes/GraphOutputNode.js';
export * from './nodes/GraphOutputNode.js';

import { subGraphNode } from './nodes/SubGraphNode.js';
export * from './nodes/SubGraphNode.js';

import { arrayNode } from './nodes/ArrayNode.js';
export * from './nodes/ArrayNode.js';

import { extractJsonNode } from './nodes/ExtractJsonNode.js';
export * from './nodes/ExtractJsonNode.js';

import { assemblePromptNode } from './nodes/AssemblePromptNode.js';
export * from './nodes/ExtractYamlNode.js';

import { loopControllerNode } from './nodes/LoopControllerNode.js';
export * from './nodes/AssemblePromptNode.js';

import { trimChatMessagesNode } from './nodes/TrimChatMessagesNode.js';
export * from './nodes/LoopControllerNode.js';

import { extractYamlNode } from './nodes/ExtractYamlNode.js';
export * from './nodes/TrimChatMessagesNode.js';

import { externalCallNode } from './nodes/ExternalCallNode.js';
export * from './nodes/ExternalCallNode.js';

import { extractObjectPathNode } from './nodes/ExtractObjectPathNode.js';
export * from './nodes/ExtractObjectPathNode.js';

import { raiseEventNode } from './nodes/RaiseEventNode.js';
export * from './nodes/RaiseEventNode.js';

import { contextNode } from './nodes/ContextNode.js';
export * from './nodes/ContextNode.js';

import { coalesceNode } from './nodes/CoalesceNode.js';
export * from './nodes/CoalesceNode.js';

import { passthroughNode } from './nodes/PassthroughNode.js';
export * from './nodes/PassthroughNode.js';

import { popNode } from './nodes/PopNode.js';
export * from './nodes/PopNode.js';

import { setGlobalNode } from './nodes/SetGlobalNode.js';
export * from './nodes/SetGlobalNode.js';

import { getGlobalNode } from './nodes/GetGlobalNode.js';
export * from './nodes/GetGlobalNode.js';

import { waitForEventNode } from './nodes/WaitForEventNode.js';
export * from './nodes/WaitForEventNode.js';

import { gptFunctionNode } from './nodes/GptFunctionNode.js';
export * from './nodes/GptFunctionNode.js';

import { toYamlNode } from './nodes/ToYamlNode.js';
export * from './nodes/ToYamlNode.js';

import { getEmbeddingNode } from './nodes/GetEmbeddingNode.js';
export * from './nodes/GetEmbeddingNode.js';

import { vectorStoreNode } from './nodes/VectorStoreNode.js';
export * from './nodes/VectorStoreNode.js';

import { vectorNearestNeighborsNode } from './nodes/VectorNearestNeighborsNode.js';
export * from './nodes/VectorNearestNeighborsNode.js';

import { hashNode } from './nodes/HashNode.js';
export * from './nodes/HashNode.js';

import { abortGraphNode } from './nodes/AbortGraphNode.js';
export * from './nodes/AbortGraphNode.js';

import { raceInputsNode } from './nodes/RaceInputsNode.js';
export * from './nodes/RaceInputsNode.js';

import { toJsonNode } from './nodes/ToJsonNode.js';
export * from './nodes/ToJsonNode.js';

import { joinNode } from './nodes/JoinNode.js';
export * from './nodes/JoinNode.js';

import { filterNode } from './nodes/FilterNode.js';
export * from './nodes/FilterNode.js';

import { objectNode } from './nodes/ObjectNode.js';
export * from './nodes/ObjectNode.js';

import { booleanNode } from './nodes/BooleanNode.js';
export * from './nodes/BooleanNode.js';

import { compareNode } from './nodes/CompareNode.js';
export * from './nodes/CompareNode.js';

import { evaluateNode } from './nodes/EvaluateNode.js';
export * from './nodes/EvaluateNode.js';

import { numberNode } from './nodes/NumberNode.js';
export * from './nodes/NumberNode.js';

import { randomNumberNode } from './nodes/RandomNumberNode.js';
export * from './nodes/RandomNumberNode.js';

import { shuffleNode } from './nodes/ShuffleNode.js';
export * from './nodes/ShuffleNode.js';

import { commentNode } from './nodes/CommentNode.js';
export * from './nodes/CommentNode.js';

import { imageNode } from './nodes/ImageNode.js';
export * from './nodes/ImageNode.js';

import { audioNode } from './nodes/AudioNode.js';
export * from './nodes/AudioNode.js';

import { httpCallNode } from './nodes/HttpCallNode.js';
export * from './nodes/HttpCallNode.js';

import { delayNode } from './nodes/DelayNode.js';
export * from './nodes/DelayNode.js';

import { appendToDatasetNode } from './nodes/AppendToDatasetNode.js';
export * from './nodes/AppendToDatasetNode.js';

import { createDatasetNode } from './nodes/CreateDatasetNode.js';
export * from './nodes/CreateDatasetNode.js';

import { loadDatasetNode } from './nodes/LoadDatasetNode.js';
export * from './nodes/LoadDatasetNode.js';

import { getAllDatasetsNode } from './nodes/GetAllDatasetsNode.js';
export * from './nodes/GetAllDatasetsNode.js';

import { splitNode } from './nodes/SplitNode.js';
export * from './nodes/SplitNode.js';

import { datasetNearestNeighborsNode } from './nodes/DatasetNearestNeigborsNode.js';
export * from './nodes/DatasetNearestNeigborsNode.js';

import { getDatasetRowNode } from './nodes/GetDatasetRowNode.js';
export * from './nodes/GetDatasetRowNode.js';

import { sliceNode } from './nodes/SliceNode.js';
export * from './nodes/SliceNode.js';

import { extractMarkdownCodeBlocksNode } from './nodes/ExtractMarkdownCodeBlocksNode.js';
export * from './nodes/ExtractMarkdownCodeBlocksNode.js';

import { assembleMessageNode } from './nodes/AssembleMessageNode.js';
export * from './nodes/AssembleMessageNode.js';

import { urlReferenceNode } from './nodes/URLReferenceNode.js';
export * from './nodes/URLReferenceNode.js';

import { destructureNode } from './nodes/DestructureNode.js';
export * from './nodes/DestructureNode.js';

import { replaceDatasetNode } from './nodes/ReplaceDatasetNode.js';
export * from './nodes/ReplaceDatasetNode.js';

import { listGraphsNode } from './nodes/ListGraphsNode.js';
export * from './nodes/ListGraphsNode.js';

import { graphReferenceNode } from './nodes/GraphReferenceNode.js';
export * from './nodes/GraphReferenceNode.js';

import { callGraphNode } from './nodes/CallGraphNode.js';
export * from './nodes/CallGraphNode.js';

import { delegateFunctionCallNode } from './nodes/DelegateFunctionCallNode.js';
export * from './nodes/DelegateFunctionCallNode.js';

import { playAudioNode } from './nodes/PlayAudioNode.js';
export * from './nodes/PlayAudioNode.js';

import { mcpNode } from './nodes/MCPNode.js';
export * from './nodes/MCPNode.js';

import { type UserInputNode } from './nodes/UserInputNode.js';
import { type TextNode } from './nodes/TextNode.js';
import { type ChatNode } from './nodes/ChatNode.js';
import { type PromptNode } from './nodes/PromptNode.js';
import { type ExtractRegexNode } from './nodes/ExtractRegexNode.js';
import { type CodeNode } from './nodes/CodeNode.js';
import { type MatchNode } from './nodes/MatchNode.js';
import { type IfNode } from './nodes/IfNode.js';
import { type ReadDirectoryNode } from './nodes/ReadDirectoryNode.js';
import { type ReadFileNode } from './nodes/ReadFileNode.js';
import { type IfElseNode } from './nodes/IfElseNode.js';
import { type ChunkNode } from './nodes/ChunkNode.js';
import { type GraphInputNode } from './nodes/GraphInputNode.js';
import { type GraphOutputNode } from './nodes/GraphOutputNode.js';
import { type SubGraphNode } from './nodes/SubGraphNode.js';
import { type ArrayNode } from './nodes/ArrayNode.js';
import { type ExtractJsonNode } from './nodes/ExtractJsonNode.js';
import { type AssemblePromptNode } from './nodes/AssemblePromptNode.js';
import { type LoopControllerNode } from './nodes/LoopControllerNode.js';
import { type TrimChatMessagesNode } from './nodes/TrimChatMessagesNode.js';
import { type ExtractYamlNode } from './nodes/ExtractYamlNode.js';
import { type ExternalCallNode } from './nodes/ExternalCallNode.js';
import { type ExtractObjectPathNode } from './nodes/ExtractObjectPathNode.js';
import { type RaiseEventNode } from './nodes/RaiseEventNode.js';
import { type ContextNode } from './nodes/ContextNode.js';
import { type CoalesceNode } from './nodes/CoalesceNode.js';
import { type PassthroughNode } from './nodes/PassthroughNode.js';
import { type PopNode } from './nodes/PopNode.js';
import { type SetGlobalNode } from './nodes/SetGlobalNode.js';
import { type GetGlobalNode } from './nodes/GetGlobalNode.js';
import { type WaitForEventNode } from './nodes/WaitForEventNode.js';
import { type GptFunctionNode } from './nodes/GptFunctionNode.js';
import { type GetEmbeddingNode } from './nodes/GetEmbeddingNode.js';
import { type VectorStoreNode } from './nodes/VectorStoreNode.js';
import { type VectorNearestNeighborsNode } from './nodes/VectorNearestNeighborsNode.js';
import { type HashNode } from './nodes/HashNode.js';
import { type AbortGraphNode } from './nodes/AbortGraphNode.js';
import { type RaceInputsNode } from './nodes/RaceInputsNode.js';
import { type ToJsonNode } from './nodes/ToJsonNode.js';
import { type JoinNode } from './nodes/JoinNode.js';
import { type FilterNode } from './nodes/FilterNode.js';
import { type ObjectNode } from './nodes/ObjectNode.js';
import { type BooleanNode } from './nodes/BooleanNode.js';
import { type CompareNode } from './nodes/CompareNode.js';
import { type EvaluateNode } from './nodes/EvaluateNode.js';
import { type NumberNode } from './nodes/NumberNode.js';
import { type RandomNumberNode } from './nodes/RandomNumberNode.js';
import { type ShuffleNode } from './nodes/ShuffleNode.js';
import { type CommentNode } from './nodes/CommentNode.js';
import { type ImageNode } from './nodes/ImageNode.js';
import { type AudioNode } from './nodes/AudioNode.js';
import { type HttpCallNode } from './nodes/HttpCallNode.js';
import { type DelayNode } from './nodes/DelayNode.js';
import { type AppendToDatasetNode } from './nodes/AppendToDatasetNode.js';
import { type CreateDatasetNode } from './nodes/CreateDatasetNode.js';
import { type LoadDatasetNode } from './nodes/LoadDatasetNode.js';
import { type GetAllDatasetsNode } from './nodes/GetAllDatasetsNode.js';
import { type SplitNode } from './nodes/SplitNode.js';
import { type DatasetNearestNeighborsNode } from './nodes/DatasetNearestNeigborsNode.js';
import { type GetDatasetRowNode } from './nodes/GetDatasetRowNode.js';
import { type SliceNode } from './nodes/SliceNode.js';
import { type ExtractMarkdownCodeBlocksNode } from './nodes/ExtractMarkdownCodeBlocksNode.js';
import { type AssembleMessageNode } from './nodes/AssembleMessageNode.js';
import { type DestructureNode } from './nodes/DestructureNode.js';
import { type ReplaceDatasetNode } from './nodes/ReplaceDatasetNode.js';
import { type ListGraphsNode } from './nodes/ListGraphsNode.js';
import { type GraphReferenceNode } from './nodes/GraphReferenceNode.js';
import { type CallGraphNode } from './nodes/CallGraphNode.js';
import { type DelegateFunctionCallNode } from './nodes/DelegateFunctionCallNode.js';
import { type PlayAudioNode } from './nodes/PlayAudioNode.js';
import { type MCPNode } from './nodes/MCPNode.js';
import { type UrlReferenceNode } from './nodes/URLReferenceNode.js';

export const registerBuiltInNodes = (
  registry: NodeRegistration<BuiltInNodeType, BuiltInNodes>,
): NodeRegistration<BuiltInNodeType, BuiltInNodes> => {
  return registry
    .register(mcpNode)
    .register(userInputNode)
    .register(textNode)
    .register(chatNode)
    .register(promptNode)
    .register(extractRegexNode)
    .register(codeNode)
    .register(matchNode)
    .register(ifNode)
    .register(readDirectoryNode)
    .register(readFileNode)
    .register(ifElseNode)
    .register(chunkNode)
    .register(graphInputNode)
    .register(graphOutputNode)
    .register(subGraphNode)
    .register(arrayNode)
    .register(extractJsonNode)
    .register(assemblePromptNode)
    .register(loopControllerNode)
    .register(trimChatMessagesNode)
    .register(extractYamlNode)
    .register(externalCallNode)
    .register(extractObjectPathNode)
    .register(raiseEventNode)
    .register(contextNode)
    .register(coalesceNode)
    .register(passthroughNode)
    .register(popNode)
    .register(setGlobalNode)
    .register(getGlobalNode)
    .register(waitForEventNode)
    .register(gptFunctionNode)
    .register(getEmbeddingNode)
    .register(vectorStoreNode)
    .register(vectorNearestNeighborsNode)
    .register(hashNode)
    .register(abortGraphNode)
    .register(raceInputsNode)
    .register(toJsonNode)
    .register(joinNode)
    .register(filterNode)
    .register(objectNode)
    .register(booleanNode)
    .register(compareNode)
    .register(evaluateNode)
    .register(numberNode)
    .register(randomNumberNode)
    .register(shuffleNode)
    .register(commentNode)
    .register(imageNode)
    .register(audioNode)
    .register(httpCallNode)
    .register(delayNode)
    .register(appendToDatasetNode)
    .register(createDatasetNode)
    .register(loadDatasetNode)
    .register(getAllDatasetsNode)
    .register(splitNode)
    .register(datasetNearestNeighborsNode)
    .register(getDatasetRowNode)
    .register(sliceNode)
    .register(extractMarkdownCodeBlocksNode)
    .register(assembleMessageNode)
    .register(urlReferenceNode)
    .register(destructureNode)
    .register(replaceDatasetNode)
    .register(listGraphsNode)
    .register(graphReferenceNode)
    .register(callGraphNode)
    .register(delegateFunctionCallNode)
    .register(playAudioNode);
};

export type BuiltInNodeType =
  | 'userInput'
  | 'text'
  | 'chat'
  | 'prompt'
  | 'extractRegex'
  | 'code'
  | 'match'
  | 'if'
  | 'readDirectory'
  | 'readFile'
  | 'ifElse'
  | 'chunk'
  | 'graphInput'
  | 'graphOutput'
  | 'subGraph'
  | 'array'
  | 'extractJson'
  | 'assemblePrompt'
  | 'loopController'
  | 'trimChatMessages'
  | 'extractYaml'
  | 'externalCall'
  | 'extractObjectPath'
  | 'raiseEvent'
  | 'context'
  | 'coalesce'
  | 'passthrough'
  | 'pop'
  | 'setGlobal'
  | 'getGlobal'
  | 'waitForEvent'
  | 'gptFunction'
  | 'getEmbedding'
  | 'vectorStore'
  | 'vectorNearestNeighbors'
  | 'hash'
  | 'abortGraph'
  | 'raceInputs'
  | 'toJson'
  | 'toYaml'
  | 'join'
  | 'filter'
  | 'object'
  | 'boolean'
  | 'compare'
  | 'evaluate'
  | 'number'
  | 'randomNumber'
  | 'shuffle'
  | 'comment'
  | 'image'
  | 'audio'
  | 'httpCall'
  | 'delay'
  | 'appendToDataset'
  | 'createDataset'
  | 'loadDataset'
  | 'getAllDatasets'
  | 'split'
  | 'datasetNearestNeighbors'
  | 'getDatasetRow'
  | 'slice'
  | 'extractMarkdownCodeBlocks'
  | 'assembleMessage'
  | 'urlReference'
  | 'destructure'
  | 'replaceDataset'
  | 'listGraphs'
  | 'graphReference'
  | 'callGraph'
  | 'delegateFunctionCall'
  | 'playAudio'
  | 'mcp';

export type BuiltInNodes =
  | UserInputNode
  | TextNode
  | ChatNode
  | PromptNode
  | ExtractRegexNode
  | CodeNode
  | MatchNode
  | IfNode
  | ReadDirectoryNode
  | ReadFileNode
  | IfElseNode
  | ChunkNode
  | GraphInputNode
  | GraphOutputNode
  | SubGraphNode
  | ArrayNode
  | ExtractJsonNode
  | AssemblePromptNode
  | LoopControllerNode
  | TrimChatMessagesNode
  | ExtractYamlNode
  | ExternalCallNode
  | ExtractObjectPathNode
  | RaiseEventNode
  | ContextNode
  | CoalesceNode
  | PassthroughNode
  | PopNode
  | SetGlobalNode
  | GetGlobalNode
  | WaitForEventNode
  | GptFunctionNode
  | GetEmbeddingNode
  | VectorStoreNode
  | VectorNearestNeighborsNode
  | HashNode
  | AbortGraphNode
  | RaceInputsNode
  | ToJsonNode
  | JoinNode
  | FilterNode
  | ObjectNode
  | BooleanNode
  | CompareNode
  | EvaluateNode
  | NumberNode
  | RandomNumberNode
  | ShuffleNode
  | CommentNode
  | ImageNode
  | AudioNode
  | HttpCallNode
  | DelayNode
  | AppendToDatasetNode
  | CreateDatasetNode
  | LoadDatasetNode
  | GetAllDatasetsNode
  | SplitNode
  | DatasetNearestNeighborsNode
  | GetDatasetRowNode
  | SliceNode
  | ExtractMarkdownCodeBlocksNode
  | AssembleMessageNode
  | UrlReferenceNode
  | DestructureNode
  | ReplaceDatasetNode
  | ListGraphsNode
  | GraphReferenceNode
  | CallGraphNode
  | DelegateFunctionCallNode
  | PlayAudioNode
  | MCPNode;

let globalRivetNodeRegistry = registerBuiltInNodes(new NodeRegistration<BuiltInNodeType, BuiltInNodes>());

export { globalRivetNodeRegistry };

export type NodeOfType<T extends BuiltInNodeType> = Extract<BuiltInNodes, { type: T }>;

/** Resets the global node registry to a fresh one with only built-in nodes registered. */
export function resetGlobalRivetNodeRegistry() {
  globalRivetNodeRegistry = registerBuiltInNodes(new NodeRegistration<BuiltInNodeType, BuiltInNodes>());
}
