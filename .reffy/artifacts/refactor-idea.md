Here are my initial ideas about where I'd like to take the reffy project. 

Currently, as you know, reffy is intended as an ideation helper that sits upstream of more formal spec driven development 
frameworks like OpenSpec, which I've cloned into .vendor/ and renamed ReffySpec. 

I think you get the idea of what I'd like to do. Basically I want my fork of OpenSpec to inherit most of the features of the original project, but add certain features that allow it to integrate better with reffy. Basically, whereas before I thought that reffy could serve as a helper for OpenSpec, now I'm thinking the opposite, that the real value is derived from the abstract ideation artifacts created in the .reffy/artifacts directory and ReffySpec/OpenSpec can be in charge of implementing the proposal, tasks, specs based on them. 

This refactor would not only reduce the friction of having to specify separate agent instructions in the root level and nested AGENTS.md files, but would make the interconnection of features/specs/proposals/tasks more natively connected to their reffy ideation artifacts. In this way, everything connected to planning new features is contained within an integrated ideation layer that spans very highlevel and minimally specified ideation, to more concrete implementation specs and task lists. 

# guidelines for refactor v1
1. ReffySpec should be paired down to remove all multiplatform targets that currently characterize the OpenSpec project and just focus on making a solid nodejs/typescript app like reffy
2. ReffySpec should inherit and integrate the manifest.json strategy/format of the reffy project, this will allow devs/agents to better query metadata associated with tasks/specs/proposals via tags on CLI flags, for instance.
3. The consolidated reffy project doesn't require telemetry infrastructure for the v1 refactor
4. Where possible, the consolidated reffy project should eliminate slash commands that are intended for specific agentic harnesses and instead rely on developing/extending traditional CLI commands
