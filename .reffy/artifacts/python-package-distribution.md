# Python Package Distribution Direction

## Why this artifact
This note captures an important distribution idea for Reffy:

- Reffy should not only be installable as a global npm CLI
- it should also be consumable as a Python package dependency inside project-local virtual environments

This is not just a packaging preference.
It changes how easily Reffy can appear inside modern agentic execution environments.

## Core idea
Many agent harnesses and developer automation systems already create isolated Python environments as their default runtime boundary.

In those environments, the easiest path to make Reffy available is not:
- install Node globally
- install `reffy-cli` globally
- then teach the harness where that binary lives

The easiest path is:

```bash
pip install reffy
```

After that, the harness should have a local `reffy` command available inside the same venv it already uses for orchestration.

That would let a source repository gain the full Reffy CLI surface in the same environment where agents are already doing work.

## Why this matters
Reffy is trying to become infrastructure for planning, ideation, and remote workspace visibility.

If that is true, then Reffy should meet developers and agent runtimes where they already are.

Right now the product is distributed as a Node CLI.
That works for direct developer usage, but it narrows the default installation path for:

- Python-first local automation
- agentic harnesses that provision a venv automatically
- repo-scoped toolchains that want dependencies pinned inside one project environment

A Python package would expand the footprint across which Reffy can operate without changing the core product model.

## Product judgment
The key point is not "rewrite Reffy in Python."

The key point is:
- make Reffy easy to depend on from Python environments
- while preserving one authoritative CLI and one authoritative workspace contract

That distinction matters.
The packaging surface can expand without creating two independent implementations.

## Parity as the real constraint
There is an important refinement to this direction.

If the long-term goal is runtime parity between Reffy planning products across Node and Python host environments, then Python should not be thought of only as a packaging wrapper forever.

The stronger framing is:

- Python distribution is the opening move
- but the real target is a Python-native capability
- modeled exactly on the existing CLI contract
- while preserving the same workspace semantics, planning semantics, and inspectable/version-controlled artifact model

That would make Reffy embeddable inside projects and agent runtimes without turning it into a different planning system.

The key is to avoid ending up with:
- a Node-flavored Reffy
- and a Python-flavored Reffy

Instead, there should be:
- one Reffy contract
- potentially multiple host-runtime implementations
- and very tight behavioral parity between them

## What success looks like
In the ideal flow:

1. An agent harness creates or reuses a venv for a repo.
2. The harness installs `reffy` with `pip`.
3. The repo-local environment now exposes the `reffy` command.
4. Agents can run `reffy init`, `reffy reindex`, `reffy validate`, `reffy summarize`, `reffy plan ...`, and remote commands without extra global setup.
5. The same local workspace can still publish to Paseo and participate in broader Nuveris-oriented oversight workflows.

The result is a lower-friction control plane for both humans and agentic proxies.

## Why this fits the broader Reffy architecture
Reffy is already aiming to be the local planning and context runtime.

Making it pip-installable would strengthen that role because it would:

- make Reffy easier to inject into ephemeral automation environments
- make repo-local tool installation more deterministic
- reduce dependence on machine-global CLI setup
- improve compatibility with orchestration layers that assume Python dependency management first

This is especially aligned with the idea that Reffy should help extend architectural oversight across local repositories and their remote coordination surface.

From that angle, Python distribution is not a side quest.
It is a multiplier on where Reffy can actually exist.

That matters even more if agents eventually collaborate directly by exchanging repository-level data about the home repositories that serve as the work substrate for their purpose.

In that future, Reffy needs to provide a planning surface that is:

- rich
- inspectable
- portable
- version controlled
- and host-runtime-independent in behavior

That is why parity matters more than packaging convenience by itself.

## Likely implementation shapes
There are at least three plausible shapes.

### Option A: Thin Python wrapper around the existing Node CLI
The Python package installs a small launcher and ensures the Node implementation is available underneath.

Pros:
- preserves the current TypeScript CLI as the single implementation
- lowest product-level divergence risk
- fastest path to test packaging demand

Cons:
- still depends on Node somewhere in the stack
- packaging ergonomics may be awkward if the wrapper has to bootstrap JS assets

### Option B: Ship a Python package that vendors or bundles the compiled CLI
The Python package exposes `reffy` directly and carries the built runtime with it.

Pros:
- better `pip install` ergonomics
- more self-contained from the caller's perspective

Cons:
- release and packaging complexity increases
- cross-platform runtime details need careful handling

### Option C: Build a Python-native implementation layer
Reffy becomes multi-runtime at the implementation level.

Pros:
- strongest Python-native story
- strongest embeddability story for Python-first projects and agent runtimes
- best path toward true runtime parity if the contract is tightly preserved

Cons:
- highest maintenance burden
- risks semantic drift across CLIs
- probably the wrong move for near-term leverage

### Option D: Stage toward native parity
Use a phased model:

