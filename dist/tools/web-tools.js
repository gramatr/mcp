/**
 * Local web tools — handled in-process without round-tripping to the remote server.
 *
 * - local_fetch: fetch a URL, return text content (with basic HTML stripping)
 * - local_search: DuckDuckGo HTML search (no API key required)
 *
 * These are intentionally simple. For heavy scraping, use a dedicated service.
 */
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 100_000; // 100KB cap on returned content
/**
 * Tool definitions for the web tools.
 */
export function getWebToolDefinitions() {
    return [
        {
            name: 'local_fetch',
            description: 'Fetch a URL and return its text content. Handles HTML stripping. Max 100KB response.',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to fetch (http or https).' },
                    timeout_ms: { type: 'number', description: 'Request timeout in milliseconds (default 15000).' },
                },
                required: ['url'],
            },
            annotations: { readOnlyHint: true },
        },
        {
            name: 'local_search',
            description: 'Web search via DuckDuckGo HTML endpoint. Returns top results (title + url + snippet).',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query.' },
                    max_results: { type: 'number', description: 'Maximum results to return (default 10, max 20).' },
                },
                required: ['query'],
            },
            annotations: { readOnlyHint: true },
        },
    ];
}
/**
 * Check if a tool name is a web tool.
 */
export function isWebTool(name) {
    return name === 'local_fetch' || name === 'local_search';
}
/**
 * Handle a web tool call.
 */
export async function handleWebTool(toolName, args) {
    switch (toolName) {
        case 'local_fetch':
            return handleFetch(args);
        case 'local_search':
            return handleSearch(args);
        default:
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `Unknown web tool: ${toolName}` }) }],
                isError: true,
            };
    }
}
async function handleFetch(args) {
    const url = args.url;
    const timeoutMs = args.timeout_ms || FETCH_TIMEOUT_MS;
    if (!url || !/^https?:\/\//.test(url)) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'url must be a valid http(s) URL' }) }],
            isError: true,
        };
    }
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'User-Agent': 'gramatr-mcp/0.4.0' },
        });
        if (!response.ok) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `HTTP ${response.status} ${response.statusText}` }) }],
                isError: true,
            };
        }
        const contentType = response.headers.get('content-type') || '';
        let text = await response.text();
        // Strip HTML if needed
        if (contentType.includes('text/html')) {
            text = stripHtml(text);
        }
        // Cap content length
        if (text.length > MAX_CONTENT_LENGTH) {
            text = text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... truncated]';
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        url,
                        status: response.status,
                        content_type: contentType,
                        length: text.length,
                        content: text,
                    }),
                },
            ],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Fetch failed: ${message}` }) }],
            isError: true,
        };
    }
}
async function handleSearch(args) {
    const query = args.query;
    const maxResults = Math.min(args.max_results || 10, 20);
    if (!query) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'query is required' }) }],
            isError: true,
        };
    }
    try {
        // DuckDuckGo HTML endpoint (no API key required)
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gramatr-mcp/0.4.0)' },
        });
        if (!response.ok) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: `Search failed: HTTP ${response.status}` }) }],
                isError: true,
            };
        }
        const html = await response.text();
        const results = parseSearchResults(html, maxResults);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        query,
                        result_count: results.length,
                        results,
                    }),
                },
            ],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Search failed: ${message}` }) }],
            isError: true,
        };
    }
}
/**
 * Minimal HTML stripping — removes tags and decodes basic entities.
 * For heavy parsing, use a real library. This is good enough for text extraction.
 */
function stripHtml(html) {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Parse DuckDuckGo HTML results into structured data.
 */
function parseSearchResults(html, maxResults) {
    const results = [];
    // DuckDuckGo result pattern: <a class="result__a" href="URL">TITLE</a> ... <a class="result__snippet">SNIPPET</a>
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        const title = stripHtml(match[2]).trim();
        const snippet = stripHtml(match[3]).trim();
        // DuckDuckGo wraps URLs — extract the real URL from the uddg parameter
        const urlMatch = rawUrl.match(/uddg=([^&]+)/);
        const url = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
        if (title && url) {
            results.push({ title, url, snippet });
        }
    }
    return results;
}
//# sourceMappingURL=web-tools.js.map