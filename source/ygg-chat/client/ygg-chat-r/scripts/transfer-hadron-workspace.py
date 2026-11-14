"""One-time, same-PC Hadron development -> empty packaged workspace transfer.

SQLite online backups preserve a running but idle source. Never copies provider
credentials, Chromium storage, execution permissions or original Graviton data.
Run without --apply for the read-only preflight.
"""
from pathlib import Path
import datetime
from contextlib import closing
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import uuid

DATABASES = ('local-sync.db', 'hadron-project-builds.db', 'hadron-continuous-chat.db')
LOCAL_OWNER = 'a7c485cb-99e7-4cf2-82a9-6e23b55cdfc3'


def read_db(path):
    return sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=5)


def counts(connection):
    names = [row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    return {name: connection.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for name in names}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def packaged_running():
    command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'The Hadron Harness.exe'\").Count"
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command], capture_output=True, text=True, check=True)
    return int(result.stdout.strip()) != 0


def assert_idle(connections):
    checks = {
        'local-sync.db': [('hadron_independent_jobs', 'status'), ('subagent_runs', 'status'), ('hadron_sessions', 'status'), ('hadron_workflows', 'status')],
        'hadron-project-builds.db': [('hadron_project_leases', 'state'), ('hadron_project_cycles', 'state')],
        'hadron-continuous-chat.db': [('hadron_continuous_sessions', 'state')],
    }
    for name, tables in checks.items():
        connection = connections[name]
        available = counts(connection)
        for table, column in tables:
            if table not in available:
                continue
            columns = {row[1] for row in connection.execute('PRAGMA table_info(' + table + ')')}
            if column not in columns:
                column = 'status' if 'status' in columns else 'state'
            active = connection.execute('SELECT COUNT(*) FROM ' + table + ' WHERE ' + column + " IN ('created','running','stopping','reserved','active')").fetchone()[0]
            if active:
                raise RuntimeError('Source has unfinished work: ' + table)


