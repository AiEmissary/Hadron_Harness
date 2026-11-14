import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Inventory only. A handler in source is not proof that its external service works.
const appDir = path.resolve(import.meta.dirname, '..')
const controls = []
for (const file of ['src/containers/Settings.tsx', 'src/components/SettingsPane/SettingsPane.tsx']) {
  const source = ts.createSourceFile(file, readFileSync(path.join(appDir, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const attributes = node => Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(source), attr.initializer?.getText(source) ?? 'true']))
  const walk = (node, section = 'Header / shared controls') => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'SettingsSection') section = attributes(node.openingElement).title ?? section
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (['button', 'Button', 'input', 'textarea', 'select', 'Select', 'ThemeManager', 'ToolsSettings', 'ChatInputBorderAnimationSettings', 'SendButtonAnimationSettings', 'FastModeAnimationSettings'].includes(tag)) {
        const attrs = attributes(node)
        controls.push({ file, section, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, tag,
          label: attrs['aria-label'] ?? attrs.title ?? attrs.placeholder ?? null,
          handlers: Object.fromEntries(Object.entries(attrs).filter(([key]) => /^on[A-Z]/.test(key))),
          disabled: attrs.disabled ?? null })
      }
    }
    ts.forEachChild(node, child => walk(child, section))
  }
  walk(source)
}
const report = { purpose: 'Source inventory, including conditional/unavailable controls; not a count of functional passes', count: controls.length, controls }
if (process.argv[2]) writeFileSync(path.resolve(process.argv[2]), JSON.stringify(report, null, 2))
else console.log(JSON.stringify(report, null, 2))
