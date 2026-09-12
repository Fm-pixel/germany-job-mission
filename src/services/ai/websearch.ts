import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, HOUSE_RULES } from './client';
import { anthropicModel } from '@/lib/env';

/**
 * Web research through the Anthropic server-side web search tool.
 * Used for company discovery and the Opportunity Radar — never for immigration
 * requirements, which may only come from the official sources in
 * services/immigration/official-sources.ts.
 */
export interface WebResearchResult {
  text: string;
  sources: { url: string; title?: string }[];
}

export async function researchWeb(
  prompt: string,
  options: { system?: string; maxUses?: number; allowedDomains?: string[]; maxTokens?: number } = {},
): Promise<WebResearchResult> {
  const client = anthropic();
  const tool = {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: options.maxUses ?? 6,
    ...(options.allowedDomains ? { allowed_domains: options.allowedDomains } : {}),
  } as unknown as Anthropic.ToolUnion;

  const response = await client.messages.create({
    model: anthropicModel(),
    max_tokens: options.maxTokens ?? 8000,
    system: [
      { type: 'text' as const, text: HOUSE_RULES, cache_control: { type: 'ephemeral' as const } },
      ...(options.system ? [{ type: 'text' as const, text: options.system }] : []),
    ],
    tools: [tool],
    messages: [{ role: 'user', content: prompt }],
  });

  const sources: { url: string; title?: string }[] = [];
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      text += `${block.text}\n`;
      for (const citation of (block as { citations?: { url?: string; title?: string }[] }).citations ?? []) {
        if (citation.url) sources.push({ url: citation.url, title: citation.title });
      }
    }
    if (block.type === 'web_search_tool_result') {
      const content = (block as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const item of content as { url?: string; title?: string }[]) {
          if (item.url) sources.push({ url: item.url, title: item.title });
        }
      }
    }
  }
  return { text: text.trim(), sources };
}

export function webSearchAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
