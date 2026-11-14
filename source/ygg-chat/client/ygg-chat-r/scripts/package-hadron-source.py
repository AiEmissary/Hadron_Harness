"""Package committed Hadron build sources and notices, never local profiles."""
from pathlib import Path
import subprocess, json, hashlib, zipfile, re

app = Path(__file__).resolve().parents[1]
repo = app.parents[2]
workspace = repo.parent
version = json.loads((app / 'electron-builder.json').read_text(encoding='utf8'))['extraMetadata']['version']
subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--', 'ygg-chat', 'license.md', 'readme.md'], cwd=repo, check=True, stdout=subprocess.DEVNULL)
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
names = subprocess.check_output(['git', 'ls-files', '-z', '--', 'ygg-chat', 'license.md', 'readme.md'], cwd=repo).decode('utf8').split('\0')
prefix = f'Hadron-Harness-{version}-source/'
output = workspace / 'distribution' / f'Hadron-Harness-{version}-source.zip'
entries = []
excluded = []
for name in filter(None, names):
    relative = Path(name)
    if any(part.startswith('.env') or part in {'.git', 'node_modules', '.codex', '.claude', '.qubit', '.agents'} for part in relative.parts) or relative.name.lower() in {'auth.json', 'credentials.json', 'cookies.json'} or relative.suffix.lower() in {'.db', '.sqlite', '.sqlite3', '.pfx', '.p12', '.key', '.pem'}:
        excluded.append(name)
        continue
    file = repo / relative
    if file.is_symlink() or not file.resolve().is_relative_to(repo.resolve()):
        raise RuntimeError(f'Source link/escape needs review: {name}')
    data = file.read_bytes()
    if relative.suffix.lower() in {'.json', '.ts', '.tsx', '.js', '.mjs', '.txt', '.md'}:
        text = data.decode('utf8', errors='replace')
        if re.search(r'sk-(?:proj-|ant-api\d+-)[A-Za-z0-9_-]{60,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----', text):
            raise RuntimeError(f'Potential credential must be reviewed before source packaging: {name}')
    entries.append(('source/' + name, data))
licences = workspace / 'distribution' / 'licences'
for file in licences.rglob('*'):
    if file.is_file():
        if file.is_symlink() or not file.resolve().is_relative_to(licences.resolve()):
            raise RuntimeError('Linked licence resource refused')
        entries.append(('distribution/licences/' + file.relative_to(licences).as_posix(), file.read_bytes()))
entries.append(('SOURCE_BUILD.md', (workspace / 'SOURCE_BUILD.md').read_bytes()))
entries.append(('WINDOWS_RELEASE.md', (workspace / 'WINDOWS_RELEASE.md').read_bytes()))
manifest = {'version': version, 'sourceRevision': revision, 'scope': 'Hadron build sources, original licence/readme, dependency locks, pinned vendor install recipes, worker source, build scripts and distribution notices. Dependencies and official runtime binaries are installed from their pinned published packages.', 'excludedPaths': excluded, 'files': [{'path': name, 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries]}
entries.append(('SOURCE_REVISION.json', json.dumps(manifest, indent=2).encode('utf8')))
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, data in entries:
        archive.writestr(prefix + name, data)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for item in manifest['files']:
        assert hashlib.sha256(archive.read(prefix + item['path'])).hexdigest() == item['sha256']
print(json.dumps({'sourceZip': str(output), 'version': version, 'sourceRevision': revision, 'entries': len(entries), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'verifiedEntryHashes': True}, indent=2))
