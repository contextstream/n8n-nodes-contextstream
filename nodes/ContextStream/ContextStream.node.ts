import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	callMcpTool,
	listMcpTools,
	openMcpSession,
	type ContextStreamCredentials,
} from './McpClient';

function parseJsonObject(
	ctx: IExecuteFunctions,
	value: unknown,
	field: string,
	itemIndex: number,
): IDataObject {
	try {
		if (value === undefined || value === null || value === '') {
			return {};
		}
		if (typeof value === 'object' && !Array.isArray(value)) {
			return value as IDataObject;
		}
		if (typeof value !== 'string') {
			throw new NodeOperationError(ctx.getNode(), 'Enter a JSON object for ' + field, { itemIndex });
		}
		const trimmed = value.trim();
		if (!trimmed) return {};
		const parsed = JSON.parse(trimmed) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new NodeOperationError(ctx.getNode(), 'Enter a JSON object for ' + field, { itemIndex });
		}
		return parsed as IDataObject;
	} catch {
		throw new NodeOperationError(ctx.getNode(), 'Enter a JSON object for ' + field, { itemIndex });
	}
}

function compactArgs(args: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(args)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

export class ContextStream implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ContextStream',
		name: 'contextStream',
		icon: { light: 'file:contextstream.svg', dark: 'file:contextstream.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Talk to ContextStream hosted MCP for memory, search, and session tools',
		defaults: { name: 'ContextStream' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'contextStreamApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'MCP', value: 'mcp' },
					{ name: 'Memory', value: 'memory' },
					{ name: 'Session', value: 'session' },
				],
				default: 'mcp',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['mcp'] } },
				options: [
					{ name: 'List Tools', value: 'listTools', action: 'List MCP tools', description: 'Retrieve the tools exposed by hosted MCP' },
					{ name: 'Call Tool', value: 'callTool', action: 'Call MCP tool', description: 'Call one hosted MCP tool by name' },
				],
				default: 'listTools',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['memory'] } },
				options: [
					{ name: 'Search', value: 'search', action: 'Search project context', description: 'Search indexed code and memory with the search tool' },
					{ name: 'Create Document', value: 'createDoc', action: 'Create memory document', description: 'Create a document with memory_create_doc' },
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['session'] } },
				options: [
					{ name: 'Capture Lesson', value: 'captureLesson', action: 'Capture session lesson', description: 'Save a lesson with session_capture_lesson' },
					{ name: 'Capture Plan', value: 'capturePlan', action: 'Capture plan', description: 'Save a plan with capture_plan' },
					{ name: 'Call Session', value: 'callSession', action: 'Call session tool', description: 'Call the session domain tool with an action' },
					{ name: 'Help Version', value: 'helpVersion', action: 'Get MCP version', description: 'Call help with action version' },
				],
				default: 'captureLesson',
			},
			{
				displayName: 'Tool Name',
				name: 'toolName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. search',
				description: 'Name of the MCP tool to call',
				displayOptions: { show: { resource: ['mcp'], operation: ['callTool'] } },
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. where do we handle authentication',
				description: 'Search query to send to the search tool',
				displayOptions: { show: { resource: ['memory'], operation: ['search'] } },
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				description: 'Primary text passed to the selected write tool',
				displayOptions: { show: { resource: ['memory', 'session'], operation: ['createDoc', 'captureLesson', 'capturePlan'] } },
			},
			{
				displayName: 'Action',
				name: 'sessionAction',
				type: 'string',
				required: true,
				default: 'list_recaps',
				placeholder: 'e.g. list_recaps',
				description: 'Session tool action from the public ContextStream docs',
				displayOptions: { show: { resource: ['session'], operation: ['callSession'] } },
			},
			{
				displayName: 'Workspace ID',
				name: 'workspaceId',
				type: 'string',
				default: '',
				description: 'Optional workspace_id used by documented session actions',
				displayOptions: { show: { resource: ['session'], operation: ['callSession'] } },
			},
			{
				displayName: 'Tool Arguments',
				name: 'toolArguments',
				type: 'json',
				default: '{}',
				description: 'JSON object merged into the MCP tool arguments',
				displayOptions: { hide: { resource: ['mcp'], operation: ['listTools'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = (await this.getCredentials('contextStreamApi')) as unknown as ContextStreamCredentials;
		const results: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const session = await openMcpSession(this, credentials, itemIndex);
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const extra = parseJsonObject(
					this,
					this.getNodeParameter('toolArguments', itemIndex, '{}') as unknown,
					'Tool Arguments',
					itemIndex,
				);
				let data: IDataObject;

				if (resource === 'mcp' && operation === 'listTools') {
					data = await listMcpTools(this, session, itemIndex);
				} else if (resource === 'mcp' && operation === 'callTool') {
					const toolName = this.getNodeParameter('toolName', itemIndex) as string;
					data = await callMcpTool(this, session, toolName, extra, itemIndex);
				} else if (resource === 'memory' && operation === 'search') {
					const query = this.getNodeParameter('query', itemIndex) as string;
					data = await callMcpTool(this, session, 'search', compactArgs({ query, ...extra }), itemIndex);
				} else if (resource === 'memory' && operation === 'createDoc') {
					const content = this.getNodeParameter('content', itemIndex) as string;
					data = await callMcpTool(this, session, 'memory_create_doc', compactArgs({ content, ...extra }), itemIndex);
				} else if (resource === 'session' && operation === 'captureLesson') {
					const content = this.getNodeParameter('content', itemIndex) as string;
					data = await callMcpTool(this, session, 'session_capture_lesson', compactArgs({ content, ...extra }), itemIndex);
				} else if (resource === 'session' && operation === 'capturePlan') {
					const content = this.getNodeParameter('content', itemIndex) as string;
					data = await callMcpTool(this, session, 'capture_plan', compactArgs({ content, ...extra }), itemIndex);
				} else if (resource === 'session' && operation === 'callSession') {
					const action = this.getNodeParameter('sessionAction', itemIndex) as string;
					const workspaceId = this.getNodeParameter('workspaceId', itemIndex, '') as string;
					data = await callMcpTool(this, session, 'session', compactArgs({ action, workspace_id: workspaceId, ...extra }), itemIndex);
				} else if (resource === 'session' && operation === 'helpVersion') {
					data = await callMcpTool(this, session, 'help', compactArgs({ action: 'version', ...extra }), itemIndex);
				} else {
					throw new NodeOperationError(this.getNode(), 'Unsupported resource or operation', { itemIndex });
				}

				results.push({ json: data, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					results.push({ json: { error: message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error instanceof Error ? error.message : 'Unknown error', { itemIndex });
			}
		}

		return [results];
	}
}

