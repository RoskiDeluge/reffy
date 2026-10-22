# Reffy CLI Handoff: Send an Application Descriptor on `--provision`

For Reffy CLI developers (`~/dev/reffy`, currently v1.10.0). A small,
self-contained change: when `reffy remote init --provision` creates a Paseo
manager, it should describe the application it creates. Nothing on the
paseo-core side needs to change first; paseo-core has accepted descriptors
since `add-application-descriptor`.

Read it from any `nuveris-v1` project with:

```bash
reffy remote cat .reffy/artifacts/reffy_cli_application_descriptor_handoff.md \
  --workspace-id nuveris-v1 --project-id paseo-core
```

Date: 2026-10-22. Raised by LogicalAssembly in `lasm-agent-plugin-view-complete.md`
and `lasm-followup-import-registered-reffy-applications.md` (project
`nuveris`).

## Why
Every manager paseo-core creates is an **application**, and the deployment
registers it with its control plane (LogicalAssembly) as soon as it exists.
The registration carries the application's descriptor:

```json
{ "id": "…", "name": "…", "description": "…", "owner": "…" }
```

The Reffy CLI creates its manager without a descriptor. paseo-core then mints
an `id` and leaves `name`, `description` and `owner` as `null`, so the
application arrives in LogicalAssembly with nothing to show staff. That is
what happened to the `servco-fde` workspace, provisioned on 2026-10-20
(application `d35eab6d…`).

## The change

### 1. Send a descriptor when creating the manager
`PaseoManagerClient.createManagerActor` (`src/remote.ts`, line 398) posts:

```json
{ "config": { "actorType": "reffyWorkspaceManager", "version": "v1", "schema": { "type": "object" }, "params": {} } }
```

Add an `application` block **inside `config`**:

```json
{
  "config": {
    "actorType": "reffyWorkspaceManager",
    "version": "v1",
    "schema": { "type": "object" },
    "params": {},
    "application": {
      "name": "servco-fde",
      "description": "Reffy workspace backend for servco-fde",
      "owner": "roberto.delgado@delgadodev.xyz"
    }
  }
}
```

**Inside `config` matters.** paseo-core silently ignores an `application`
block placed beside `config`. Its docs called it a "top-level" block, which
was misleading; they are corrected in the same paseo-core commit as this
note. paseo-core made the same mistake in its own scripts on 2026-10-22.

Rules (paseo-core's `examples/APPLICATION_DESCRIPTOR.md`):

| Field | Rules | Suggested value |
| --- | --- | --- |
| `id` | 1–128 chars, starts with a letter or digit, then letters, digits, `.`, `_`, `-`. Immutable. | **Omit it.** paseo-core mints a UUID. |
| `name` | 1–200 chars, or `null` | The `--workspace-id` being initialized |
| `description` | up to 2000 chars, or `null` | `Reffy workspace backend for <workspace-id>`, or the `--label` when one is given |
| `owner` | 1–256 chars, or `null`. Opaque, recorded verbatim, never enforced. | See below |

Any other field in the block is rejected with `400`, so send only these.

**`owner`.** paseo-core has no user identity, so the CLI decides. Our
suggestion, in order:
1. an explicit `--owner <text>` flag;
2. a `PASEO_APPLICATION_OWNER` value from the environment or `.env`;
3. otherwise, the repo's `git config user.email`.

Print the descriptor you sent in `remote init`'s output, so whoever runs it
sees what reached the control plane. If none of the three sources gives a
value, send `name` and `description` and omit `owner`; that is still far
better than blank.

The response to creation already includes the stored descriptor:

```json
{ "actorId": "…", "managerAuthToken": "…", "application": { "id": "…", "name": "…", "description": "…", "owner": "…" }, "openapi": "…" }
```

Recording `application.id` in `.reffy/state/remote.json` next to the manager
identity would let later commands, and people, refer to the application by
the id LogicalAssembly shows.

### 2. (Optional) A way to describe an existing application
Applications created before this change, such as `servco-fde`, stay blank
until someone sets their descriptor. paseo-core already has the route; it
takes the manager token (`PASEO_TOKEN`), which the CLI holds:

```
PUT {endpoint}/pods/{pod}/actors/{actor}/application
Authorization: Bearer <PASEO_TOKEN>
{ "name": "servco-fde", "description": "…", "owner": "…" }
```

It merges the supplied fields; explicit `null` clears one. paseo-core sends
the updated descriptor to LogicalAssembly as a new registration sequence on
its own, with no further step. A verb such as
`reffy remote application set [--name] [--description] [--owner]` (and
`get`, using `GET …/application`) would cover it. If you'd rather not add a
verb, the operator can run the `PUT` by hand for `servco-fde`.

## How to verify
1. Run `reffy remote init --provision --workspace-id <scratch-id>` against
   the live deployment.
2. The creation response's `application` shows your `name`, `description`
   and `owner`.
3. `GET …/application/registration` (manager token) shows `status:
   "delivered"`. LogicalAssembly sees the application with its name.
4. Clean up: the scratch manager registers with LogicalAssembly, whose policy
   denies owner teardowns. Ask the paseo-core operator to tear it down with
   the provisioning credential, or leave it and say so in your report.

## Reply
Report in a `reffy` artifact: the CLI version that ships it, and the
application id from your verification run. Nothing in paseo-core waits on
this.
