import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { AGENT_PROFILE_MAP } from '../src/profiles';

dotenv.config();

const prompt = `
You are a crypto trading agent.

Your wallet has:
- ETH: 1.24
- USDC: 134.50
- DAI: 57.20

Available swap pools:
- ETH → USDC
- ETH → DAI
- USDC → DAI

You are configured as an "aggressive" trader who prefers frequent swaps.

Decide which swap to perform and how much to trade.
Respond in JSON format like:
{ "from": "ETH", "to": "USDC", "amount": 0.5, "reason": "ETH is up and agent prefers USDC" }
`;

async function run(agentId: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_SECRET_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const content = JSON.parse(response.choices[0].message?.content || '{}');
    console.log(`[GPT] Decision: ${content.from} → ${content.to} for ${content.amount}`);
    console.log(`[GPT] Reason: ${content.reason}`);
  } catch {
    console.warn('Failed to parse GPT response:', response);
  }
}

const agentId = process.argv[2] || 'Smith';
run(agentId).catch(console.error);
