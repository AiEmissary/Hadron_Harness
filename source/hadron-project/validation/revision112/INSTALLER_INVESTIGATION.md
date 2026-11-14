# Installer launch comparison

The direct Node spawnSync/windowsHide launcher returned 0xC0000005 for the 0.4.11 baseline and twice for the new 0.4.12 installer before installation. Retain those failures. Windows Application/WER queries supplied no matching details in this pass.

The optional installer observer recorded two installer launches exiting 0 without reported exceptions. That full fixture failed its uninstall check: it waited for executable removal and immediately inspected registration. Later inspection found registration already removed. The checker now waits for both conditions and retains cleanup responsibility until both disappear. Initial observer setup errors did not launch the installer and are not product results.

The normal Windows Start-Process comparison passed full 0.4.12 installation, repair, startup, saved-message preservation, SQLite backup/recovery after simulated corruption, interrupted-helper non-replay and uninstall. Original shortcuts were restored. This does not establish the cause of the Node-launch failures. The existing Node path remains the default reproduction path; --native-installer selects the Windows comparison explicitly. These checks use disposable installation/profile directories on this existing Windows host, not a fresh PC.

The observer uses only a newly created test installer process. It records bounded exception codes and module offsets, with no memory dump or account-store access and no Windows security-setting changes. It is not active during normal app startup. Reference: https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-waitfordebugevent .

The actual 0.4.11-to-0.4.12 upgrade result is recorded separately when complete. Different launch paths and failed attempts must remain distinguishable in the evidence.
