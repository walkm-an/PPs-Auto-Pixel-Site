import { readdirSync, readFileSync } from 'node:fs'

const css = readdirSync('dist/assets')
  .filter((name) => name.endsWith('.css'))
  .map((name) => readFileSync(`dist/assets/${name}`, 'utf8'))
  .join('\n')

if (!css.includes('light-dark(')) {
  console.error('built css dropped light-dark(). cssTarget has to stay on browsers that implement it.')
  process.exit(1)
}

console.log('css ok')
