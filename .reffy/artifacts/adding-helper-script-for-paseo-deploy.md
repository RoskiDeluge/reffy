ok, I copied the script into an .mjs file within a scripts directory. I also create a .env file. I'm assuming I'll need to add the paseo variables to that file?
1:31 PM


Yes.

For that helper script in the reffy repo, you should add at least:

export PASEO_ENDPOINT="https://paseo-core.paseo.workers.dev"
export PASEO_POD_NAME="7d1d056c-01ef-488c-a49e-03377eeae948"
And usually leave this unset when creating a fresh actor:

# export PASEO_ACTOR_ID=""
Use PASEO_ACTOR_ID only when you want to target an existing backend actor instead of creating a new one.

You should not need:

REFFY_PROJECT_ID
REFFY_WORKSPACE_NAME
because your script reads those from the local .reffy/manifest.json.

One practical note: if you run the script with plain node scripts/your-script.mjs, Node will not automatically load .env. You’ll need either:

source .env && node scripts/your-script.mjs
or a package script like:
"scripts": {
  "remote-backend-demo": "source .env && node scripts/remote-backend-demo.mjs"
}
If you want, I can also point out one cleanup you can make next in that copied script: putDocument, acquireLock, and releaseLock are no longer needed for this workflow if you are only using bulk import.




1:31 PM
wait, wouldn't this deploy script be required in all projects that want to deploy a remote backend via paseo? Since the deploy script reads the manifest.json to set project_id and workspace identifiers, the script needs to be built in to reffy
1:34 PM



Yes. If this workflow is meant to be generally available to any project that uses Reffy, then this logic belongs in Reffy, not in each individual project and not permanently in paseo-core.

The reason is straightforward:

the script depends on .reffy/manifest.json
.reffy/manifest.json is Reffy-owned workspace metadata
the operation itself is a Reffy workflow: identify workspace, connect to backend, push .reffy/
So the long-term ownership should be:

Reffy owns the command and manifest-driven identity logic
Paseo owns the backend actor/runtime that Reffy targets
What you have in paseo-core right now is best treated as a reference implementation and bootstrap tool while you build the real Reffy CLI surface.

So I’d frame it like this:

current examples/reffy-remote-backend-demo.mjs in paseo-core is a prototype
equivalent logic should move into Reffy as either:
a temporary helper script in scripts/, or
the first implementation of reffy remote init/push/status
once that exists in Reffy, the paseo-core script becomes optional demo/reference material
The one nuance is deployment responsibility:

if “deploy remote backend” means “create actor and import workspace,” Reffy can own that flow
if it also means “deploy/update the Paseo Worker infrastructure itself,” that should stay on the Paseo side
That split keeps the boundary clean.

So the answer is: yes, this manifest-aware deploy/import script should effectively be built into Reffy.