def main():
    source = Path(os.environ['APPDATA']) / 'Hadron-Harness-Development'
    destination = Path(os.environ['APPDATA']) / 'Hadron-Harness'
    for directory in (source, destination):
        if not directory.is_dir() or directory.is_symlink() or directory.is_junction():
            raise RuntimeError('Expected regular Hadron profile directories')
        config = json.loads((directory / 'settings/config.json').read_text(encoding='utf-8'))
        if config.get('local_login_enabled') is not True or config.get('managed_auth_v1', {}).get('app'):
            raise RuntimeError('Transfer requires the same existing local Hadron identity')
    if packaged_running():
        raise RuntimeError('Packaged Hadron must be closed before transfer')
    source_connections = {name: read_db(source / name) for name in DATABASES}
    destination_connections = {name: read_db(destination / name) for name in DATABASES}
    try:
        assert_idle(source_connections)
        original_counts = {name: counts(connection) for name, connection in source_connections.items()}
        destination_counts = {name: counts(connection) for name, connection in destination_connections.items()}
        main_counts = destination_counts['local-sync.db']
        refresh = '--refresh-subset' in sys.argv
        if refresh:
            # A repeat handover is safe only when every existing logical row is
            # unchanged in the newer source. FTS shadow tables are derived from
            # the messages/search-content rows, whose contents are checked too.
            assert_idle(destination_connections)
            for name in DATABASES:
                old, new = destination_connections[name], source_connections[name]
                for table in destination_counts[name]:
                    if table.startswith('top_level_user_message_search_'):
                        continue
                    quoted = '"' + table.replace('"', '""') + '"'
                    if table not in original_counts[name] or list(old.execute('PRAGMA table_info(' + quoted + ')')) != list(new.execute('PRAGMA table_info(' + quoted + ')')):
                        raise RuntimeError('Profile schemas differ; additive import required')
                    if not set(old.execute('SELECT * FROM ' + quoted)).issubset(set(new.execute('SELECT * FROM ' + quoted))):
                        raise RuntimeError('Destination has unique or changed work; additive import required: ' + table)
        else:
            if main_counts.get('messages', 0) or main_counts.get('projects', 0) > 1 or main_counts.get('conversations', 0) > 1:
                raise RuntimeError('Destination contains saved work; an additive import is required instead')
            for name in DATABASES[1:]:
                if any(value for key, value in destination_counts[name].items() if not key.startswith('schema_')):
                    raise RuntimeError('Destination contains agent/project history')
        if source_connections['local-sync.db'].execute('SELECT COUNT(*) FROM conversations WHERE user_id IS NOT NULL AND user_id != ?', (LOCAL_OWNER,)).fetchone()[0]:
            raise RuntimeError('Source ownership needs a separate reviewed import')
        if original_counts['local-sync.db'].get('provider_tokens', 0):
            raise RuntimeError('Legacy credentials must not be copied with chat history')
        versions = {name: connection.execute('PRAGMA data_version').fetchone()[0] for name, connection in source_connections.items()}
        receipt = {'source': str(source), 'destination': str(destination), 'sourceCounts': original_counts, 'destinationCountsBefore': destination_counts, 'providerCredentialsCopied': False, 'sourceModified': False, 'existingRowsVerifiedUnchanged': refresh}
        if '--apply' not in sys.argv:
            print(json.dumps({'preflightPassed': True, **receipt}, indent=2))
            return
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8]
        backup = Path(os.environ['LOCALAPPDATA']) / 'Hadron-Harness' / 'Workspace-Transfers' / stamp
        backup.mkdir(parents=True, exist_ok=False)
        for label, connections, profile in [('source', source_connections, source), ('destination', destination_connections, destination)]:
            folder = backup / label
            folder.mkdir()
            for name, connection in connections.items():
                with closing(sqlite3.connect(folder / name)) as snapshot:
                    connection.backup(snapshot)
                    if snapshot.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise RuntimeError('Snapshot integrity check failed')
                    if counts(snapshot) != counts(connection):
                        raise RuntimeError('Snapshot row counts changed during backup')
            shutil.copy2(profile / 'settings/config.json', folder / 'settings-before.json')
        log_source = source / 'hadron-job-logs'
        log_backup = backup / 'source' / 'hadron-job-logs'
        log_backup.mkdir()
        log_destination = destination / 'hadron-job-logs'
        logs = []
        for file in log_source.iterdir():
            if file.is_symlink() or not file.is_file():
                raise RuntimeError('Unsupported job-log entry')
            target = log_destination / file.name
            if target.exists() and sha(target) != sha(file):
                raise RuntimeError('Destination job-log collision')
            shutil.copy2(file, log_backup / file.name)
            logs.append(file.name)
        assert_idle(source_connections)
        if packaged_running() or any(connection.execute('PRAGMA data_version').fetchone()[0] != versions[name] for name, connection in source_connections.items()):
            raise RuntimeError('A workspace changed during backup; nothing was transferred')
        if any(counts(connection) != destination_counts[name] for name, connection in destination_connections.items()):
            raise RuntimeError('Destination changed during preparation')
        for connection in destination_connections.values():
            connection.close()
        destination_connections.clear()
        previous = backup / 'destination-original-files'
        previous.mkdir()
        applied = []
        moved = []
        added_logs = []
        try:
            for name in DATABASES:
                for suffix in ('', '-wal', '-shm'):
                    file = destination / (name + suffix)
                    if file.exists():
                        os.replace(file, previous / file.name)
                        moved.append(file.name)
                candidate = destination / (name + '.transfer-' + stamp)
                shutil.copy2(backup / 'source' / name, candidate)
                os.replace(candidate, destination / name)
                applied.append(name)
                with closing(read_db(destination / name)) as check:
                    if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or counts(check) != original_counts[name]:
                        raise RuntimeError('Transferred database verification failed')
                if sha(destination / name) != sha(backup / 'source' / name):
                    raise RuntimeError('Transferred snapshot hash mismatch')
            log_destination.mkdir(exist_ok=True)
            for name in logs:
                target = log_destination / name
                if not target.exists():
                    shutil.copy2(log_backup / name, target)
                    added_logs.append(name)
                if sha(target) != sha(log_backup / name):
                    raise RuntimeError('Transferred job-log verification failed')
        except Exception:
            failed = backup / 'failed-candidate'
            failed.mkdir()
            for name in applied:
                os.replace(destination / name, failed / name)
            for name in moved:
                os.replace(previous / name, destination / name)
            for name in added_logs:
                os.replace(log_destination / name, failed / name)
            raise
        receipt.update({'success': True, 'backupDirectory': str(backup), 'jobLogsCopied': len(logs), 'databaseHashes': {name: sha(destination / name) for name in DATABASES}, 'sourceDataVersionUnchanged': all(connection.execute('PRAGMA data_version').fetchone()[0] == versions[name] for name, connection in source_connections.items())})
        (backup / 'transfer-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(receipt, indent=2))
    finally:
        for connection in [*source_connections.values(), *destination_connections.values()]:
            connection.close()


if __name__ == '__main__':
    main()
