# n8n-nodes-contextstream

Official n8n community node for ContextStream.
Homepage: https://contextstream.io
Hosted MCP: https://mcp.contextstream.io/mcp
Transport: streamable-http
Docs: https://github.com/contextstream/mcp-server
Privacy: https://contextstream.io/privacy
Contact: erik@contextstream.io

This package is MIT-licensed and has no runtime dependencies.

## Install

In n8n: Settings → Community Nodes → Install `n8n-nodes-contextstream`.

## Credentials

Add a ContextStream API credential. Paste your API key.
Default MCP URL is https://mcp.contextstream.io/mcp.
Pass the key through n8n credentials only.

## Operations

Usable as an AI Agent tool.

MCP: List Tools, Call Tool.
Memory: Search (search), Create Document (memory_create_doc).
Session: Capture Lesson (session_capture_lesson), Capture Plan (capture_plan),
Call Session (session action such as list_recaps), Help Version (help action version).
Use Call Tool plus JSON arguments for other documented tools.

## Example: Memory › Search

1. Add a ContextStream node.
2. Resource: Memory. Operation: Search.
3. Query: `where do we handle authentication`
4. Leave Tool Arguments as `{}` unless you need extra MCP fields (for example `workspace_id`).

Example output (shape only; hits depend on what is indexed in your workspace):

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found matches for \"where do we handle authentication\"."
    }
  ],
  "isError": false
}
```

If the MCP tool returns structured results, they appear on the same item under `json`.

## Development

Use the n8n-node scripts in package.json to lint, build, and run locally.

## Publish path

Verified catalog submissions since 1 May 2026 need GitHub Actions provenance.
Workflow: .github/workflows/publish.yml
Creator Portal: https://creators.n8n.io/nodes

## License

MIT
