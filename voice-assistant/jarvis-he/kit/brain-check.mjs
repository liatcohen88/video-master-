// Asks JAMES's brain one tiny question, the way the bridge asks it: through the
// same Agent SDK, with the same model and no settings files. The installer runs
// it from the JARVIS folder, where the SDK is installed. Prints what happened
// (the reason, if Claude Code could not answer: no login, no Git Bash, a model
// the plan does not include) and exits 0 only when an answer came back.
import { query } from '@anthropic-ai/claude-agent-sdk'
import { homedir } from 'node:os'

// The same defaults as start-jarvis.bat and bridge/server.mjs.
const model = process.env.JARVIS_MODEL || 'claude-sonnet-5'
const effort = process.env.JARVIS_EFFORT || 'high'

// When Claude Code cannot start at all, the reason is only on its stderr.
let claudeSaid = ''

setTimeout(() => {
  console.log('Claude Code did not answer within 3 minutes.')
  process.exit(2)
}, 180_000)

try {
  let answer = ''
  for await (const msg of query({
    prompt: 'Reply with the single word OK.',
    options: {
      model,
      effort,
      cwd: homedir(),
      settingSources: [],
      maxTurns: 2,
      stderr: (data) => {
        claudeSaid = (claudeSaid + String(data)).slice(-1000)
      },
    },
  })) {
    if (msg.type !== 'result') continue
    if (msg.subtype !== 'success') {
      const errors = Array.isArray(msg.errors) ? msg.errors : []
      throw new Error([msg.subtype, ...errors].join(': '))
    }
    // A missing login comes back as a "successful" turn whose text is the
    // complaint, marked is_error.
    if (msg.is_error) throw new Error(String(msg.result || 'Claude Code reported an error.'))
    answer = String(msg.result ?? '')
  }
  if (!answer.trim()) throw new Error('Claude Code ended without an answer.')
  console.log(`OK: ${model} answered.`)
  process.exit(0)
} catch (err) {
  const reason = claudeSaid.replace(/\s+/g, ' ').trim()
  console.log(String(err?.message ?? err) + (reason ? `\n${reason}` : ''))
  process.exit(1)
}
