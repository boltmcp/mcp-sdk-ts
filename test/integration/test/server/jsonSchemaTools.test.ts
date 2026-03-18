import { Client } from '@modelcontextprotocol/client';
import type { CallToolResult, JsonSchemaType } from '@modelcontextprotocol/core';
import { InMemoryTransport } from '@modelcontextprotocol/core';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';

async function createConnectedPair(mcpServer: McpServer) {
    const client = new Client({ name: 'test client', version: '1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
    return client;
}

describe('JSON Schema tools', () => {
    describe('registerTool with JSON Schema inputSchema', () => {
        test('tools/list returns raw JSON Schema for input', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const inputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' }
                },
                required: ['name']
            };

            mcpServer.registerTool('greet', { description: 'Greet a person', inputSchema }, async args => ({
                content: [{ type: 'text', text: `Hello, ${args.name}!` }]
            }));

            const client = await createConnectedPair(mcpServer);
            const result = await client.request({ method: 'tools/list' });

            expect(result.tools).toHaveLength(1);
            expect(result.tools[0]!.name).toBe('greet');
            expect(result.tools[0]!.inputSchema).toEqual(inputSchema);
        });

        test('tools/call validates input with Ajv and passes valid args', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const inputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                required: ['name']
            };

            mcpServer.registerTool('greet', { inputSchema }, async args => ({
                content: [{ type: 'text', text: `Hello, ${args.name}!` }]
            }));

            const client = await createConnectedPair(mcpServer);
            const result = (await client.request({
                method: 'tools/call',
                params: { name: 'greet', arguments: { name: 'Alice' } }
            })) as CallToolResult;

            expect(result.content).toEqual([{ type: 'text', text: 'Hello, Alice!' }]);
        });

        test('tools/call rejects invalid input with Ajv validation error', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const inputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                required: ['name']
            };

            mcpServer.registerTool('greet', { inputSchema }, async args => ({
                content: [{ type: 'text', text: `Hello, ${args.name}!` }]
            }));

            const client = await createConnectedPair(mcpServer);
            const result = (await client.request({
                method: 'tools/call',
                params: { name: 'greet', arguments: {} }
            })) as CallToolResult;

            expect(result.isError).toBe(true);
            expect((result.content[0] as { type: string; text: string }).text).toContain('Input validation error');
        });
    });

    describe('registerTool with JSON Schema outputSchema', () => {
        test('tools/list returns raw JSON Schema for output', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const outputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    greeting: { type: 'string' }
                },
                required: ['greeting']
            };

            mcpServer.registerTool('greet', { outputSchema }, async () => ({
                content: [{ type: 'text', text: 'Hello!' }],
                structuredContent: { greeting: 'Hello!' }
            }));

            const client = await createConnectedPair(mcpServer);
            const result = await client.request({ method: 'tools/list' });

            expect(result.tools[0]!.outputSchema).toEqual(outputSchema);
        });

        test('tools/call validates output with Ajv', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const outputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    greeting: { type: 'string' }
                },
                required: ['greeting']
            };

            mcpServer.registerTool('greet', { outputSchema }, async () => ({
                content: [{ type: 'text', text: 'Hello!' }],
                structuredContent: { greeting: 'Hello!' }
            }));

            const client = await createConnectedPair(mcpServer);
            const result = (await client.request({
                method: 'tools/call',
                params: { name: 'greet' }
            })) as CallToolResult;

            expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }]);
            expect(result.structuredContent).toEqual({ greeting: 'Hello!' });
        });

        test('tools/call rejects invalid output with Ajv validation error', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const outputSchema: JsonSchemaType = {
                type: 'object',
                properties: {
                    greeting: { type: 'string' }
                },
                required: ['greeting']
            };

            mcpServer.registerTool('greet', { outputSchema }, async () => ({
                content: [{ type: 'text', text: 'Hello!' }],
                structuredContent: { wrong: 123 }
            }));

            const client = await createConnectedPair(mcpServer);
            const result = (await client.request({
                method: 'tools/call',
                params: { name: 'greet' }
            })) as CallToolResult;

            expect(result.isError).toBe(true);
            expect((result.content[0] as { type: string; text: string }).text).toContain('Output validation error');
        });
    });

    describe('registerTool with both JSON Schema input and output', () => {
        test('tools/call with valid input and output succeeds', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const inputSchema: JsonSchemaType = {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
                required: ['x', 'y']
            };
            const outputSchema: JsonSchemaType = {
                type: 'object',
                properties: { sum: { type: 'number' } },
                required: ['sum']
            };

            mcpServer.registerTool('add', { inputSchema, outputSchema }, async args => ({
                content: [{ type: 'text', text: String((args.x as number) + (args.y as number)) }],
                structuredContent: { sum: (args.x as number) + (args.y as number) }
            }));

            const client = await createConnectedPair(mcpServer);
            const result = (await client.request({
                method: 'tools/call',
                params: { name: 'add', arguments: { x: 2, y: 3 } }
            })) as CallToolResult;

            expect(result.structuredContent).toEqual({ sum: 5 });
        });
    });

    describe('mixed Zod and JSON Schema', () => {
        test('Zod inputSchema + JSON Schema outputSchema', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const zodInput = z.object({ name: z.string() });
            const jsonOutput: JsonSchemaType = {
                type: 'object',
                properties: { greeting: { type: 'string' } },
                required: ['greeting']
            };

            mcpServer.registerTool('greet', { inputSchema: zodInput, outputSchema: jsonOutput }, async args => ({
                content: [{ type: 'text', text: `Hi ${args.name}` }],
                structuredContent: { greeting: `Hi ${args.name}` }
            }));

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });

            // Input should be converted from Zod to JSON Schema
            expect(listResult.tools[0]!.inputSchema).toHaveProperty('type', 'object');
            expect(listResult.tools[0]!.inputSchema).toHaveProperty('properties');
            // Output should be the raw JSON Schema
            expect(listResult.tools[0]!.outputSchema).toEqual(jsonOutput);

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'greet', arguments: { name: 'Bob' } }
            })) as CallToolResult;

            expect(callResult.structuredContent).toEqual({ greeting: 'Hi Bob' });
        });

        test('JSON Schema inputSchema + Zod outputSchema', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });
            const jsonInput: JsonSchemaType = {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name']
            };
            const zodOutput = z.object({ greeting: z.string() });

            mcpServer.registerTool('greet', { inputSchema: jsonInput, outputSchema: zodOutput }, async args => ({
                content: [{ type: 'text', text: `Hi ${args.name}` }],
                structuredContent: { greeting: `Hi ${args.name}` }
            }));

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });

            // Input should be the raw JSON Schema
            expect(listResult.tools[0]!.inputSchema).toEqual(jsonInput);
            // Output should be converted from Zod
            expect(listResult.tools[0]!.outputSchema).toHaveProperty('type', 'object');

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'greet', arguments: { name: 'Carol' } }
            })) as CallToolResult;

            expect(callResult.structuredContent).toEqual({ greeting: 'Hi Carol' });
        });
    });

    describe('update() with JSON Schema', () => {
        test('update paramsSchema from Zod to JSON Schema', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });

            const tool = mcpServer.registerTool('mytool', { inputSchema: z.object({ a: z.string() }) }, async ({ a }) => ({
                content: [{ type: 'text', text: a }]
            }));

            const jsonSchema: JsonSchemaType = {
                type: 'object',
                properties: { b: { type: 'number' } },
                required: ['b']
            };

            tool.update({
                paramsSchema: jsonSchema,
                callback: async args => ({
                    content: [{ type: 'text', text: String(args.b) }]
                })
            });

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });
            expect(listResult.tools[0]!.inputSchema).toEqual(jsonSchema);

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'mytool', arguments: { b: 42 } }
            })) as CallToolResult;

            expect(callResult.content).toEqual([{ type: 'text', text: '42' }]);
        });

        test('update outputSchema to JSON Schema', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });

            const tool = mcpServer.registerTool('mytool', { outputSchema: z.object({ x: z.number() }) }, async () => ({
                content: [{ type: 'text', text: '1' }],
                structuredContent: { x: 1 }
            }));

            const jsonOutputSchema: JsonSchemaType = {
                type: 'object',
                properties: { y: { type: 'string' } },
                required: ['y']
            };

            tool.update({
                outputSchema: jsonOutputSchema,
                callback: async () => ({
                    content: [{ type: 'text', text: 'ok' }],
                    structuredContent: { y: 'hello' }
                })
            });

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });
            expect(listResult.tools[0]!.outputSchema).toEqual(jsonOutputSchema);

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'mytool' }
            })) as CallToolResult;

            expect(callResult.structuredContent).toEqual({ y: 'hello' });
        });
    });

    describe('Zod regression', () => {
        test('registerTool with Zod schemas still works', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });

            mcpServer.registerTool(
                'add',
                {
                    inputSchema: z.object({ a: z.number(), b: z.number() }),
                    outputSchema: z.object({ sum: z.number() })
                },
                async ({ a, b }) => ({
                    content: [{ type: 'text', text: String(a + b) }],
                    structuredContent: { sum: a + b }
                })
            );

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });

            expect(listResult.tools).toHaveLength(1);
            expect(listResult.tools[0]!.inputSchema).toHaveProperty('type', 'object');
            expect(listResult.tools[0]!.inputSchema).toHaveProperty('properties');

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'add', arguments: { a: 10, b: 5 } }
            })) as CallToolResult;

            expect(callResult.structuredContent).toEqual({ sum: 15 });
        });

        test('registerTool with no schema still works', async () => {
            const mcpServer = new McpServer({ name: 'test', version: '1.0' });

            mcpServer.registerTool('ping', {}, async () => ({
                content: [{ type: 'text', text: 'pong' }]
            }));

            const client = await createConnectedPair(mcpServer);
            const listResult = await client.request({ method: 'tools/list' });

            expect(listResult.tools[0]!.inputSchema).toEqual({ type: 'object', properties: {} });

            const callResult = (await client.request({
                method: 'tools/call',
                params: { name: 'ping' }
            })) as CallToolResult;

            expect(callResult.content).toEqual([{ type: 'text', text: 'pong' }]);
        });
    });
});
