# Hadron worker host

`HadronWorkerHost.cs` is fixed trusted Windows x64 code built with the installed
.NET Framework compiler. `scripts/build-hadron-worker-host.mjs` emits the native
executable and source/binary hashes into `vendor/hadron-worker`. Main builds on
Windows invoke that build step; Windows packaging includes those two artifacts.
No source compilation occurs in the running app or through model tools.

The project-only Codex adapter uses an authenticated private named pipe and
durable preparation evidence before acknowledging a launch. `CreateProcessW`
assigns the child to a kill-on-close Job Object via the job-list startup
attribute. Only duplicated stdio handles are inherited. Job breakaway limits
are not enabled. The helper checks assignment, stops remaining descendants and
waits for an empty job before reporting closure. Pipe-owner loss or helper death
stops the job. An existing job-name collision is refused without terminating
the existing owner's job.

The `inspect` mode only queries exact process creation identities and job
accounting. Missing/denied/unsupported information stays unknown. A parent which
is still alive prevents reporting its epoch ended. This is lifecycle containment,
not an OS filesystem or network sandbox. It does not authorize project editing,
resume inference, replay operations or remove execution records.

Run the native acceptance commands from the app folder:

```
node scripts/check-hadron-worker-containment.mjs
node scripts/check-hadron-project-worker-runtime.mjs
node scripts/check-hadron-worker-shutdown.mjs
```

The first command rebuilds the helper. Tests use disposable local Node trees;
the runtime probe uses only bundled Codex version/local signed-out status in a
new profile. It does not sign in or make an inference request.
