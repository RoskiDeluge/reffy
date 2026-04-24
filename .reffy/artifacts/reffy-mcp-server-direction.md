# Reffy MCP Server Direction

## Why this artifact
This note explores whether Reffy should be able to expose its runtime through MCP.

The short answer is yes.

Given the direction of the project, MCP should be treated as an important protocol surface for Reffy, not as a side integration.

That does not mean Reffy should become "just an MCP wrapper."
It means Reffy should be architected so that its runtime can be projected through MCP cleanly, without inventing a second product model.

## Why this matters now
More agentic environments are aligning on MCP as the standard contract for connecting models and runtimes to external tools and services.

If Reffy is trying to become:

- a local planning runtime
- a portable and version-controlled planning/context layer
- a remote-inspectable workspace substrate through Paseo
- and eventually a cross-project planning IR for collaborating agents

then MCP is one of the clearest ways for that runtime to become available inside those environments.

Without MCP, Reffy can still be useful.
But it remains relatively siloed behind a CLI or host-specific embedding story.

With MCP, Reffy becomes easier to attach to:

- local agent harnesses
- IDE agents
- hosted multi-agent runtimes
- orchestration systems that already assume MCP for tool access

## Main judgment
Reffy should not build an MCP-specific planning system.
It should expose the existing Reffy runtime through an MCP server.

That distinction is important.

The authoritative model should stay:

- one workspace contract
- one set of manifest/artifact/spec semantics
- one remote model
- multiple access surfaces

Those surfaces can include:

- the CLI
- a future Python-native runtime
- an MCP server

If Reffy instead evolves separate semantics for CLI usage versus MCP usage, it will lose the exact thing that makes it strategically strong: a stable, inspectable planning contract above the source-code layer.

## Reffy as a higher-level intermediate representation
The strongest reason to make Reffy MCP-capable is that the project is starting to look like a higher-level intermediate representation between repositories.

Not an IR for source code.
An IR for planning state, repository intent, artifact relationships, and inspectable context.

In that model:

- source code is the execution substrate
- Reffy is the planning/context substrate
- MCP is one of the standard transport contracts by which agents can access that substrate

That is a good fit.
MCP is not the meaning of Reffy.
It is a way to expose Reffy's meaning to agent systems in a standard shape.

## How this fits with Paseo
Paseo should remain the remote runtime and transport substrate.

Reffy should remain the planning runtime and product surface.

That suggests a clean layering:

1. Reffy owns local workspace semantics and planning commands.
2. Paseo owns durable remote actor/runtime behavior for published `.reffy/` state.
3. Reffy may call Paseo through its native remote commands.
4. An MCP server can expose Reffy operations to outside agents without those agents needing to know the raw Paseo contract.

This is important because it avoids coupling every agent integration directly to Paseo.

Agents should usually not need to know:

- how pods are provisioned
- how actor ids are stored
- which remote endpoints exist
- how `.reffy/` import payloads are shaped

Those are Reffy runtime concerns.
MCP should expose the Reffy layer, not leak backend mechanics by default.

## How this fits with Nuveris
Nuveris appears to be the broader oversight and cross-project coordination horizon around this work.

From that perspective, MCP support in Reffy matters because it gives Nuveris-style systems a standard way to inspect and work with repository-level planning state.

That could matter for:

- cross-project planning retrieval
- portfolio-level oversight
- dependency-aware planning across repositories
- agent-to-agent coordination using shared workspace context instead of ad hoc prompts

The key point is that Nuveris should not need custom per-tool glue just to understand a repository's Reffy surface.

If Reffy exposes a stable MCP contract, then Nuveris-oriented systems can connect to many repositories through one standard protocol while still relying on the same underlying Reffy semantics.

## Architectural rule: MCP should sit on top of the existing contract
The safest rule is:

"Every meaningful MCP operation should correspond to an existing or intentionally added Reffy runtime capability."

That keeps MCP from becoming a shadow API that drifts away from the CLI.

For example:

- `reffy validate` should have an MCP equivalent
- `reffy summarize` should have an MCP equivalent
- `reffy plan ...` operations should have MCP equivalents where appropriate
- `reffy remote status|push|ls|cat` should map naturally to MCP tools/resources

If an operation is useful only through MCP, that may still be fine, but it should be justified as a true runtime capability rather than a protocol convenience hack.

## Likely MCP shape
The most natural design is a mix of MCP tools and resources.

### Tools
Tools are appropriate for actions and derived computations.

Likely candidates:

- initialize a Reffy workspace
- reindex and validate the workspace
- summarize artifacts
- create planning scaffolds
- inspect remote linkage and status
- push local `.reffy/` state to the linked remote backend

These map well to existing command-like behaviors.

### Resources
Resources are appropriate for stable inspectable state.

Likely candidates:

