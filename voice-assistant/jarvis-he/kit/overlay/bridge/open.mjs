import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'

/**
 * Opening a page on the user's screen, in their default browser.
 *
 * The chrome_* tools drive Chrome through the Claude extension's native host,
 * which listens on a Unix socket, so on Windows they can never connect. This
 * is the simple half of what they do, and it works everywhere: hand the
 * address to the operating system and let it open the browser. Web addresses
 * only, so a page read along the way cannot talk it into starting a program.
 */
const openWith = (url) =>
  process.platform === 'win32'
    ? // No shell: cmd would read the & in a query string as a second command.
      spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
        detached: true,
        stdio: 'ignore',
      })

const say = (text) => ({ content: [{ type: 'text', text }] })

export function openServer() {
  return createSdkMcpServer({
    name: 'jarvis_open',
    version: '1.0.0',
    tools: [
      tool(
        'open_url',
        'Open a web page in the user\'s browser, on their screen: a site, a YouTube or ' +
          'Google search, a map. Build the full address yourself, for example ' +
          'https://www.youtube.com/results?search_query=<the words>.',
        { url: z.string().describe('The full http or https address to open.') },
        async ({ url }) => {
          let target
          try {
            target = new URL(String(url).trim())
          } catch {
            return say('That is not a web address.')
          }
          if (target.protocol !== 'https:' && target.protocol !== 'http:') {
            return say('Only web pages (http or https) can be opened.')
          }
          try {
            const child = openWith(target.href)
            child.on('error', (err) => console.error('[jarvis] open_url failed:', err?.message ?? err))
            child.unref()
          } catch (err) {
            return say(`The browser could not be opened: ${err?.message ?? err}`)
          }
          return say(`Opened ${target.hostname} in the browser.`)
        },
      ),
    ],
  })
}
