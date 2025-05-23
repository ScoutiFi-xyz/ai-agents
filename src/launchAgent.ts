import dotenv from 'dotenv';
import { spawn } from 'child_process';
import http from 'http';
import { BrowserContext, chromium, Page } from 'playwright';
import { OpenAI } from 'openai';
import { AGENT_PROFILE_MAP } from './profiles';

dotenv.config();

const AGENTS_CHROME_PROFILE_DIR = 'chrome-profile-data';
const DAPP_URL = 'localhost:5001';

type Token = {
  address: string;
  balance?: number;
  price?: number;
};

async function run(agentId: string) {
  const agentConfig = AGENT_PROFILE_MAP[agentId];
  if (!agentConfig) {
    throw new Error(`Invalid agent ID: ${agentId}`);
  }

  openChromeWithAgentProfile(agentId);

  await waitForChromeCDP(agentConfig.port);

  await runAgent(agentId);
}

function openChromeWithAgentProfile(agentId: string) {
  const agentConfig = AGENT_PROFILE_MAP[agentId];

  const chromeArgs = [
    `--remote-debugging-port=${agentConfig.port}`,
    `--user-data-dir=${`${process.cwd()}/${AGENTS_CHROME_PROFILE_DIR}`}`,
    `--profile-directory=${agentConfig.profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
  ];

  console.log('🚀 Launching Chrome with logs...');

  /**
   * Note: chromium needs to be started with a dedicated user profile for testing
   * as this would be the environment
   * in which the extensions data would be kept
   *
   * google-chrome \
   *  --remote-debugging-port=9223 \
   *  --user-data-dir="./chrome-profile-data" \
   *  --profile-directory="Profile Smith"
   */
  const chromeProcess = spawn('google-chrome', chromeArgs, {
    stdio: 'inherit',
  });

  chromeProcess.on('exit', (code) => {
    console.log(`Chrome exited with code ${code}`);
  });
}

function waitForChromeCDP(port: number, timeoutMs: number = 10000): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      console.log(`⌛ Checking if Chrome is ready...`);
      http.get(`http://localhost:${port}/json/version`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for Chrome CDP port ${port}`));
      } else {
        setTimeout(tryConnect, 300); // retry every 300ms
      }
    };

    tryConnect();
  });
}

function buildAgentPrompt(agentConfig: any, tokens: Token[]) {
  const agentPersonality = agentConfig.personality

  let prompt = `
You are a crypto trading agent.

${agentPersonality}

The base token (stablecoin) is: ${process.env.STABLECOIN_ADDRESS}.

`;

  prompt += 'You have these tokens available to sell (and no other):\n';
  let balancesPrompt = '';
  for (const token of tokens) {
    if (token.balance) {
      balancesPrompt += `- ${token.address}: ${token.balance}\n`;
    }
  }
  prompt += `${balancesPrompt}\n`;

  prompt += `Current token prices (relative to the base token) are:\n`;
  let pricesPrompt = '';
  for (const token of tokens) {
    if (token.price) {
      pricesPrompt += `- ${token.address}: ${token.price}\n`;
    }
  }
  prompt += `${pricesPrompt}\n`;

  prompt += 'Decide which token would you swap from/to the base token according to your preference, holdings amount and current market state. You can only sell tokens that you already hold in the wallet.\n';
  prompt += 'Respond in JSON format like:\n';
  prompt += '{ "from": "0x...", "to": "0x...", "amount": "0.5", "reason": "0x... is cheap and I prefer having more of it" }\n';

  return prompt;
}

async function performSwap(
  context: BrowserContext,
  page: Page,
  from: string,
  to: string,
  amount: string,
): Promise<void> {
  await page.selectOption('.from-swap-token select', { value: from });
  await page.selectOption('.to-swap-token select', { value: to });
  await page.fill('.from-swap-amount input', amount);

  await page.waitForTimeout(3000);

  // approve
  const approveButton = await page.$('.approve-token-button');
  if (approveButton && await approveButton.isVisible()) {
    await approveButton.click();

    // approval 1
    let [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.waitForTimeout(1000),
    ]);
    await popup.waitForLoadState('load');

    await popup.waitForSelector('button:has-text("Confirm")', { timeout: 10000 });
    await popup.click('button:has-text("Confirm")');

    // approval 2
    [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.waitForTimeout(1000),
    ]);
    await popup.waitForLoadState('load');
    await popup.waitForSelector('button:has-text("Confirm")', { timeout: 10000 });
    await popup.click('button:has-text("Confirm")');
  }

  // swap
  await page.waitForTimeout(3000); // Note: some blind wait is needed as button constantly rerenders and you cant rely on "is disabled" selector
  // await page.waitForSelector('.swap-token-button:not([disabled])', { timeout: 30000 });
  await page.evaluate(() => {
    const button = document.querySelector('.swap-token-button') as HTMLButtonElement | null;
    if (button) button.click();
  });

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.waitForTimeout(1000),
  ]);
  await popup.waitForLoadState('load');
  await popup.waitForSelector('button:has-text("Confirm")', { timeout: 10000 });
  await popup.click('button:has-text("Confirm")');
}

