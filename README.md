# spote-editor

A React editor component published as an npm module.

## Installation

```bash
npm install spote-editor
```

## Usage

```tsx
import { SpoteEditor } from 'spote-editor'
import 'spote-editor/styles'

export default function App() {
  return <SpoteEditor />
}
```

## Development

```bash
# Install dependencies
npm install

# Start demo app
npm run dev

# Build library
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Publishing

Tag a commit with a version to trigger the GitHub Actions publish workflow:

```bash
git tag v0.1.0 && git push --tags
```

## License

MIT
