<!-- me: 

let's say I'm working on a CLI app that is a task managment system. Basically the app allows the user/agent to create .md task files. I'm interested in extending the capability of this CLI app so that it can "compile" expressions formatted like this: 

reffy ls -f ".ai and .blog" 

Which would return any tasks that are tagged with "ai" and "blog" 

Would the content within the quotes be considered an expression? And if so, would I need to build some sort of special parser to be able to evaluate the following keywords: and, not, or ? -->

ChatGPT:

Yes—what’s inside the quotes is typically treated as a query expression (or filter expression). In your example:

reffy ls -f ".ai and .blog"

the string:

.ai and .blog

is an expression describing a boolean condition over tags.

Conceptually it’s similar to:

Gmail search queries

SQL WHERE clauses

GitHub issue filters

ripgrep / jq / Lucene queries

So the short answer:

Yes, it's an expression.

Yes, something needs to parse and evaluate it.

But you don’t necessarily need a complicated parser.

What you're actually building

You’re implementing a boolean query language over task metadata.

Example tasks:

task1.md
tags: [ai, blog]

task2.md
tags: [ai]

task3.md
tags: [blog]

Example expressions:

.ai
.ai and .blog
.ai or .design
.ai and not .done
(.ai or .ml) and .blog

These are boolean expressions over tags.

The typical architecture

Most CLIs implement this in three steps:

1. Tokenize the string

Convert:

.ai and not .blog

into tokens:

[TAG(ai), AND, NOT, TAG(blog)]

Example tokenizer rules:

pattern	token
.ai	TAG("ai")
and	AND
or	OR
not	NOT
(	LPAREN
)	RPAREN
2. Parse into an AST

From:

.ai and not .blog

build a tree:

       AND
      /   \
  TAG(ai)  NOT
              \
             TAG(blog)

This makes evaluation easy.

3. Evaluate against a task

Example task:

tags = { "ai", "blog" }

Evaluation:

TAG(ai)      -> true
TAG(blog)    -> true
NOT TAG(blog)-> false
AND          -> false
Do you have to build a parser?

Depends how complex you want the language.

Option 1 — Simple parser (recommended)

For boolean filters this is easy to implement.

The grammar is tiny:

expr  -> term (OR term)*
term  -> factor (AND factor)*
factor -> NOT factor | TAG | "(" expr ")"

This is a classic recursive descent parser and can be written in ~100 lines.

Many CLI tools do exactly this.

Option 2 — Convert to a boolean predicate

You can compile the expression into a function:

(tags) => tags.has("ai") && tags.has("blog")

Then evaluate it for every task.

Option 3 — Use an existing parser library

If you want:

precedence

parentheses

extensibility later

You can use:

PEG parsers

Pratt parser

parser combinators

But for this use case it’s usually overkill.

Operator precedence you probably want

Standard boolean precedence:

NOT  (highest)
AND
OR   (lowest)

Example:

.ai or .ml and .blog

means:

.ai OR (.ml AND .blog)
Example evaluation loop

Pseudo-logic:

tasks = load_all_tasks()

for task in tasks:
    if evaluate(expression_ast, task.tags):
        print(task)
One design improvement (very common)

Instead of .ai syntax you could parse tags explicitly:

tag:ai and tag:blog

or

ai and blog

But .ai is perfectly fine and visually nice.

The key idea

Your CLI filter string is basically a mini query language.

So the pipeline becomes:

string query
   ↓
tokenizer
   ↓
parser
   ↓
AST
   ↓
boolean evaluator
   ↓
matching tasks

If you're interested, I can also show a very small Pratt parser design for this that many modern CLIs use (it's extremely clean for boolean expressions).

Why is it called a Pratt parser?

A Pratt parser is named after Vaughan Pratt, the computer scientist who introduced the technique in a 1973 paper titled “Top Down Operator Precedence.”

So the name is simply attribution to the inventor, which is common in parsing algorithms:

Parser	Named after
Pratt parser	Vaughan Pratt
Earley parser	Jay Earley
CYK parser	Cocke–Younger–Kasami
Dijkstra’s Shunting Yard	Edsger Dijkstra
What Pratt actually invented

Before Pratt’s work, handling operator precedence in expression languages usually required complicated grammar rules or multi-stage parsers.

Pratt proposed a much simpler idea:

Let tokens themselves know how they behave in expressions.

Instead of encoding precedence in grammar rules, each operator defines:

how it parses when appearing at the start of an expression

how it parses when appearing between expressions

its precedence (binding power)

This allows the parser to interpret expressions like:

a + b * c

correctly as:

a + (b * c)

without needing a large grammar.

The key concept: “binding power”

Every operator has a binding strength.

Example:

*  -> binding power 20
+  -> binding power 10

So when parsing:

a + b * c

the parser sees:

+ (10)
* (20)

Since * binds more tightly, the structure becomes:

a + (b * c)
Why Pratt parsers are popular for DSLs and CLIs

They’re especially useful for expression languages, like the filter system you're building.

Example:

.ai and not .blog or .ml

You can give each operator a precedence:

NOT -> 30
AND -> 20
OR  -> 10

Then the Pratt parser naturally produces:

        OR
       /  \
     AND   TAG(ml)
    /   \
 TAG(ai) NOT
           \
         TAG(blog)

No complicated grammar required.

Why people like Pratt parsers

They are:

Small (often ~100 lines)

Extremely extensible

Great for REPLs, CLIs, DSLs

Easy to add new operators

For example you could later add:

.ai and priority > 3

or

tag:ai and due < 2026-04-01

without rewriting the whole parser.

The historical reference

Pratt’s original paper:

“Top Down Operator Precedence” (1973)

introduced the algorithm that later became known simply as a Pratt parser.

Interestingly, the technique became popular decades later through language implementations like:

Lua

Monkey language (Thorsten Ball's book)

many interpreters and DSLs

modern compilers and tools

In one sentence

A Pratt parser is named after Vaughan Pratt, who invented a simple way to parse expressions by letting tokens define their own precedence and parsing behavior.
