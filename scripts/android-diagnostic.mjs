// Publish a small, redacted build diagnostic through the GitHub Checks API.
// Useful when Actions log archives are not accessible to the caller.
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
let log = await readFile('.arena/android-build.log', 'utf8').catch(() => 'No native build log was written. Check SDK/setup steps in this run.')
log = log.replace(/\x1b\[[0-9;]*m/g, '')
for (const [name, value] of Object.entries(process.env)) {
  if (/(token|secret|password|key)/i.test(name) && value && value.length >= 8) log = log.replaceAll(value, '[REDACTED]')
}
log = log.replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-(?:proj-)?[A-Za-z0-9_-]{12,})\b/g, '[REDACTED]')
const lines = log.split(/\r?\n/)
const interesting = new Set()
lines.forEach((line, index) => {
  if (/error:|fatal error|what went wrong|execution failed|could not|failed|killed|exception|failure:/i.test(line)) {
    for (let i = Math.max(0, index - 1); i <= Math.min(lines.length - 1, index + 4); i++) interesting.add(i)
  }
})
const errors = [...interesting].map(index => lines[index]).join('\n')
const summary = `${errors.slice(-9500)}\n\nLast output:\n${log.slice(-3500)}`.slice(-13000)
const payload = { name: 'Android native build diagnostic', head_sha: process.env.GITHUB_SHA, status: 'completed', conclusion: 'neutral', output: { title: 'Native build failed — bounded diagnostic', summary: `\`\`\`text\n${summary.replaceAll('```', "'''")}\n\`\`\`` } }
execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/check-runs`, '--method', 'POST', '--input', '-'], { input: JSON.stringify(payload), stdio: ['pipe', 'ignore', 'inherit'] })
console.log('Published a redacted diagnostic in the commit checks.')
