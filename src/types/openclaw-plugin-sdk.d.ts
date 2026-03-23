declare module "openclaw/plugin-sdk/plugin-entry" {
  export interface OpenClawToolDefinition {
    name: string;
    description?: string;
  }

  export interface OpenClawPluginApi {
    registerTool?(tool: OpenClawToolDefinition): void;
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
