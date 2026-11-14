"""Export committed Hadron sources safely, then optionally push and back up an installer.
Credentials stay inside Git Credential Manager or this process's request headers.
Run from the original Hadron workspace. A restored clone can use ordinary Git.
"""
from pathlib import Path
import argparse, hashlib, http.client, json, os, re, subprocess, sys, urllib.error, urllib.parse, urllib.request

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'source'
MIRROR=ROOT/'github-backup'
OWNER='AiEmissary'
REPOSITORY='Hadron_Harness'
REMOTE=f'https://{OWNER}@github.com/{OWNER}/{REPOSITORY}.git'
API=f'https://api.github.com/repos/{OWNER}/{REPOSITORY}'
ENV={**{k:v for k,v in os.environ.items() if not k.upper().startswith(('GIT_TRACE','GCM_TRACE')) and k.upper()!='GIT_CURL_VERBOSE'},'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'Never'}
FORBIDDEN={'.git','node_modules','.codex','.claude','.qubit','.agents','__pycache__'}
PRIVATE_SUFFIXES={'.db','.sqlite','.sqlite3','.pfx','.p12','.pem','.key'}
PRIVATE_NAMES={'auth.json','credentials.json','cookies.json'}
MAX_FILE=50*1024*1024

def git(args,cwd=SOURCE,input=None,check=True):
    result=subprocess.run(['git',*args],cwd=cwd,env=ENV,input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError('Git operation failed: '+result.stderr.decode('utf-8',errors='replace').strip())
    return result

def allowed(name):
    p=Path(name)
    return (not p.is_absolute() and '..' not in p.parts and not any(part in FORBIDDEN or part.startswith('.env') for part in p.parts)
            and p.suffix.lower() not in PRIVATE_SUFFIXES and p.name.lower() not in PRIVATE_NAMES and ':' not in name)

def destination(name):
    p=MIRROR/name
    if not p.resolve().is_relative_to(MIRROR.resolve()): raise RuntimeError('Backup path escaped its directory')
    if p.is_symlink(): raise RuntimeError('Linked backup file refused')
    return p

def credential():
    # Capture the helper response in memory; never echo, save or log it.
    result=git(['-c',f'credential.username={OWNER}','credential','fill'],
               input=f'protocol=https\nhost=github.com\nusername={OWNER}\n\n'.encode())
    values=dict(line.split('=',1) for line in result.stdout.decode().splitlines() if '=' in line)
    if not values.get('password'): raise RuntimeError('Sign in to GitHub with Git Credential Manager first')
    return values['password']

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def api(token,path='',method='GET',data=None,missing=False):
    url=path if path.startswith('https://') else API+path
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or parsed.netloc!='api.github.com': raise RuntimeError('Unexpected GitHub API address')
    headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Hadron-Harness-Backup'}
    if data is not None: headers['Content-Type']='application/json'
    request=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(request,timeout=40) as response: return json.load(response)
    except urllib.error.HTTPError as error:
        if missing and error.code==404: return None
        raise RuntimeError(f'GitHub API returned HTTP {error.code}; no credential details were logged') from None

def export_source():
    if git(['status','--porcelain']).stdout.strip(): raise RuntimeError('Commit the checked source changes before backing up')
    revision=git(['rev-parse','HEAD']).stdout.decode().strip()
    config=json.loads(git(['show','HEAD:ygg-chat/client/ygg-chat-r/electron-builder.json']).stdout)
    version=config['extraMetadata']['version']
    MIRROR.mkdir(exist_ok=True)
    if not (MIRROR/'.git').exists(): git(['init','--initial-branch=main'],cwd=MIRROR)
    elif git(['rev-parse','--verify','HEAD'],cwd=MIRROR,check=False).returncode==0 and git(['status','--porcelain'],cwd=MIRROR).stdout.strip():
        raise RuntimeError('Backup working directory has edits; review them before updating')
    remote=git(['remote','get-url','origin'],cwd=MIRROR,check=False)
    if remote.returncode: git(['remote','add','origin',REMOTE],cwd=MIRROR)
    elif remote.stdout.decode().strip()!=REMOTE: raise RuntimeError('Backup destination differs; nothing was pushed')
    state=MIRROR/'.git/hadron-backup-files.json'
    previous=set(json.loads(state.read_text(encoding='utf-8'))) if state.exists() else set()
    managed={}
    def write(name,data):
        if not allowed(name) or len(data)>MAX_FILE: raise RuntimeError('Unsuitable backup path or oversized file: '+name)
        if re.search(rb'sk-(?:proj-|ant-api\d+-)[A-Za-z0-9_-]{60,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data):
            raise RuntimeError('Potential credential in source needs review: '+name)
        p=destination(name);p.parent.mkdir(parents=True,exist_ok=True)
        if not p.exists() or p.read_bytes()!=data: p.write_bytes(data)
        managed[name]=hashlib.sha256(data).hexdigest()
    entries=[];executable_files=[]
    for record in git(['ls-tree','-r','-z','HEAD']).stdout.split(b'\0'):
        if not record: continue
        info,name=record.split(b'\t',1);mode,kind,oid=info.decode().split()
        name=name.decode()
        if kind=='blob' and mode!='120000' and allowed(name):
            entries.append((name,oid))
            if mode=='100755': executable_files.append('source/'+name)
    worker=subprocess.Popen(['git','cat-file','--batch'],cwd=SOURCE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for name,oid in entries:
            worker.stdin.write((oid+'\n').encode());worker.stdin.flush()
            header=worker.stdout.readline().split()
            if len(header)!=3 or header[1]!=b'blob': raise RuntimeError('Invalid Git object response')
            size=int(header[2])
            if size>MAX_FILE: raise RuntimeError('Source file too large for this backup: '+name)
            data=worker.stdout.read(size)
            if len(data)!=size or worker.stdout.read(1)!=b'\n': raise RuntimeError('Incomplete Git object response')
            write('source/'+name,data)
    finally:
        worker.stdin.close();worker.wait(timeout=15)
    for name in ['WINDOWS_RELEASE.md','SOURCE_BUILD.md']:
        write(name,(ROOT/name).read_bytes())
    for name in ['AGENTS.md','GITHUB_BACKUP.md']:
        if (ROOT/name).exists(): write(name,(ROOT/name).read_bytes())
    licences=ROOT/'distribution/licences'
    for p in licences.rglob('*'):
        if p.is_file():
            if p.is_symlink() or not p.resolve().is_relative_to(licences.resolve()): raise RuntimeError('Linked licence file refused')
            write('distribution/licences/'+p.relative_to(licences).as_posix(),p.read_bytes())
    readme=f"""# Hadron Harness

Private source and release backup for the Hadron Harness desktop application.

Current release: **{version}**.

- Questions and answers on the left, conversation branches on the right.
- Agent A, Agent B, Work together and Continuous conversation.
- Chat and Agent permissions, folder/file tools, visual previews and saved projects.
- Browser OAuth for ChatGPT, optional device codes, and Claude Code print mode.

## Build and restore

Read [SOURCE_BUILD.md](SOURCE_BUILD.md) and [WINDOWS_RELEASE.md](WINDOWS_RELEASE.md).
The application sources are in source/ygg-chat. Licences and notices are in distribution/licences.
SOURCE_REVISION.json identifies the original checked source revision and file hashes.

Personal chat databases, provider credentials, local account settings, dependencies and build caches are excluded.
Large installers are kept in GitHub Releases rather than source history.

## Updates

On the original development PC, run python Sync-Hadron-GitHub.py --push after committing and checking changes.
The updater exports only committed source and reviewed build materials. It does not force-push.
On a restored clone, normal Git commits and pushes can be used.
"""
    write('README.md',readme.encode())
    write('.gitignore',b'**/node_modules/\n**/.codex/\n**/.claude/\n**/.qubit/\n**/.env*\n**/auth.json\n*.db\n*.sqlite*\n*.exe\n*.log\n')
    write('.gitattributes',b'# Preserve exact exported file bytes and SHA256 manifest values.\n* -text\n')
    write('tools/Sync-Hadron-GitHub.py',Path(__file__).read_bytes())
    manifest={'product':'Hadron Harness','version':version,'sourceRevision':revision,'scope':'Committed application sources and build materials; local account settings and personal data excluded','executableFiles':executable_files,'files':managed.copy()}
    write('SOURCE_REVISION.json',json.dumps(manifest,indent=2,sort_keys=True).encode())
    for name in previous-set(managed):
        if not allowed(name): raise RuntimeError('Unexpected previous backup path')
        p=destination(name)
        if p.is_file(): p.unlink()
    state.write_text(json.dumps(sorted(managed)),encoding='utf-8')
    return version,revision,managed,previous

def push_backup(token,version,revision,managed,previous):
    user=api(token,'https://api.github.com/user')
    repo=api(token)
    if user['login'].lower()!=OWNER.lower() or repo['full_name'].lower()!=f'{OWNER}/{REPOSITORY}'.lower(): raise RuntimeError('GitHub account/repository mismatch')
    if not repo['private'] or not repo.get('permissions',{}).get('push'): raise RuntimeError('A private writable repository is required')
    git(['config','user.name',OWNER],cwd=MIRROR)
    git(['config','user.email',f"{user['id']}+{OWNER}@users.noreply.github.com"],cwd=MIRROR)
    git(['fetch','origin'],cwd=MIRROR)
    remote=git(['rev-parse','--verify','refs/remotes/origin/main'],cwd=MIRROR,check=False)
    local=git(['rev-parse','--verify','HEAD'],cwd=MIRROR,check=False)
    if remote.returncode==0 and (local.returncode!=0 or git(['merge-base','--is-ancestor','refs/remotes/origin/main','HEAD'],cwd=MIRROR,check=False).returncode):
        raise RuntimeError('GitHub has changes not present in this backup; merge them before updating')
    paths=b'\0'.join(name.encode() for name in sorted(set(managed)|previous))+b'\0'
    git(['--literal-pathspecs','add','--force','--all','--pathspec-from-file=-','--pathspec-file-nul'],cwd=MIRROR,input=paths)
    # Preserve source executable bits even when preparing the backup on Windows.
    git(['update-index','--chmod=-x','-z','--stdin'],cwd=MIRROR,input=b'\0'.join(name.encode() for name in sorted(managed))+b'\0')
    executables=json.loads((MIRROR/'SOURCE_REVISION.json').read_text(encoding='utf-8'))['executableFiles']
    if executables: git(['update-index','--chmod=+x','-z','--stdin'],cwd=MIRROR,input=b'\0'.join(name.encode() for name in executables)+b'\0')
    if git(['diff','--cached','--quiet'],cwd=MIRROR,check=False).returncode:
        git(['-c','commit.gpgsign=false','commit','-m',f'Back up Hadron Harness {version} ({revision[:7]})'],cwd=MIRROR)
    git(['push','--set-upstream','origin','main'],cwd=MIRROR)
    head=git(['rev-parse','HEAD'],cwd=MIRROR).stdout.decode().strip()
    refs=git(['ls-remote','origin','refs/heads/main'],cwd=MIRROR).stdout.decode().split()
    if not refs or refs[0]!=head: raise RuntimeError('Remote commit verification failed')
    return head

def backup_installer(token,version,commit):
    installer=ROOT.parent/f'Hadron-Harness-{version}-win-x64.exe'
    proof=json.loads((ROOT/'test-results'/f'release-{version}-installer-verification.json').read_text(encoding='utf-8'))
    digest=hashlib.file_digest(installer.open('rb'),'sha256').hexdigest()
    if digest!=proof['sha256'] or installer.stat().st_size!=proof['bytes']: raise RuntimeError('Installer differs from validated release')
    tag='v'+version
    release=api(token,'/releases/tags/'+tag,missing=True)
    if not release:
        notes=(ROOT/'WINDOWS_RELEASE.md').read_text(encoding='utf-8')
        heading=f'## New in release {version}'
        changes=notes.split(heading,1)[1].split('\n## ',1)[0].strip() if heading in notes else 'See WINDOWS_RELEASE.md for the included changes.'
        body='Windows x64 installer backup.\n\n'+changes+'\n\nInstaller is unsigned. Close Hadron before installing. Matching source and build instructions are in this repository.'
        release=api(token,'/releases',method='POST',data={'tag_name':tag,'target_commitish':commit,'name':f'Hadron Harness {version}','draft':True,'prerelease':False,'body':body})
    existing={asset['name']:asset for asset in api(token,f"/releases/{release['id']}/assets?per_page=100")}
    checksum=ROOT/'test-results'/f'GitHub-SHA256SUMS-{version}.txt'
    checksum.write_text(f'{digest}  {installer.name}\n',encoding='utf-8')
    for p,content_type in [(installer,'application/vnd.microsoft.portable-executable'),(checksum,'text/plain')]:
        name='SHA256SUMS.txt' if p==checksum else p.name
        expected=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
        asset=existing.get(name)
        if asset:
            if asset['state']!='uploaded' or asset['size']!=p.stat().st_size or asset.get('digest')!='sha256:'+expected: raise RuntimeError('An existing release asset differs; it was not overwritten')
            continue
        url=release['upload_url'].split('{')[0]
        target=urllib.parse.urlparse(url)
        if target.netloc!='uploads.github.com' or target.scheme!='https' or target.path!=f"/repos/{OWNER}/{REPOSITORY}/releases/{release['id']}/assets": raise RuntimeError('Unexpected release upload address')
        print('Uploading '+name,flush=True)
        conn=http.client.HTTPSConnection('uploads.github.com',timeout=300)
        try:
            conn.putrequest('POST',target.path+'?'+urllib.parse.urlencode({'name':name}))
            for key,value in {'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Hadron-Harness-Backup','Content-Type':content_type,'Content-Length':str(p.stat().st_size)}.items(): conn.putheader(key,value)
            conn.endheaders()
            with p.open('rb') as stream:
                for block in iter(lambda:stream.read(1024*1024),b''): conn.send(block)
            response=conn.getresponse()
            raw=response.read()
            if response.status!=201: raise RuntimeError(f'GitHub asset upload returned HTTP {response.status}')
            asset=json.loads(raw)
        finally: conn.close()
        if asset['state']!='uploaded' or asset['size']!=p.stat().st_size or asset.get('digest')!='sha256:'+expected: raise RuntimeError('Uploaded asset checksum/size verification failed')
    if release['draft']: release=api(token,f"/releases/{release['id']}",method='PATCH',data={'draft':False})
    return release['html_url']

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--push',action='store_true')
    parser.add_argument('--release',action='store_true',help='Also back up the current validated Desktop installer as a private repository release')
    args=parser.parse_args()
    if args.release and not args.push: parser.error('--release requires --push')
    version,revision,managed,previous=export_source()
    result={'version':version,'sourceRevision':revision,'files':len(managed),'repository':f'https://github.com/{OWNER}/{REPOSITORY}','prepared':True,'pushed':False}
    print(f'Prepared {len(managed)} Hadron source/build files; local account settings excluded.',flush=True)
    if args.push:
        token=credential()
        result['backupCommit']=push_backup(token,version,revision,managed,previous)
        result['pushed']=True;result['private']=True
        print('Source commit uploaded and verified.',flush=True)
        if args.release: result['release']=backup_installer(token,version,result['backupCommit'])
    (ROOT/'test-results/github-backup-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    try: main()
    except Exception as error:
        print('Backup stopped: '+str(error),file=sys.stderr);sys.exit(1)

