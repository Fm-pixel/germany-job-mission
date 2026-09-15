import { describe, expect, it } from 'vitest';
import { explainAiError } from '@/services/ai/client';

describe('what the owner is told when the AI fails', () => {
  it('explains an empty Anthropic balance, because that is a billing decision', () => {
    const message = explainAiError(
      Object.assign(new Error('400 {"type":"error","error":{"message":"Your credit balance is too low to access the Anthropic API."}}'), { status: 400 }),
    );
    expect(message).toMatch(/run out of credit/i);
    expect(message).toMatch(/Plans & Billing/);
    expect(message).toMatch(/nothing was lost/i);
  });

  it('explains a refused key', () => {
    const message = explainAiError(Object.assign(new Error('invalid x-api-key'), { status: 401 }));
    expect(message).toMatch(/key was refused/i);
    expect(message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('explains rate limiting and overload as "wait", not as failure', () => {
    expect(explainAiError(Object.assign(new Error('rate_limit_error'), { status: 429 }))).toMatch(/wait a few minutes/i);
    expect(explainAiError(Object.assign(new Error('overloaded_error'), { status: 529 }))).toMatch(/overloaded/i);
  });

  it('explains a document that is too long', () => {
    const message = explainAiError(Object.assign(new Error('max_tokens exceeded: input too long'), { status: 400 }));
    expect(message).toMatch(/too long for one request/i);
  });

  it('passes an unknown error through unchanged rather than inventing a reason', () => {
    expect(explainAiError(new Error('something nobody anticipated'))).toBe('something nobody anticipated');
  });
});
