declare module "openclaw/plugin-sdk/plugin-entry" {
  export interface OpenClawToolResult {
    content: Array<{
      type: "text";
      text: string;
    }>;
  }

  export interface OpenClawToolDefinition<TParams = unknown> {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    execute?: (toolCallId: string, params: TParams) => Promise<OpenClawToolResult> | OpenClawToolResult;
  }

  export interface OpenClawToolRegistrationOptions {
    optional?: boolean;
  }

  export interface OpenClawPluginApi {
    config?: unknown;
    registerTool?<TParams = unknown>(
      tool: OpenClawToolDefinition<TParams>,
      options?: OpenClawToolRegistrationOptions,
    ): void;
  }

  export interface OpenClawPluginEntryDefinition {
    id: string;
    name?: string;
    register(api: OpenClawPluginApi): void | Promise<void>;
  }

  export function definePluginEntry(
    definition: OpenClawPluginEntryDefinition,
  ): OpenClawPluginEntryDefinition;
}
