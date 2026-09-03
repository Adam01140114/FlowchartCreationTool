const https = require('https');
const dns = require('dns');
const { URL } = require('url');
const { promisify } = require('util');

dns.setDefaultResultOrder('ipv4first');

const lookupAsync = promisify(dns.lookup);

function parseRetryAfterMs(errorMessage) {
  const match = String(errorMessage || '').match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  return Math.ceil(parseFloat(match[1]) * 1000) + 500;
}

function isRetryableNetworkError(error) {
  const code = error?.cause?.code || error?.code || '';
  const message = String(error?.message || '');
  return (
    code === 'ENOTFOUND'
    || code === 'ECONNRESET'
    || code === 'ETIMEDOUT'
    || code === 'EAI_AGAIN'
    || code === 'UND_ERR_CONNECT_TIMEOUT'
    || message.includes('fetch failed')
    || message.includes('Request timed out')
  );
}

function isRetryableHttpError(error, response, bodyText) {
  if (isRetryableNetworkError(error)) return true;
  const status = response?.status;
  if (status === 429 || status === 503 || status === 529) return true;
  const message = String(bodyText || error?.message || '');
  return /rate limit|try again in|overloaded/i.test(message);
}

function httpsRequestWithResolvedIp(urlString, options = {}) {
  const parsedUrl = new URL(urlString);
  const body = options.body;

  return lookupAsync(parsedUrl.hostname, { family: 4 }).then(({ address }) => new Promise((resolve, reject) => {
    const req = https.request({
      hostname: address,
      servername: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        Host: parsedUrl.hostname,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          json: async () => JSON.parse(text),
          text: async () => text,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (body) req.write(body);
    req.end();
  }));
}

function getAnthropicApiKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}

function getAnthropicModel(requestedModel) {
  const configured = String(process.env.ANTHROPIC_MODEL || '').trim();
  if (configured) return configured;
  const requested = String(requestedModel || '').trim();
  if (requested && !requested.startsWith('gpt-')) return requested;
  return 'claude-sonnet-4-6';
}

// Sampling params (temperature/top_p/top_k) are rejected with a 400 on Claude
// Opus 5, the Opus 4.7/4.8 family, Sonnet 5 and Fable/Mythos 5. Opus 4.6,
// Sonnet 4.6 and older still accept them.
const NO_SAMPLING_MODEL = /^claude-(?:fable-5|mythos-5|opus-5|opus-4-(?:7|8)|sonnet-5)/;

function acceptsSamplingParams(model) {
  return !NO_SAMPLING_MODEL.test(String(model || '').trim());
}

function parseDataUrl(url) {
  const match = String(url || '').match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function convertContentPartToAnthropic(part) {
  if (typeof part === 'string') {
    return { type: 'text', text: part };
  }
  if (!part || typeof part !== 'object') {
    return { type: 'text', text: String(part ?? '') };
  }
  if (part.type === 'text') {
    return { type: 'text', text: String(part.text || '') };
  }
  if (part.type === 'image_url') {
    const url = part.image_url?.url || part.image_url || '';
    const parsed = parseDataUrl(url);
    if (!parsed) {
      return { type: 'text', text: `[unsupported image reference: ${String(url).slice(0, 80)}]` };
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: parsed.mediaType,
        data: parsed.data,
      },
    };
  }
  return { type: 'text', text: JSON.stringify(part) };
}

function convertMessagesToAnthropic(messages = []) {
  let system = '';
  const anthropicMessages = [];

  for (const message of messages) {
    if (!message) continue;
    if (message.role === 'system') {
      const chunk = typeof message.content === 'string'
        ? message.content
        : (message.content || []).map((p) => (typeof p === 'string' ? p : p.text || '')).join('\n');
      system = system ? `${system}\n\n${chunk}` : chunk;
      continue;
    }

    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof message.content === 'string'
      ? message.content
      : (message.content || []).map(convertContentPartToAnthropic);

    anthropicMessages.push({ role, content });
  }

  if (!anthropicMessages.length) {
    anthropicMessages.push({ role: 'user', content: 'Continue.' });
  }

  return { system, messages: anthropicMessages };
}

function buildOpenAiStyleResponse(anthropicData) {
  const text = (anthropicData.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return {
    id: anthropicData.id,
    object: 'chat.completion',
    model: anthropicData.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: text,
        },
        finish_reason: anthropicData.stop_reason || 'stop',
      },
    ],
    usage: anthropicData.usage,
  };
}

