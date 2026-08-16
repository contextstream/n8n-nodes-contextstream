import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class ContextStreamApi implements ICredentialType {
	name = 'contextStreamApi';

	displayName = 'ContextStream API';

	documentationUrl = 'https://contextstream.io/docs/editors/setup';

	icon: Icon = { light: 'file:../nodes/ContextStream/contextstream.svg', dark: 'file:../nodes/ContextStream/contextstream.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'ContextStream API key sent as a Bearer token',
		},
		{
			displayName: 'MCP URL',
			name: 'mcpUrl',
			type: 'string',
			default: 'https://mcp.contextstream.io/mcp',
			required: true,
			description: 'Hosted ContextStream MCP endpoint (streamable-http)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: '={{$credentials.mcpUrl}}',
			headers: {
				Accept: 'application/json, text/event-stream',
				'Content-Type': 'application/json',
			},
			body: {
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-03-26',
					capabilities: {},
					clientInfo: {
						name: 'n8n-nodes-contextstream',
						version: '0.1.0',
					},
				},
			},
		},
	};
}