- manifest contents
- artifact documents
- current spec or change files
- remote workspace document listings
- selected remote document contents

This matters because a lot of what makes Reffy valuable is not just actions.
It is inspectable structured state.
MCP resources are a strong fit for that.

## Important product choice: prefer semantic access over filesystem leakage
One temptation would be to expose `.reffy/` through MCP as little more than a file tree.

That would be easy, but it would undersell the product.

The better direction is:

- expose raw documents where useful
- but center the MCP surface on Reffy semantics

Examples:

- "get workspace identity"
- "list artifacts"
- "summarize artifact set"
- "show active planning changes"
- "get remote workspace status"
- "fetch remote document by logical `.reffy/...` path"

That keeps Reffy legible as a planning system rather than reducing it to generic file access.

## Minimal first MCP surface
A narrow first pass would be enough.

I would start with read-heavy capabilities plus a small number of explicit write actions.

Suggested first surface:

- tool: `workspace_status`
- tool: `validate_workspace`
- tool: `summarize_workspace`
- tool: `remote_status`
- tool: `remote_push`
- resource: manifest
- resource: artifact by path
- resource: current spec/change file by path
- resource: remote document list
- resource: remote document by path

That would already make Reffy materially more useful inside MCP-native environments.

## Why read-heavy first is the right move
MCP will make Reffy easier for outside agents to touch.
That means the first responsibility is to make the planning surface inspectable and trustworthy, not maximally mutable.

A read-heavy first pass would:

- let agents discover repository planning context safely
- support cross-project inspection workflows
- preserve the explicitness of local authoring
- avoid rushing into broad remote mutation semantics

The explicit write operations that do make sense early are the ones Reffy already models clearly, such as `remote_push` and perhaps scaffold creation.

## Relationship to the Python direction
The Python direction and the MCP direction should reinforce each other.

They solve different availability problems:

- Python distribution helps Reffy live inside Python-first execution environments
- MCP helps Reffy present itself through a standard agent-facing service contract

Those should converge on one runtime model.

Ideally:

- the CLI remains authoritative for contract definition
- Python gains parity as an implementation and embedding surface
<!-- I almost feel like based on your ideas above that we should put our effort into making the MCP implementation the best it can be based on the existing node based CLI -->
- MCP becomes the standard network/service projection of the same runtime

That is how Reffy avoids fragmenting while still becoming broadly embeddable.

## Relationship to the existing remote commands
The new Paseo-backed remote commands are an important precursor to MCP support.

Why:

- they already define a real remote contract
- they already separate local identity from remote linkage
- they already provide inspectable remote operations
- they already prove that Reffy can mediate between local planning state and a remote runtime substrate

In other words, Reffy has already started becoming a runtime, not just a local file helper.

MCP would be the next surface through which that runtime is exposed.

## Risks
- Drift risk: MCP semantics diverge from CLI semantics.
- Scope risk: the first MCP surface tries to expose too much mutable power too early.
- Leakage risk: Reffy exposes raw Paseo mechanics instead of stable Reffy-level capabilities.
- Portability risk: MCP support lands only in Node shape and becomes awkward to preserve if Python parity arrives later.
<!-- Not sure if python parity is needed if reffy's runtime can be expanded into MCP -->
- Security risk: remote mutation and workspace editing need a clear permission model once exposed through MCP.
<!-- Yes, we'll need to add propert authentication between reffy runtimes and paseo remote state  -->

## Recommended design principles
- Keep one Reffy contract and multiple runtime surfaces.
- Treat MCP as a protocol projection, not a second product.
- Prefer semantic tools/resources over generic filesystem mirroring.
- Keep Paseo behind the Reffy runtime boundary.
- Make read access excellent before broadening write access.
- Design names and payloads so they can survive both Node and Python implementations.
<!-- Let's just focus on Node and MCP for now -->
- Preserve inspectability and determinism as first-class constraints.

## Current recommendation
Yes, Reffy should be designed to expose its runtime through MCP.

But the right framing is not:
"add an MCP integration."

The right framing is:
"make Reffy a runtime that can be projected through MCP cleanly."

That is more aligned with your broader ambition.

If Reffy becomes:

- the local planning/context runtime
- the remote-publishable planning substrate through Paseo
- the cross-project planning IR above source code
- and an MCP-addressable runtime for agent systems

then it starts to occupy a very strong architectural position.

It becomes the layer through which repositories expose structured planning state to humans, agents, and oversight systems without requiring each environment to invent its own repository understanding model.

## Practical next step
The next useful planning step would be to write a concrete spec for a small first-party MCP surface that:

- mirrors existing Reffy runtime capabilities
- stays mostly read-oriented at first
- includes explicit mapping rules from CLI/runtime concepts to MCP tools and resources
- defines what must remain backend-agnostic versus what may be Paseo-backed internally
- keeps future Python parity in scope from day one
