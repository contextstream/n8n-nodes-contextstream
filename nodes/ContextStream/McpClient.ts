import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export interface ContextStreamCredentials {
	apiKey: string;
	mcpUrl: string;
}

export interface McpSession {
	url: string;
	apiKey: string;
	sessionId?: string;
}

interface FullHttpResponse {
	body: unknown;
	headers?: Record<string, string | string[] | undefined>;
	statusCode?: number;
}

function headerValue(headers: FullHttpResponse['headers'], name: string): string | undefined {
	if (!headers) return undefined;
	const direct = headers[name] ?? headers[name.toLowerCase()];
	if (Array.isArray(direct)) return direct[0];
	return typeof direct === 'string' ? direct : undefined;
}

function parseMcpBody(body: unknown): IDataObject {
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		return body as IDataObject;
	}
	if (typeof body !== 'string') {
		return { value: body } as IDataObject;
	}
	const trimmed = body.trim();
	if (trimmed.startsWith('{')) {
		return JSON.parse(trimmed) as IDataObject;
	}
	const dataLines = trimmed
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).trim())
		.filter((line) => line.length > 0);
	const last = dataLines[dataLines.length - 1];
	if (!last) {
		return { raw: trimmed } as IDataObject;
	}
	return JSON.parse(last) as IDataObject;
}

function unwrapMcpResult(payload: IDataObject, itemIndex: number, ctx: IExecuteFunctions): IDataObject {
	const error = payload.error;
	if (error && typeof error === 'object') {
		const err = error as IDataObject;
		const message = typeof err.message === 'string' ? err.message : 'MCP request failed';
		throw new NodeApiError(ctx.getNode(), err as JsonObject, { message, itemIndex });
	}
	const result = payload.result;
	if (result && typeof result === 'object' && !Array.isArray(result)) {
		return result as IDataObject;
	}
	return { result } as IDataObject;
}

export async function openMcpSession(
	ctx: IExecuteFunctions,
	credentials: ContextStreamCredentials,
	itemIndex: number,
): Promise<McpSession> {
	const session: McpSession = { url: credentials.mcpUrl, apiKey: credentials.apiKey };
	const payload = await mcpRpc(ctx, session, 'initialize', {
		protocolVersion: '2025-03-26',
		capabilities: {},
		clientInfo: { name: 'n8n-nodes-contextstream', version: '0.1.0' },
	}, itemIndex);
	unwrapMcpResult(payload.body as IDataObject, itemIndex, ctx);
	const sessionId = headerValue(payload.headers, 'mcp-session-id');
	if (sessionId) {
		session.sessionId = sessionId;
	}
	await mcpRpc(ctx, session, 'notifications/initialized', {}, itemIndex, true);
	return session;
}

async function mcpRpc(
	ctx: IExecuteFunctions,
	session: McpSession,
	method: string,
	params: IDataObject,
	itemIndex: number,
	notification = false,
): Promise<FullHttpResponse> {
	const headers: Record<string, string> = {
		Accept: 'application/json, text/event-stream',
		'Content-Type': 'application/json',
		Authorization: 'Bearer ' + session.apiKey,
	};
	if (session.sessionId) {
		headers['mcp-session-id'] = session.sessionId;
	}
	const body: IDataObject = { jsonrpc: '2.0', method };
	if (!notification) {
		body.id = itemIndex + 1;
	}
	if (Object.keys(params).length > 0 || method !== 'notifications/initialized') {
		body.params = params;
	}
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: session.url,
		headers,
		body,
		json: true,
		returnFullResponse: true,
	};
	try {
		const response = (await ctx.helpers.httpRequest(options)) as FullHttpResponse;
		return {
			body: parseMcpBody(response.body),
			headers: response.headers,
			statusCode: response.statusCode,
		};
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: 'ContextStream MCP request failed',
			itemIndex,
		});
	}
}

export async function listMcpTools(
	ctx: IExecuteFunctions,
	session: McpSession,
	itemIndex: number,
): Promise<IDataObject> {
	const payload = await mcpRpc(ctx, session, 'tools/list', {}, itemIndex);
	return unwrapMcpResult(payload.body as IDataObject, itemIndex, ctx);
}

export async function callMcpTool(
	ctx: IExecuteFunctions,
	session: McpSession,
	name: string,
	args: IDataObject,
	itemIndex: number,
): Promise<IDataObject> {
	const payload = await mcpRpc(ctx, session, 'tools/call', { name, arguments: args }, itemIndex);
	return unwrapMcpResult(payload.body as IDataObject, itemIndex, ctx);
}

