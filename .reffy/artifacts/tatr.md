```bash
Usage: reffy ls [OPTIONS]
OPTIONS:
    -c 
        List closed tasks
    -a 
        List tasks in ascending order
    -t <str> ... -t <str> ...
        Show only tasks with these tags
    -f '.<tag> keyword .<tag>'
        Custom filter logic with keywords: AND, OR, NOT
    -help 
        Print this help message

```

I want to create a compiler for the filter expressions within the ' '

Here are some examples: 

reffy ls -f '.ai and .blog'
<!-- returns any tasks whose tags match "ai" and "blog" -->

reffy ls -f '.ai or blog'
<!-- returns any tasks whose tags match "ai" or "blog" -->

reffy ls -f '.untagged'
<!-- returns any tasks without any tags -->


task .md files should include a header: 

e.g.

<!-- header begin -->
# Task Name
- STATUS: OPEN, CLOSED, PARTIAL
- PRIORITY: 1 - 100
- TAGS: mcpengine,agentproxy
<!-- header end -->

## 1. Native Executor Replacement
- [ ] 1.1 Remove custom string-eval execution from the deployed codemode path.
- [ ] 1.2 Rework the codemode runtime to follow the Cloudflare-native codemode execution model.
- [ ] 1.3 Preserve session-scoped sandbox reuse for repeated MCP calls in the same session.

## 2. MCP and Bridge Integration
- [ ] 2.1 Keep MCP tool execution routed through the native codemode path for deployed codemode actors.
- [ ] 2.2 Preserve timeout, outbound policy, and sandbox metadata across MCP and agentProxy responses.
- [ ] 2.3 Ensure executor identity clearly reports the native path in successful executions.

## 3. Validation
- [ ] 3.1 Add or update tests that distinguish native codemode success from the previous custom evaluator behavior.
- [ ] 3.2 Deploy the corrected implementation.
- [ ] 3.3 Provision a fresh micro-agent pair and confirm real codemode execution succeeds without code-generation errors.