async function runAgent(agentId: string) {
  const agentConfig = AGENT_PROFILE_MAP[agentId];

  const browser = await chromium.connectOverCDP(`http://localhost:${agentConfig.port}`);

  const context = browser.contexts()[0];
  const page = await context.newPage();

  console.log(`[${agentId}] Opening dApp...`);
  await page.goto(DAPP_URL);

  const connectButton = await page.waitForSelector('text="Connect Wallet"', { timeout: 10000 });
  await connectButton.click();

  // choose Metamask wallet from rainbow modal
  const connectMetamaskButton = await page.waitForSelector('text="MetaMask"', { timeout: 10000 });
  await connectMetamaskButton.click();


  console.log(`[${agentId}] Waiting for MetaMask popup...`);
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.waitForTimeout(1000), // allow MetaMask to open
  ]);

  // use mascot container as indicator that extension is MetaMask and is currently locked
  const onMetamaskUnlockPage = await popup.waitForSelector('.unlock-page__mascot-container', {
    timeout: 10000,
  }).catch(() => null);

  if (onMetamaskUnlockPage) {
    console.log(`[${agentId}] MetaMask popup opened: ${popup.url()}`);

    // wait for unlock form if it appears
    const passwordInput = await popup.waitForSelector('input[type="password"]', { timeout: 5000 }).catch(() => null);
    if (passwordInput) {
      console.log(`[${agentId}] Unlocking MetaMask...`);
      await passwordInput.fill(process.env.METAMASK_PASSWORD!);
      await popup.click('button:has-text("Unlock")');
      await popup.waitForTimeout(1000);
    }

    console.log(`[${agentId}] Approving connection...`);

    await popup.waitForSelector('button:has-text("Connect")', { timeout: 10000 });
    await popup.click('button:has-text("Connect")');

    console.log(`[${agentId}] Connection approved!`);
  }

  // fetch pools available
  const res = await fetch(`${process.env.API_URL}/v1/pools`, {
    headers: {
      'x-api-key': process.env.API_KEY,
    }
  });
  if (res.status !== 200) {
    throw new Error('Failed to fetch pools');
  }
  const pools = await res.json();

  const tokenAddresses = new Set(pools.flatMap(p => [p.poolKey.currency0, p.poolKey.currency1]));

  // get agent metamask address (should have only one connected)
  const accounts = await page.evaluate(async () => {
    let accounts = [];
    // @ts-ignore
    accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    return accounts;
  });
  console.log(`[${agentId}] Accounts connected`, accounts);
  const account = accounts[0];

  // build tokens data that agent should care about
  const tokens: Token[] = Array.from(tokenAddresses).map((address: string) => ({ address }))

  // assign balances to tokens
  for (const token of tokens) {
    const balance = await page.evaluate(async ({ userAddress, tokenAddress }) => {

      // Strip "0x" and pad the address to 32 bytes
      const paddedAddress = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');

      // Build calldata: function selector + padded address (keccak256("balanceOf(address)"))
      const data = '0x70a08231' + paddedAddress;

      // @ts-ignore
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data,
          },
          'latest',
        ],
      });

      // Decode result: hex string to number (bigint or float)
      return parseFloat(BigInt(result).toString()) / 1e6; // 6 decimals for all tokens
    }, { userAddress: account, tokenAddress: token.address });

    token.balance = balance;
  }

  // assign prices to tokens (relative to stablecoin)
  for (const token of tokens) {
    const res = await fetch(`${process.env.API_URL}/v1/price/${token.address}`, {
      headers: {
        'x-api-key': process.env.API_KEY,
      }
    });
    if (res.status !== 200) {
      throw new Error('Failed to fetch pools');
    }
    const priceRes = await res.json();

    token.price = priceRes.price
  }

  console.log(`[${agentId}] balances:`);
  console.table(tokens);

  // format all input data into a human readable prompt
  const prompt = buildAgentPrompt(agentConfig, tokens)

  console.log(`[${agentId}] prompt:`);
  console.info(prompt);

  // think!
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_SECRET_KEY,
  });
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // Note: cost-effective model, could try with gpt-4-turbo or others as well
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const decision = JSON.parse(response.choices[0].message?.content || '{}');
    console.log(`[${agentId}] Decision: ${decision.from} → ${decision.to} for ${decision.amount}`);
    console.log(`[${agentId}] Reason: ${decision.reason}`);

    // TODO: a hardcoded value for testing the swap actions only, remove pls
    // const decision = {
    //   from: '0x6C8374476006Bc20588Ebc6bEaBf1b7B05aD5925',
    //   to: '0x61d13E125c1Cf535DA7f978aEdbAB73ad70315b1',
    //   amount: '50'
    // }

    await performSwap(context, page, decision.from, decision.to, decision.amount);
  } catch (err) {
    console.error('Failed to make a decision:', err);
    throw new Error('Failed to make a decision');
  }

  await page.waitForTimeout(15000); // let the page update
  await context.close();

  console.log(`[${agentId}] Done`);
}

const agentId = process.argv[2] || 'Smith';
run(agentId).catch(console.error);
