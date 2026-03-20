1. What is the canonical directory and manifest location?

The canonical directory should be .reffy/ The reason why you're seeing .references/ as the directory in this repo is that I'm not using the latest version of the reffy project in this directory, but anyone that npm installs reffy to their machine sees a .reffy/ directory after they run the reffy init command. 

2. Is ReffySpec a renamed product or a planning subsystem inside Reffy?

I'd prefer that it remain a planning subsystem inside reffy because I assume that the LOE of trying to fit OpenSpec into reffy is greater than just writing what is needed from scratch. OpenSpec/ReffySpec is a more mature and more complicated project and I'd deliberately like to pair my fork down and make it leaner. 

3. What minimum planning outputs must v1 generate from artifacts?

It should generate the main OpenSpec primitives: proposals/specs/tasks and any boilerplate that's needed within AGENTS.md and any required manifest.json files. 