1. ship a pip-installable bridge first
2. treat the existing CLI/workspace contract as the authoritative behavior surface
3. progressively define exactly what "parity" means for manifest handling, planning behavior, and remote workflow
4. only move capabilities into Python natively when they can match that contract exactly

Pros:
- preserves short-term leverage
- creates a path toward Python-native Reffy without forcing an immediate rewrite
- keeps parity as the governing architectural rule from the start

Cons:
- requires stronger contract discipline
- still introduces long-term multi-runtime maintenance pressure

## Current recommendation
The most defensible near-term direction is:

- keep the TypeScript CLI as the product authority
- explore a pip-installable distribution path that exposes the same CLI contract inside a venv
- treat Python packaging as a delivery mechanism, not a second runtime strategy

That is the smallest move that increases reach without multiplying core complexity.

## Longer-term recommendation
Because the project can afford to build this carefully, there is a stronger long-term recommendation worth stating explicitly:

- use packaging work as the first step
- but design toward a Python-native implementation that mirrors the existing Reffy CLI contract exactly
- define parity at the level of commands, manifest rules, planning behavior, and remote workflow semantics
- keep one canonical product model even if multiple host runtimes eventually exist

This is what would make Reffy genuinely embeddable as part of a repository's own automation substrate, rather than only callable as an external CLI utility.

## Scope boundaries for an initial iteration
If this direction becomes active work, the first version should stay narrow:

- installable from `pip`
- exposes a working `reffy` command
- supports the same local workspace commands as the npm CLI
- documents runtime prerequisites clearly
- does not fork manifest, artifact, or planning behavior

The first version does not need:

- a separate Python API surface
- Python-specific feature divergence
- a second planning model
- bespoke harness-only commands

What it should do, however, is leave a clean path toward:

- native Python execution of the same Reffy contract
- project-level embedding inside Python-first systems
- host-environment-independent planning behavior

## Risks and constraints
- Naming conflict risk: `reffy` on PyPI may or may not be available.
- Runtime expectation risk: if Node is still required under the hood, that must be explicit.
- Release complexity risk: npm and PyPI publication need versioning discipline.
- Support risk: installation failures become harder to reason about when two ecosystems are involved.
- Identity risk: the project should avoid presenting a Python package as if it were a different product line.

## Strategic upside
If Reffy can be installed anywhere a venv can be created, then the planning stack becomes much easier to project into:

- agent sandboxes
- CI task environments
- repo-local automation
- orchestration systems that already speak Python first

That increases the practical reach of Reffy as the planning/context layer that can coordinate local work and remote visibility through Paseo, while supporting the broader oversight surface you are describing around Nuveris integrations.

If Reffy eventually gains true runtime parity across Node and Python, the upside is larger still:

- agents can exchange repository-derived planning state without caring which host runtime produced it
- repositories can embed Reffy more naturally inside their own execution substrate
- planning artifacts remain portable and inspectable across environments
- version-controlled planning surfaces become shared collaboration media rather than toolchain-specific side effects

That is the direction in which Reffy starts to look less like a standalone CLI and more like a foundational planning capability.

## Reffy as an intermediate representation
Another useful way to think about this is that Reffy could become a kind of intermediate representation between projects.

But it would not be an IR at the source-code level.
It would exist at a higher layer of abstraction:

- above source files
- above language-specific implementation details
- at the level of planning state, context structure, artifact relationships, and inspectable workspace intent

In that model:

- source code remains the execution substrate
- Reffy becomes the planning/context substrate that agents and systems can exchange, inspect, and reason over

That is why runtime parity matters so much.
If Reffy is going to serve as a cross-project planning IR, then its meaning cannot depend on whether the host environment is Node or Python.

The analogy to assembly and C is not exact, but directionally it fits:

- both abstract away lower-level environment differences
- both create a more stable surface that can move across execution contexts
- both allow systems to work against a shared representation rather than directly against raw implementation details

The main difference is that Reffy would be doing this at the planning layer rather than the machine or source-translation layer.

That makes the quality bar very clear.
If Reffy is to function as this kind of higher-level IR, it must remain:

- portable
- inspectable
- deterministic
- version controlled
- and semantically stable across runtimes

Those properties matter more than whether the first Python step is a wrapper or a native implementation.

## Open questions
- Should the Python package be named `reffy`, `reffy-cli`, or something explicitly bridge-oriented?
- Is the goal "pip installs a launcher" or "pip installs a self-contained runtime"?
- Should the Python distribution be positioned as officially first-class or as a compatibility bridge at first?
- Which commands must work on day one for the packaging experiment to be meaningful?
- How much of the value proposition depends on venv-local installability versus true Python-native extensibility?
- What exact contract must be frozen so that a future Python-native runtime can match the Node CLI without drift?
- Which parts of Reffy are the best first candidates for host-runtime-independent behavior: manifest handling, planning runtime, or remote workflow?