async function fetchAnthropicChatCompletions(openAiBody, retryOptions = {}) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey.startsWith('sk-ant-')) {
    throw new Error('ANTHROPIC_API_KEY is missing or invalid. Add the same Claude key used by File Explorer to FormWiz .env.');
  }

  const { system, messages } = convertMessagesToAnthropic(openAiBody.messages || []);
  let systemPrompt = system || '';
  if (openAiBody.response_format?.type === 'json_object') {
    systemPrompt = `${systemPrompt}\n\nReturn valid JSON only. Do not wrap the JSON in markdown fences.`.trim();
  }

  const model = getAnthropicModel(openAiBody.model);
  const anthropicBody = {
    model,
    max_tokens: openAiBody.max_tokens || 16384,
    messages,
  };
  if (acceptsSamplingParams(model)) {
    anthropicBody.temperature =
      typeof openAiBody.temperature === 'number' ? openAiBody.temperature : 0.1;
  }
  if (systemPrompt) anthropicBody.system = systemPrompt;

  const maxAttempts = retryOptions.maxAttempts ?? 5;
  const baseDelayMs = retryOptions.baseDelayMs ?? 1500;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await httpsRequestWithResolvedIp('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicBody),
      });

      if (response.ok) {
        const anthropicData = await response.json();
        const openAiStyle = buildOpenAiStyleResponse(anthropicData);
        const payload = JSON.stringify(openAiStyle);
        return {
          ok: true,
          status: 200,
          headers: response.headers,
          json: async () => openAiStyle,
          text: async () => payload,
        };
      }

      const bodyText = await response.text();
      if (isRetryableHttpError(null, response, bodyText) && attempt < maxAttempts) {
        const retryMs = parseRetryAfterMs(bodyText) || baseDelayMs * attempt * 2;
        console.warn(`[anthropic-fetch] Attempt ${attempt} rate limited (${response.status}). Retrying in ${retryMs}ms…`);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        continue;
      }

      const err = new Error(bodyText || `Anthropic request failed (${response.status})`);
      err.responseStatus = response.status;
      throw err;
    } catch (error) {
      lastError = error;

      if (!isRetryableNetworkError(error) || attempt === maxAttempts) {
        break;
      }

      const delayMs = baseDelayMs * attempt;
      console.warn(`[anthropic-fetch] Attempt ${attempt} failed (${error.code || error.message}). Retrying in ${delayMs}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const code = lastError?.cause?.code || lastError?.code || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    throw new Error(
      'Cannot reach Anthropic (DNS/network error). Check your internet connection, VPN, or firewall, then try again.'
    );
  }
  if (code === 'ETIMEDOUT' || String(lastError?.message || '').includes('timed out')) {
    throw new Error('Anthropic request timed out. Check your network connection and try again.');
  }

  throw lastError || new Error('Anthropic request failed');
}

/**
 * Chat-completions client with IPv4 DNS resolution and retries.
 * When ANTHROPIC_API_KEY is set (same Claude key as File Explorer), OpenAI-shaped
 * demo/auto-form calls are routed to Anthropic Messages API.
 */
async function fetchOpenAiWithRetry(url, options, retryOptions = {}) {
  const anthropicKey = getAnthropicApiKey();
  const isChatCompletions = String(url || '').includes('/v1/chat/completions');

  if (anthropicKey && isChatCompletions) {
    let openAiBody = {};
    try {
      openAiBody = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
    } catch {
      openAiBody = {};
    }
    console.log(`[anthropic-fetch] Routing chat completion through Claude (${getAnthropicModel(openAiBody.model)})`);
    return fetchAnthropicChatCompletions(openAiBody, retryOptions);
  }

  const maxAttempts = retryOptions.maxAttempts ?? 5;
  const baseDelayMs = retryOptions.baseDelayMs ?? 1500;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await httpsRequestWithResolvedIp(url, options);
      if (response.ok) return response;

      const bodyText = await response.text();
      if (isRetryableHttpError(null, response, bodyText) && attempt < maxAttempts) {
        const retryMs = parseRetryAfterMs(bodyText) || baseDelayMs * attempt * 2;
        console.warn(`[openai-fetch] Attempt ${attempt} rate limited (${response.status}). Retrying in ${retryMs}ms…`);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        continue;
      }

      const err = new Error(bodyText || `OpenAI request failed (${response.status})`);
      err.responseStatus = response.status;
      throw err;
    } catch (error) {
      lastError = error;

      if (!isRetryableNetworkError(error) || attempt === maxAttempts) {
        break;
      }

      const delayMs = baseDelayMs * attempt;
      console.warn(`[openai-fetch] Attempt ${attempt} failed (${error.code || error.message}). Retrying in ${delayMs}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const code = lastError?.cause?.code || lastError?.code || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    throw new Error(
      'Cannot reach OpenAI (DNS/network error). Check your internet connection, VPN, or firewall, then try again.'
    );
  }
  if (code === 'ETIMEDOUT' || String(lastError?.message || '').includes('timed out')) {
    throw new Error('OpenAI request timed out. Check your network connection and try again.');
  }

  throw lastError || new Error('OpenAI request failed');
}

module.exports = { fetchOpenAiWithRetry };
