## ADDED Requirements

### Requirement: Archive-Change Remote Cleanup Guidance
The built-in `archive-change` skill SHALL instruct agents performing authorized remote publication to preview pruning for each target workspace and proceed only when every planned deletion belongs to the active change just archived and the prune guard permits the push.

#### Scenario: The archive cleanup preview passes
- **WHEN** a pruning dry run permits the push and lists only stale paths under the active directory of the change just archived
- **THEN** the skill directs the agent to run `reffy remote push --prune` for that workspace

#### Scenario: Archive cleanup is blocked
- **WHEN** the dry run lists paths outside the active directory of the change just archived or reports that the guard will refuse the prune
- **OR** the real pruning push refuses after a passing dry run
- **THEN** the skill directs the agent to publish using a keep-missing push and report the reason cleanup was deferred and which paths remain
- **AND** the skill prohibits a forced prune for routine archive cleanup
