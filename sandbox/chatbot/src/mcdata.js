/* Pip: Minecraft knowledge base (Java Edition 1.21-era). Pure data; the logic lives in minecraft.js.
   Recipes use a grid of letters (rows top to bottom, a space = empty slot) and a key.
   "Planks" means any wood type, "Log" any log, "Wool" any color, "Cobblestone" also takes blackstone
   or cobbled deepslate where the game allows it. */
(function (P) {
  "use strict";
  const items = [];
  // R(name, recipe, extra)
  function R(name, spec) { items.push(Object.assign({ name }, spec)); }

  // ---------- basics ----------
  R("Planks", { shapeless: ["Log"], makes: 4, aliases: "plank|wood planks|wooden planks|oak planks|spruce planks|birch planks|wood plank",
    info: "The first thing you make! Each log gives 4 planks, and the planks take the wood type of the log." });
  R("Stick", { grid: ["P", "P"], key: { P: "Planks" }, makes: 4, aliases: "sticks" , info: "Used in almost every tool and torch." });
  R("Crafting Table", { grid: ["PP", "PP"], key: { P: "Planks" }, aliases: "workbench|crafting bench|craft table|craftingtable|work bench",
    info: "Gives you the full 3x3 crafting grid. Your inventory only has a 2x2 grid." });
  R("Furnace", { grid: ["CCC", "C C", "CCC"], key: { C: "Cobblestone" }, aliases: "oven",
    info: "Smelts ores and cooks food. Needs fuel like coal, charcoal, wood or a lava bucket." });
  R("Chest", { grid: ["PPP", "P P", "PPP"], key: { P: "Planks" }, aliases: "chests|storage box",
    info: "Holds 27 stacks. Put two side by side for a double chest (54 slots)." });
  R("Barrel", { grid: ["PSP", "P P", "PSP"], key: { P: "Planks", S: "Wooden Slab" }, info: "Like a chest, but it can open with a block on top of it." });
  R("Torch", { grid: ["C", "S"], key: { C: "Coal or Charcoal", S: "Stick" }, makes: 4, aliases: "torches|tourch",
    info: "Light level 14. Place them to keep mobs from spawning." });
  R("Soul Torch", { grid: ["C", "S", "N"], key: { C: "Coal or Charcoal", S: "Stick", N: "Soul Sand or Soul Soil" }, makes: 4, info: "Blue flame, and piglins are scared of it." });
  R("Lantern", { grid: ["NNN", "NTN", "NNN"], key: { N: "Iron Nugget", T: "Torch" }, info: "A hanging light, light level 15." });
  R("Soul Lantern", { grid: ["NNN", "NTN", "NNN"], key: { N: "Iron Nugget", T: "Soul Torch" } });
  R("Campfire", { grid: [" S ", "SCS", "LLL"], key: { S: "Stick", C: "Coal or Charcoal", L: "Log" },
    info: "Cooks up to 4 food items without fuel, and smoke under a beehive keeps bees calm." });
  R("Bed", { grid: ["WWW", "PPP"], key: { W: "Wool (same color)", P: "Planks" }, aliases: "beds",
    info: "Sleep through the night and set your spawn point. Don't use it in the Nether or the End... it explodes!" });
  R("Ladder", { grid: ["S S", "SSS", "S S"], key: { S: "Stick" }, makes: 3, aliases: "ladders" });
  R("Fence", { grid: ["PSP", "PSP"], key: { P: "Planks", S: "Stick" }, makes: 3, aliases: "fences|wooden fence|oak fence" });
  R("Fence Gate", { grid: ["SPS", "SPS"], key: { S: "Stick", P: "Planks" }, aliases: "gate" });
  R("Door", { grid: ["PP", "PP", "PP"], key: { P: "Planks" }, makes: 3, aliases: "wooden door|oak door|doors" });
  R("Iron Door", { grid: ["II", "II", "II"], key: { I: "Iron Ingot" }, makes: 3, info: "Only opens with redstone (a button, lever or pressure plate). Zombies can't break it." });
  R("Trapdoor", { grid: ["PPP", "PPP"], key: { P: "Planks" }, makes: 2, aliases: "wooden trapdoor|trap door" });
  R("Iron Trapdoor", { grid: ["II", "II"], key: { I: "Iron Ingot" } });
  R("Sign", { grid: ["PPP", "PPP", " S "], key: { P: "Planks", S: "Stick" }, makes: 3, aliases: "signs|wooden sign" });
  R("Hanging Sign", { grid: ["C C", "LLL", "LLL"], key: { C: "Chain", L: "Stripped Log" }, makes: 6 });
  R("Boat", { grid: ["P P", "PPP"], key: { P: "Planks" }, aliases: "boats|oak boat", info: "Fast on water, and mobs that get in can't get out." });
  R("Boat with Chest", { shapeless: ["Boat", "Chest"], aliases: "chest boat" });
  R("Bowl", { grid: ["P P", " P "], key: { P: "Planks" }, makes: 4, aliases: "bowls" });
  R("Slab", { grid: ["BBB"], key: { B: "Block (planks, stone...)" }, makes: 6, aliases: "slabs|half slab|wooden slab|stone slab" });
  R("Stairs", { grid: ["B  ", "BB ", "BBB"], key: { B: "Block (planks, stone...)" }, makes: 4, aliases: "stair|staircase" });
  R("Wall", { grid: ["BBB", "BBB"], key: { B: "Cobblestone, bricks..." }, makes: 6, aliases: "walls|cobblestone wall" });
  R("Glass Pane", { grid: ["GGG", "GGG"], key: { G: "Glass" }, makes: 16, aliases: "glass panes|window" });
  R("Iron Bars", { grid: ["III", "III"], key: { I: "Iron Ingot" }, makes: 16 });
  R("Chain", { grid: ["N", "I", "N"], key: { N: "Iron Nugget", I: "Iron Ingot" } });
  R("Paper", { grid: ["SSS"], key: { S: "Sugar Cane" }, makes: 3 });
  R("Book", { shapeless: ["Paper", "Paper", "Paper", "Leather"], aliases: "books" });
  R("Leather", { grid: ["RR", "RR"], key: { R: "Rabbit Hide" }, aliases: "leathers", info: "Mostly from cows, but 4 rabbit hide also make one." });
  R("Book and Quill", { shapeless: ["Book", "Ink Sac", "Feather"], aliases: "writable book|book & quill|quill" });
  R("Bookshelf", { grid: ["PPP", "BBB", "PPP"], key: { P: "Planks", B: "Book" }, aliases: "bookshelves|book shelf",
    info: "Put 15 bookshelves around an enchanting table (one block gap) to unlock level-30 enchantments." });
  R("Chiseled Bookshelf", { grid: ["PPP", "SSS", "PPP"], key: { P: "Planks", S: "Wooden Slab" } });
  R("Item Frame", { grid: ["SSS", "SLS", "SSS"], key: { S: "Stick", L: "Leather" } });
  R("Glow Item Frame", { shapeless: ["Item Frame", "Glow Ink Sac"] });
  R("Painting", { grid: ["SSS", "SWS", "SSS"], key: { S: "Stick", W: "Wool" } });
  R("Flower Pot", { grid: ["B B", " B "], key: { B: "Brick" } });
  R("Armor Stand", { grid: ["SSS", " S ", "SLS"], key: { S: "Stick", L: "Smooth Stone Slab" } });
  R("Scaffolding", { grid: ["BTB", "B B", "B B"], key: { B: "Bamboo", T: "String" }, makes: 6 });
  R("Jukebox", { grid: ["PPP", "PDP", "PPP"], key: { P: "Planks", D: "Diamond" }, info: "Plays music discs." });
  R("Note Block", { grid: ["PPP", "PRP", "PPP"], key: { P: "Planks", R: "Redstone Dust" }, aliases: "noteblock" });
  R("Composter", { grid: ["S S", "S S", "SSS"], key: { S: "Wooden Slab" }, info: "Turns plant stuff into bone meal." });
  R("Beehive", { grid: ["PPP", "HHH", "PPP"], key: { P: "Planks", H: "Honeycomb" } });
  R("Candle", { grid: ["S", "H"], key: { S: "String", H: "Honeycomb" }, aliases: "candles" });
  R("Bundle", { grid: ["S", "L"], key: { S: "String", L: "Leather" }, info: "Holds a stack's worth of mixed items (craftable since 1.21.2)." });

  // ---------- workstations ----------
  R("Enchanting Table", { grid: [" B ", "DOD", "OOO"], key: { B: "Book", D: "Diamond", O: "Obsidian" }, aliases: "enchantment table|enchant table|enchanting tabel",
    info: "Spend XP levels and lapis lazuli to enchant gear. For level 30 enchants, place 15 bookshelves around it with a one-block air gap between them and the table." });
  R("Anvil", { grid: ["BBB", " I ", "III"], key: { B: "Block of Iron", I: "Iron Ingot" }, info: "Repair, rename and combine enchanted items (costs XP)." });
  R("Grindstone", { grid: ["SLS", "P P"], key: { S: "Stick", L: "Stone Slab", P: "Planks" }, info: "Removes enchantments (and gives some XP back) and repairs items." });
  R("Smithing Table", { grid: ["II", "PP", "PP"], key: { I: "Iron Ingot", P: "Planks" }, info: "Upgrades diamond gear to netherite and adds armor trims." });
  R("Brewing Stand", { grid: [" B ", "CCC"], key: { B: "Blaze Rod", C: "Cobblestone" }, aliases: "brewing station|potion stand", info: "Brews potions. Fuel it with blaze powder." });
  R("Cauldron", { grid: ["I I", "I I", "III"], key: { I: "Iron Ingot" } });
  R("Stonecutter", { grid: [" I ", "SSS"], key: { I: "Iron Ingot", S: "Stone" }, info: "Cuts stone blocks into stairs, slabs and walls with no waste." });
  R("Loom", { grid: ["SS", "PP"], key: { S: "String", P: "Planks" } });
  R("Cartography Table", { grid: ["pp", "PP", "PP"], key: { p: "Paper", P: "Planks" } });
  R("Fletching Table", { grid: ["FF", "PP", "PP"], key: { F: "Flint", P: "Planks" } });
  R("Smoker", { grid: [" L ", "LFL", " L "], key: { L: "Log", F: "Furnace" }, info: "Cooks food twice as fast as a furnace." });
  R("Blast Furnace", { grid: ["III", "IFI", "SSS"], key: { I: "Iron Ingot", F: "Furnace", S: "Smooth Stone" }, info: "Smelts ores twice as fast as a furnace." });
  R("Lectern", { grid: ["SSS", " B ", " S "], key: { S: "Wooden Slab", B: "Bookshelf" }, info: "Gives a villager the librarian job. Librarians can sell Mending!" });
  R("Crafter", { grid: ["III", "ICI", "RDR"], key: { I: "Iron Ingot", C: "Crafting Table", R: "Redstone Dust", D: "Dropper" }, info: "A redstone-powered auto crafter (1.21)." });

  // ---------- tools, weapons, armor (generated) ----------
  const MATS = [
    ["Wooden", "Planks", "wood|wooden|wood planks", 59],
    ["Stone", "Cobblestone", "stone|cobblestone|cobble", 131],
    ["Iron", "Iron Ingot", "iron", 250],
    ["Golden", "Gold Ingot", "gold|golden", 32],
    ["Diamond", "Diamond", "diamond|diamonds", 1561],
  ];
  const TOOLS = {
    Pickaxe: { grid: ["MMM", " S ", " S "], aliases: "pick|pickax|pick axe|pikaxe|pickaxes" },
    Axe: { grid: ["MM", "MS", " S"], aliases: "axes|hatchet" },
    Shovel: { grid: ["M", "S", "S"], aliases: "spade|shovels" },
    Hoe: { grid: ["MM", " S", " S"], aliases: "hoes" },
    Sword: { grid: ["M", "M", "S"], aliases: "swords|blade" },
  };
  for (const [mat, ing, matAliases, dur] of MATS) {
    for (const [tool, t] of Object.entries(TOOLS)) {
      const al = [];
      for (const ma of matAliases.split("|")) for (const ta of [tool.toLowerCase()].concat(t.aliases.split("|"))) al.push(ma + " " + ta);
      R(mat + " " + tool, { grid: t.grid, key: { M: ing, S: "Stick" }, aliases: al.join("|"), family: tool, material: mat, durability: dur,
        note: mat === "Stone" ? "Blackstone or cobbled deepslate work too." : mat === "Wooden" ? "Any planks work." : undefined });
    }
  }
  const ARMOR = {
    Helmet: { grid: ["MMM", "M M"], aliases: "helmets|helm|cap|hat" },
    Chestplate: { grid: ["M M", "MMM", "MMM"], aliases: "chest plate|chestplates|chestpiece|tunic|body armor" },
    Leggings: { grid: ["MMM", "M M", "M M"], aliases: "legs|pants|leggins|legging" },
    Boots: { grid: ["M M", "M M"], aliases: "boot|shoes" },
  };
  const AMATS = [["Leather", "Leather", "leather"], ["Iron", "Iron Ingot", "iron"], ["Golden", "Gold Ingot", "gold|golden"], ["Diamond", "Diamond", "diamond"]];
  for (const [mat, ing, matAliases] of AMATS) {
    for (const [piece, a] of Object.entries(ARMOR)) {
      const al = [];
      for (const ma of matAliases.split("|")) for (const pa of [piece.toLowerCase()].concat(a.aliases.split("|"))) al.push(ma + " " + pa);
      R(mat + " " + piece, { grid: a.grid, key: { M: ing }, aliases: al.join("|"), family: piece, material: mat });
    }
  }
  for (const thing of ["Pickaxe", "Axe", "Shovel", "Hoe", "Sword", "Helmet", "Chestplate", "Leggings", "Boots"]) {
    R("Netherite " + thing, { smithing: ["Netherite Upgrade Smithing Template", "Diamond " + thing, "Netherite Ingot"], family: thing, material: "Netherite",
      aliases: "netherite " + thing.toLowerCase(), info: "Netherite gear is the strongest, and it doesn't burn in lava." });
  }
  for (const piece of Object.keys(ARMOR)) R("Chainmail " + piece, { how: "Chainmail armor can't be crafted. Get it from mobs that drop their armor, from chests, or by trading with an armorer villager.", family: piece, material: "Chainmail", aliases: "chain " + piece.toLowerCase() + "|chainmail " + piece.toLowerCase() });
  R("Turtle Shell", { grid: ["SSS", "S S"], key: { S: "Turtle Scute" }, aliases: "turtle helmet", info: "A helmet that gives you extra water breathing time." });
  R("Leather Horse Armor", { grid: ["L L", "LLL", "L L"], key: { L: "Leather" } });
  R("Wolf Armor", { grid: ["S  ", "SSS", "S S"], key: { S: "Armadillo Scute" }, aliases: "dog armor|armor for dogs|armor for my dog|armor for a dog|armor for your dog|dog armour|wolf armour", info: "It was added in 1.20.5, and your tamed wolf takes much less damage while wearing it. Brush armadillos (in savannas and badlands) to get scutes." });

  // ---------- combat ----------
  R("Bow", { grid: [" ST", "S T", " ST"], key: { S: "Stick", T: "String" }, aliases: "bows" });
  R("Arrow", { grid: ["F", "S", "E"], key: { F: "Flint", S: "Stick", E: "Feather" }, makes: 4, aliases: "arrows" });
  R("Spectral Arrow", { grid: [" G ", "GAG", " G "], key: { G: "Glowstone Dust", A: "Arrow" }, makes: 2 });
  R("Tipped Arrow", { grid: ["AAA", "ALA", "AAA"], key: { A: "Arrow", L: "Lingering Potion" }, makes: 8, aliases: "potion arrow" });
  R("Crossbow", { grid: ["SIS", "THT", " S "], key: { S: "Stick", I: "Iron Ingot", T: "String", H: "Tripwire Hook" }, aliases: "cross bow" });
  R("Shield", { grid: ["PIP", "PPP", " P "], key: { P: "Planks", I: "Iron Ingot" }, aliases: "shields|sheild", info: "Hold right-click (or the use button) to block attacks. Axes can disable it for a few seconds." });
  R("Mace", { grid: ["H", "B"], key: { H: "Heavy Core", B: "Breeze Rod" }, info: "Hits harder the farther you fall before striking. Heavy cores come from ominous vaults in trial chambers." });
  R("Wind Charge", { shapeless: ["Breeze Rod"], makes: 4, info: "Throw it to launch yourself or push mobs." });
  R("TNT", { grid: ["GSG", "SGS", "GSG"], key: { G: "Gunpowder", S: "Sand" }, aliases: "tnt block|dynamite|explosive" });
  R("Trident", { how: "Tridents can't be crafted. Drowned (underwater zombies) sometimes carry one; kill them and hope it drops (about 8.5% chance, a bit more with Looting)." });

  // ---------- utility ----------
  R("Bucket", { grid: ["I I", " I "], key: { I: "Iron Ingot" }, aliases: "buckets|pail|water bucket|lava bucket|milk bucket", info: "Carries water, lava, milk, powder snow or fish. Use it on a cow for milk." });
  R("Shears", { grid: [" I", "I "], key: { I: "Iron Ingot" }, aliases: "scissors", info: "Shears sheep for wool without hurting them, and collects leaves and cobwebs." });
  R("Flint and Steel", { shapeless: ["Iron Ingot", "Flint"], aliases: "lighter|flint & steel|flint n steel", info: "Lights fires, TNT and Nether portals." });
  R("Compass", { grid: [" I ", "IRI", " I "], key: { I: "Iron Ingot", R: "Redstone Dust" }, info: "Points to your world spawn (or to a lodestone)." });
  R("Recovery Compass", { grid: ["EEE", "ECE", "EEE"], key: { E: "Echo Shard", C: "Compass" }, info: "Points to where you last died. Echo shards come from ancient city chests." });
  R("Clock", { grid: [" G ", "GRG", " G "], key: { G: "Gold Ingot", R: "Redstone Dust" }, aliases: "watch" });
  R("Map", { grid: ["PPP", "PCP", "PPP"], key: { P: "Paper", C: "Compass" }, aliases: "empty map|maps", info: "Right-click to draw the area around you." });
  R("Fishing Rod", { grid: ["  S", " ST", "S T"], key: { S: "Stick", T: "String" }, aliases: "fishing pole|rod" });
  R("Carrot on a Stick", { shapeless: ["Fishing Rod", "Carrot"], info: "Steers a pig you ride with a saddle." });
  R("Lead", { grid: ["TT ", "TB ", "  T"], key: { T: "String", B: "Slimeball" }, makes: 2, aliases: "leash|rope" });
  R("Glass Bottle", { grid: ["G G", " G "], key: { G: "Glass" }, makes: 3, aliases: "bottle|water bottle" });
  R("Spyglass", { grid: ["A", "C", "C"], key: { A: "Amethyst Shard", C: "Copper Ingot" }, aliases: "telescope|binoculars" });
  R("Brush", { grid: ["F", "C", "S"], key: { F: "Feather", C: "Copper Ingot", S: "Stick" }, info: "Brushes suspicious sand/gravel for archaeology loot, and brushes armadillos for scutes." });
  R("Lightning Rod", { grid: ["C", "C", "C"], key: { C: "Copper Ingot" } });
  R("Tinted Glass", { grid: [" A ", "AGA", " A "], key: { A: "Amethyst Shard", G: "Glass" }, makes: 2 });
  R("Beacon", { grid: ["GGG", "GNG", "OOO"], key: { G: "Glass", N: "Nether Star", O: "Obsidian" },
    info: "Place it on a pyramid of iron, gold, emerald, diamond or netherite blocks (9 blocks for level 1, up to 164 for level 4). Gives speed, haste, strength and more." });
  R("Conduit", { grid: ["NNN", "NHN", "NNN"], key: { N: "Nautilus Shell", H: "Heart of the Sea" }, info: "Underwater beacon: gives water breathing and night vision in a prismarine frame." });
  R("Ender Chest", { grid: ["OOO", "OEO", "OOO"], key: { O: "Obsidian", E: "Eye of Ender" }, info: "Every ender chest shares one private inventory, anywhere in the world." });
  R("Eye of Ender", { shapeless: ["Ender Pearl", "Blaze Powder"], aliases: "ender eye|eyes of ender|eye of the ender|ender eyes",
    info: "Throw it and it flies toward the nearest stronghold. You need up to 12 to fill the End portal." });
  R("End Crystal", { grid: ["GGG", "GEG", "GTG"], key: { G: "Glass", E: "Eye of Ender", T: "Ghast Tear" }, info: "Heals the Ender Dragon, and four of them on the exit portal respawn it." });
  R("Respawn Anchor", { grid: ["CCC", "GGG", "CCC"], key: { C: "Crying Obsidian", G: "Glowstone" }, info: "Lets you set your spawn in the Nether. Charge it with glowstone. It explodes in the Overworld!" });
  R("Shulker Box", { grid: ["S", "C", "S"], key: { S: "Shulker Shell", C: "Chest" }, info: "A box that keeps its items when you break it. Shulkers live in End cities." });
  R("End Rod", { grid: ["B", "C"], key: { B: "Blaze Rod", C: "Popped Chorus Fruit" }, makes: 4 });
  R("Firework Rocket", { shapeless: ["Paper", "Gunpowder"], makes: 3, aliases: "fireworks|firework|rocket|rockets", info: "Add 1-3 gunpowder for longer flight. Use them to boost while flying an elytra." });
  R("Netherite Ingot", { shapeless: ["Netherite Scrap", "Netherite Scrap", "Netherite Scrap", "Netherite Scrap", "Gold Ingot", "Gold Ingot", "Gold Ingot", "Gold Ingot"], aliases: "netherite",
    info: "Smelt ancient debris into netherite scrap first. Ancient debris is found in the Nether, best around Y=15." });
  R("Netherite Upgrade Smithing Template", { grid: ["DTD", "DND", "DDD"], key: { D: "Diamond", T: "Netherite Upgrade Smithing Template", N: "Netherrack" }, makes: 2,
    aliases: "netherite upgrade|smithing template|netherite template|upgrade template", info: "Find the first one in bastion remnant chests; this recipe copies it." });
  R("Iron Nugget", { shapeless: ["Iron Ingot"], makes: 9, aliases: "iron nuggets" });
  R("Gold Nugget", { shapeless: ["Gold Ingot"], makes: 9, aliases: "gold nuggets", info: "Also dropped by zombified piglins." });
  for (const [blk, it] of [["Block of Iron", "Iron Ingot"], ["Block of Gold", "Gold Ingot"], ["Block of Diamond", "Diamond"], ["Block of Emerald", "Emerald"],
    ["Block of Redstone", "Redstone Dust"], ["Block of Coal", "Coal"], ["Lapis Lazuli Block", "Lapis Lazuli"], ["Block of Netherite", "Netherite Ingot"],
    ["Block of Copper", "Copper Ingot"], ["Hay Bale", "Wheat"], ["Slime Block", "Slimeball"], ["Bone Block", "Bone Meal"], ["Dried Kelp Block", "Dried Kelp"],
    ["Melon", "Melon Slice"], ["Packed Ice", "Ice"], ["Blue Ice", "Packed Ice"]]) {
    const w = blk.replace("Block of ", "").toLowerCase();
    R(blk, { grid: ["XXX", "XXX", "XXX"], key: { X: it }, aliases: w + " block|block of " + w + "|" + w + " blocks" });
  }
  R("Honey Block", { grid: ["HH", "HH"], key: { H: "Honey Bottle" } });
  R("Bone Meal", { shapeless: ["Bone"], makes: 3, aliases: "bonemeal|fertilizer", info: "Makes crops and saplings grow instantly." });
  R("Blaze Powder", { shapeless: ["Blaze Rod"], makes: 2, info: "Fuel for the brewing stand, and used for eyes of ender." });
  R("Fire Charge", { shapeless: ["Gunpowder", "Blaze Powder", "Coal or Charcoal"], makes: 3 });
  R("Magma Cream", { shapeless: ["Slimeball", "Blaze Powder"] });
  R("Fermented Spider Eye", { shapeless: ["Spider Eye", "Brown Mushroom", "Sugar"] });
  R("Glistering Melon Slice", { grid: ["NNN", "NMN", "NNN"], key: { N: "Gold Nugget", M: "Melon Slice" }, aliases: "glistering melon|golden melon|shiny melon" });
  R("Sugar", { shapeless: ["Sugar Cane"], info: "Also: a honey bottle gives 3 sugar." });

  // ---------- redstone & rails ----------
  R("Redstone Torch", { grid: ["R", "S"], key: { R: "Redstone Dust", S: "Stick" } });
  R("Lever", { grid: ["S", "C"], key: { S: "Stick", C: "Cobblestone" }, aliases: "switch" });
  R("Button", { shapeless: ["Stone or Planks"], aliases: "buttons|stone button|wooden button" });
  R("Pressure Plate", { grid: ["BB"], key: { B: "Stone or Planks" }, aliases: "pressure plates|stone pressure plate" });
  R("Repeater", { grid: ["TRT", "SSS"], key: { T: "Redstone Torch", R: "Redstone Dust", S: "Stone" }, aliases: "redstone repeater|repeaters", info: "Refreshes a signal to strength 15, adds a delay and only lets signal go one way." });
  R("Comparator", { grid: [" T ", "TQT", "SSS"], key: { T: "Redstone Torch", Q: "Nether Quartz", S: "Stone" }, aliases: "redstone comparator", info: "Compares or subtracts signals, and reads how full a container is." });
  R("Piston", { grid: ["PPP", "CIC", "CRC"], key: { P: "Planks", C: "Cobblestone", I: "Iron Ingot", R: "Redstone Dust" }, aliases: "pistons|piston block" });
  R("Sticky Piston", { grid: ["S", "P"], key: { S: "Slimeball", P: "Piston" }, info: "Pulls the block back when it retracts." });
  R("Observer", { grid: ["CCC", "RRQ", "CCC"], key: { C: "Cobblestone", R: "Redstone Dust", Q: "Nether Quartz" }, info: "Sends a pulse when the block in front of its face changes." });
  R("Dispenser", { grid: ["CCC", "CBC", "CRC"], key: { C: "Cobblestone", B: "Bow", R: "Redstone Dust" }, info: "Shoots arrows, places water/lava, uses items." });
  R("Dropper", { grid: ["CCC", "C C", "CRC"], key: { C: "Cobblestone", R: "Redstone Dust" } });
  R("Hopper", { grid: ["I I", "ICI", " I "], key: { I: "Iron Ingot", C: "Chest" }, aliases: "hoppers", info: "Moves items into the container it points at. Great for auto-smelters and farms." });
  R("Daylight Detector", { grid: ["GGG", "QQQ", "SSS"], key: { G: "Glass", Q: "Nether Quartz", S: "Wooden Slab" }, aliases: "daylight sensor" });
  R("Redstone Lamp", { grid: [" R ", "RGR", " R "], key: { R: "Redstone Dust", G: "Glowstone" } });
  R("Target", { grid: [" R ", "RHR", " R "], key: { R: "Redstone Dust", H: "Hay Bale" }, aliases: "target block" });
  R("Tripwire Hook", { grid: ["I", "S", "P"], key: { I: "Iron Ingot", S: "Stick", P: "Planks" }, makes: 2, aliases: "tripwire" });
  R("Rail", { grid: ["I I", "ISI", "I I"], key: { I: "Iron Ingot", S: "Stick" }, makes: 16, aliases: "rails|tracks|minecart track" });
  R("Powered Rail", { grid: ["G G", "GSG", "GRG"], key: { G: "Gold Ingot", S: "Stick", R: "Redstone Dust" }, makes: 6, aliases: "booster rail|powered rails|golden rail" });
  R("Detector Rail", { grid: ["I I", "IPI", "IRI"], key: { I: "Iron Ingot", P: "Stone Pressure Plate", R: "Redstone Dust" }, makes: 6 });
  R("Activator Rail", { grid: ["ISI", "ITI", "ISI"], key: { I: "Iron Ingot", S: "Stick", T: "Redstone Torch" }, makes: 6 });
  R("Minecart", { grid: ["I I", "III"], key: { I: "Iron Ingot" }, aliases: "mine cart|minecarts|cart" });
  R("Minecart with Chest", { shapeless: ["Minecart", "Chest"], aliases: "chest minecart|storage minecart" });
  R("Minecart with Hopper", { shapeless: ["Minecart", "Hopper"], aliases: "hopper minecart" });
  R("Minecart with TNT", { shapeless: ["Minecart", "TNT"], aliases: "tnt minecart" });
  R("Minecart with Furnace", { shapeless: ["Minecart", "Furnace"], aliases: "furnace minecart" });

  // ---------- food ----------
  R("Bread", { grid: ["WWW"], key: { W: "Wheat" } });
  R("Cake", { grid: ["MMM", "SES", "WWW"], key: { M: "Milk Bucket", S: "Sugar", E: "Egg", W: "Wheat" }, info: "Place it and eat it one slice at a time. You get your buckets back!" });
  R("Cookie", { grid: ["WCW"], key: { W: "Wheat", C: "Cocoa Beans" }, makes: 8, aliases: "cookies", info: "Never feed cookies to parrots, it's poisonous for them." });
  R("Pumpkin Pie", { shapeless: ["Pumpkin", "Sugar", "Egg"] });
  R("Mushroom Stew", { shapeless: ["Bowl", "Red Mushroom", "Brown Mushroom"], aliases: "mushroom soup" });
  R("Beetroot Soup", { shapeless: ["Bowl", "Beetroot", "Beetroot", "Beetroot", "Beetroot", "Beetroot", "Beetroot"] });
  R("Rabbit Stew", { shapeless: ["Bowl", "Cooked Rabbit", "Carrot", "Baked Potato", "Mushroom"] });
  R("Golden Apple", { grid: ["GGG", "GAG", "GGG"], key: { G: "Gold Ingot", A: "Apple" }, aliases: "gapple|gold apple", info: "Gives Regeneration II and Absorption. Also cures zombie villagers (with Weakness)." });
  R("Enchanted Golden Apple", { how: "The enchanted golden apple (notch apple) can't be crafted anymore. Find it in chests: dungeons, mineshafts, desert temples, bastions, ancient cities.", aliases: "notch apple|god apple|enchanted gapple" });
  R("Golden Carrot", { grid: ["NNN", "NCN", "NNN"], key: { N: "Gold Nugget", C: "Carrot" }, info: "One of the best foods for saturation, and used for Night Vision potions." });
  R("Honey Bottle", { shapeless: ["Honey Block", "Glass Bottle", "Glass Bottle", "Glass Bottle", "Glass Bottle"], makes: 4, info: "Or use a glass bottle on a full beehive (put a campfire under it first). Cures poison." });

  // ---------- blocks ----------
  R("Stone Bricks", { grid: ["SS", "SS"], key: { S: "Stone" }, makes: 4, aliases: "stone brick|stonebrick" });
  R("Chiseled Stone Bricks", { grid: ["S", "S"], key: { S: "Stone Brick Slab" } });
  R("Mossy Cobblestone", { shapeless: ["Cobblestone", "Vine or Moss Block"] });
  R("Sandstone", { grid: ["SS", "SS"], key: { S: "Sand" } });
  R("Bricks", { grid: ["BB", "BB"], key: { B: "Brick" }, aliases: "brick block" });
  R("Wool", { grid: ["SS", "SS"], key: { S: "String" }, aliases: "white wool|wools", info: "Or just shear a sheep (1-3 wool)." });
  R("Snow Block", { grid: ["SS", "SS"], key: { S: "Snowball" } });
  R("Clay", { grid: ["CC", "CC"], key: { C: "Clay Ball" }, aliases: "clay block" });
  R("Glowstone", { grid: ["GG", "GG"], key: { G: "Glowstone Dust" }, aliases: "glowstone block|glow stone" });
  R("Block of Quartz", { grid: ["QQ", "QQ"], key: { Q: "Nether Quartz" }, aliases: "quartz block" });
  R("Coarse Dirt", { grid: ["DG", "GD"], key: { D: "Dirt", G: "Gravel" }, makes: 4 });
  R("Concrete Powder", { shapeless: ["Sand", "Sand", "Sand", "Sand", "Gravel", "Gravel", "Gravel", "Gravel", "Dye"], makes: 8, info: "Touch it with water and it becomes solid concrete." });
  R("Concrete", { how: "Craft concrete powder (4 sand + 4 gravel + 1 dye), place it, and let water touch it. It turns into concrete.", aliases: "concrete block" });
  R("Purpur Block", { grid: ["PP", "PP"], key: { P: "Popped Chorus Fruit" }, makes: 4 });
  R("Iron Golem", { how: "Build it: put 4 blocks of iron in a T shape, then a carved pumpkin on top (put the pumpkin last).", aliases: "golem|iron golems" });
  R("Snow Golem", { how: "Stack 2 snow blocks and put a carved pumpkin on top. It throws snowballs at mobs.", aliases: "snowman|snow man" });
  R("Wither", { how: "Place 4 soul sand (or soul soil) in a T shape and put 3 wither skeleton skulls on top. Do it far from your base, it's a tough boss!", aliases: "the wither|wither boss" });
  R("Nether Portal", { how: "Build an obsidian frame at least 4 wide and 5 tall (the corners are optional, so 10 obsidian is enough) and light the inside with flint and steel.", aliases: "portal|nether portal frame|portal to the nether" });

  // ---------- raw materials: how to get them ----------
  const HOW = {
    "Log": ["Punch or chop trees. Any tree gives logs.", "logs|wood|tree|trees|oak log|oak wood"],
    "Cobblestone": ["Mine stone with any pickaxe.", "cobble|cobble stone|stone"],
    "Iron Ingot": ["Mine iron ore (stone pickaxe or better) and smelt the raw iron in a furnace. Iron golems drop it too.", "iron|iron ingots|irons"],
    "Gold Ingot": ["Mine gold ore with an iron pickaxe or better and smelt the raw gold. Badlands have lots of gold. Nether gold ore drops nuggets.", "gold|gold ingots"],
    "Diamond": ["Mine diamond ore with an iron pickaxe or better. Best height: around Y=-59 (deep in the deepslate layer). Fortune III gives more.", "diamonds|dimond|diamons|diamond ore"],
    "Emerald": ["Found as emerald ore only in mountain biomes (higher is better), or trade with villagers.", "emeralds|emerald ore"],
    "Redstone Dust": ["Mine redstone ore (iron pickaxe or better). It's most common near the bottom of the world, around Y=-59.", "redstone|red stone|redstone ore"],
    "Coal": ["Mine coal ore, very common in stone (best around Y=95). Or smelt logs into charcoal, which works the same.", "coal ore|coals"],
    "Lapis Lazuli": ["Mine lapis ore with a stone pickaxe or better, best around Y=0.", "lapis|lapis ore"],
    "Copper Ingot": ["Mine copper ore (best around Y=48, lots in dripstone caves) and smelt raw copper.", "copper|copper ore"],
    "Netherite Scrap": ["Find ancient debris in the Nether (best around Y=15, mine it with a diamond pickaxe), then smelt it in a furnace: each debris gives 1 netherite scrap.", "netherite scrap"],
    "Netherite Ingot": ["Mine ancient debris in the Nether (best around Y=15, bring a diamond pickaxe), smelt it into netherite scrap, then craft 4 scrap + 4 gold ingots into one netherite ingot.", "netherite"],
    "Obsidian": ["Pour water onto a lava source block, then mine it with a diamond (or netherite) pickaxe. It takes a while!", "obsidian block"],
    "String": ["Kill spiders, break cobwebs (a sword is fastest), or go fishing.", "strings|thread"],
    "Leather": ["Kill cows, mooshrooms, horses, donkeys, mules, llamas or hoglins. You can also craft it from 4 rabbit hide (a 2x2 square), or catch it while fishing.", "leathers"],
    "Feather": ["Kill chickens.", "feathers"],
    "Flint": ["Break gravel. It sometimes drops flint instead (10%).", "flints"],
    "Gunpowder": ["Kill creepers (from a distance!), ghasts or witches. Also found in chests.", "gun powder|sulfur"],
    "Sand": ["Found on beaches, rivers and deserts. Dig it with a shovel.", "sand block"],
    "Glass": ["Smelt sand in a furnace.", "glass block"],
    "Stone": ["Mine stone with a Silk Touch pickaxe, or smelt cobblestone.", "smooth stone"],
    "Smooth Stone": ["Smelt stone (smelt cobblestone once to get stone, then again for smooth stone).", "smoothstone"],
    "Charcoal": ["Smelt logs in a furnace. Works just like coal.", "char coal"],
    "Brick": ["Smelt clay balls in a furnace.", "bricks item|clay brick"],
    "Clay Ball": ["Dig clay blocks, usually found under shallow water in rivers, swamps and lush caves.", "clay balls"],
    "Sugar Cane": ["Grows next to water on sand, dirt or grass. Break the top part and leave the bottom block so it regrows.", "sugarcane|sugar canes|reeds"],
    "Wheat": ["Farm it! Hoe dirt near water, plant wheat seeds (from breaking grass) and harvest when it's golden.", "wheat crop"],
    "Blaze Rod": ["Kill blazes in Nether fortresses. Bring fire resistance or snowballs.", "blaze rods"],
    "Ender Pearl": ["Kill endermen (don't look them in the eyes, or wear a carved pumpkin). Cleric villagers also sell them.", "ender pearls|enderpearl|pearl"],
    "Slimeball": ["Kill slimes: they spawn in swamps at night, and underground in slime chunks (below Y=40). Baby pandas also sometimes sneeze one out!", "slime ball|slimeballs|slime"],
    "Bone": ["Kill skeletons.", "bones"],
    "Spider Eye": ["Kill spiders or cave spiders, or witches.", "spider eyes"],
    "Ghast Tear": ["Kill ghasts in the Nether. Try to kill them over land so the tear doesn't fall in lava.", "ghast tears"],
    "Nether Star": ["Defeat the Wither boss.", "netherstar"],
    "Nether Wart": ["Grows in Nether fortresses on soul sand. Plant it on soul sand to farm it.", "netherwart"],
    "Nether Quartz": ["Mine nether quartz ore in the Nether.", "quartz"],
    "Glowstone Dust": ["Break glowstone blocks on Nether ceilings, or kill witches.", "glowstone dust"],
    "Shulker Shell": ["Kill shulkers in End cities.", "shulker shells"],
    "Elytra": ["Found in End ships next to End cities (the outer End islands).", "elytras|wings|glider"],
    "Totem of Undying": ["Kill evokers (woodland mansions and raids) to get one.", "totem|totems"],
    "Saddle": ["Found in dungeon, temple, village and Nether fortress chests, by fishing, or bought from leatherworker villagers. (The newest versions may also let you craft one.)", "saddles"],
    "Name Tag": ["Found in dungeon/mineshaft chests, by fishing, or bought from librarian villagers. Rename it on an anvil, then use it on a mob.", "nametag|name tags"],
    "Heart of the Sea": ["Found in buried treasure chests. Treasure maps come from shipwrecks and ocean ruins.", "heart of sea"],
    "Nautilus Shell": ["Fish them up, get them from drowned, or trade with wandering traders.", "nautilus shells"],
    "Honeycomb": ["Use shears on a full beehive or bee nest (put a campfire under it so the bees stay calm).", "honey comb"],
    "Amethyst Shard": ["Break amethyst clusters in amethyst geodes (underground).", "amethyst|amethyst shards"],
    "Echo Shard": ["Found in chests in ancient cities (the deep dark). Watch out for the Warden!", "echo shards"],
    "Heavy Core": ["Found in ominous vaults in trial chambers (use an ominous trial key).", "heavy cores"],
    "Breeze Rod": ["Kill breezes in trial chambers.", "breeze rods"],
    "Armadillo Scute": ["Brush an armadillo, or wait for it to drop one. Armadillos live in savannas and badlands.", "scute|scutes"],
    "Turtle Scute": ["Baby turtles drop one when they grow up.", "turtle scutes"],
    "Ink Sac": ["Kill squids.", "ink sacs|ink"],
    "Cocoa Beans": ["Found on jungle trees, and you can farm them on jungle logs.", "cocoa|cocoa bean"],
    "Egg": ["Chickens lay them. Throw eggs for a chance to spawn a chick.", "eggs"],
    "Milk Bucket": ["Use an empty bucket on a cow, goat or mooshroom. Drinking it removes all effects.", "milk"],
    "Carved Pumpkin": ["Use shears on a pumpkin. You can wear it so endermen don't get angry.", "jack o lantern|carved pumpkins"],
    "Popped Chorus Fruit": ["Smelt chorus fruit, which grows on chorus plants in the outer End.", "chorus fruit"],
    "Crying Obsidian": ["Found in ruined portals and bastions, and piglins trade it.", "crying obsidan"],
    "Soul Sand": ["Found in soul sand valleys and Nether fortresses.", "soulsand|soul soil"],
    "Apple": ["Break oak or dark oak leaves.", "apples"],
    "Bamboo": ["Grows in jungles and bamboo jungles. Pandas love it.", "bamboos"],
    "Honey Bottle": ["Use a glass bottle on a full beehive.", "honey"],
  };
  for (const [name, [how, aliases]] of Object.entries(HOW)) {
    const ex = items.find((i) => i.name === name);
    if (ex) { ex.how = ex.how || how; ex.aliases = (ex.aliases ? ex.aliases + "|" : "") + aliases; }
    else R(name, { how, aliases, raw: true });
  }

  // short descriptions for things you find rather than craft
  const INFO = {
    "Elytra": "Wings that let you glide through the air! Boost with firework rockets to fly.",
    "Totem of Undying": "Hold it and it saves you from dying once, with a burst of healing.",
    "Trident": "A magic fork you can throw and use in melee. With Riptide it launches you, with Channeling it calls lightning.",
    "Heart of the Sea": "A rare treasure used to craft a conduit.",
    "Nether Star": "Dropped by the Wither. Used to craft a beacon.",
    "Enchanted Golden Apple": "The most powerful food: Regeneration, Absorption, Resistance and Fire Resistance.",
    "Saddle": "Lets you ride horses, pigs, striders and camels.",
    "Name Tag": "Rename a mob so it never despawns. Name a sheep jeb_ for a rainbow sheep!",
    "Obsidian": "Super tough purple-black block used for Nether portals, enchanting tables and beacons. Nothing but a diamond pickaxe mines it.",
    "Diamond": "The famous blue gem used for the best tools and armor before netherite.",
    "Emerald": "Villagers' money! Trade emeralds for tools, food, enchanted books and more.",
    "Echo Shard": "A shard from ancient cities, used for the recovery compass.",
    "Heavy Core": "The heavy center of the mace, found in ominous vaults.",
    "Ender Pearl": "Throw it to teleport to where it lands (costs a bit of health).",
    "Blaze Rod": "Used for brewing stands and blaze powder. Only blazes drop it.",
    "Slimeball": "Sticky stuff for sticky pistons, leads and slime blocks.",
    "Gunpowder": "Used for TNT, fire charges, firework rockets and splash potions.",
  };
  for (const [name, info] of Object.entries(INFO)) { const ex = items.find((i) => i.name === name); if (ex && !ex.info) ex.info = info; }

  // ---------- smelting ----------
  const SMELT = [
    ["Iron Ingot", "Raw Iron or Iron Ore"], ["Gold Ingot", "Raw Gold or Gold Ore"], ["Copper Ingot", "Raw Copper or Copper Ore"],
    ["Glass", "Sand"], ["Stone", "Cobblestone"], ["Smooth Stone", "Stone"], ["Charcoal", "Log"], ["Brick", "Clay Ball"],
    ["Terracotta", "Clay (block)"], ["Netherite Scrap", "Ancient Debris"], ["Steak", "Raw Beef"], ["Cooked Porkchop", "Raw Porkchop"],
    ["Cooked Chicken", "Raw Chicken"], ["Cooked Mutton", "Raw Mutton"], ["Cooked Cod", "Raw Cod"], ["Cooked Salmon", "Raw Salmon"],
    ["Cooked Rabbit", "Raw Rabbit"], ["Baked Potato", "Potato"], ["Dried Kelp", "Kelp"], ["Green Dye", "Cactus"], ["Lime Dye", "Sea Pickle"],
    ["Popped Chorus Fruit", "Chorus Fruit"], ["Sponge", "Wet Sponge"], ["Nether Brick", "Netherrack"], ["Deepslate", "Cobbled Deepslate"],
    ["Cracked Stone Bricks", "Stone Bricks"], ["Smooth Sandstone", "Sandstone"],
  ];
  for (const [out, inp] of SMELT) {
    const ex = items.find((i) => i.name === out);
    if (ex) ex.smelt = inp;
    else R(out, { smelt: inp, aliases: out === "Steak" ? "cooked beef|cooked steak" : undefined });
  }

  // ---------- mobs ----------
  const mobs = [
    ["Creeper", 20, "hostile", "Sneaks up and explodes! Drops gunpowder. Hit it and back off, or use a bow. Creepers are scared of cats and ocelots. If lightning hits one it becomes a charged creeper.", "creepers|creper|creeeper"],
    ["Zombie", 20, "hostile", "Burns in sunlight unless it has a helmet. Drops rotten flesh, sometimes iron, carrots or potatoes. On Hard it can break wooden doors.", "zombies|zombi"],
    ["Skeleton", 20, "hostile", "Shoots arrows and burns in daylight. Drops bones and arrows. Fight it around corners or use a shield.", "skeletons|skelly|skeleton archer"],
    ["Spider", 16, "neutral (hostile at night)", "Climbs walls. Drops string and spider eyes. Peaceful in daylight unless you hit it.", "spiders"],
    ["Cave Spider", 12, "hostile", "Smaller spider from mineshaft spawners. Its bite poisons you, so bring milk.", "cave spiders|blue spider"],
    ["Enderman", 40, "neutral", "Don't look it in the eyes, or wear a carved pumpkin. It hates water and teleports away from arrows. Drops ender pearls. Fight it under a 2-block-tall roof, it can't follow you there.", "endermen|ender man|enderman"],
    ["Witch", 26, "hostile", "Throws poison, slowness and harming potions and drinks healing ones. Drops redstone, glowstone, sugar and more.", "witches"],
    ["Slime", 16, "hostile", "Splits into smaller slimes when killed. Small ones drop slimeballs. Lives in swamps and slime chunks.", "slimes"],
    ["Phantom", 20, "hostile", "Swoops down from the sky if you haven't slept for three days or more. Sleep in a bed to stop them! Drops phantom membranes (repair elytra, slow falling potions).", "phantoms|phantom mob"],
    ["Drowned", 20, "hostile", "Underwater zombie. Some carry tridents (the only way to get one) or nautilus shells.", "drowneds|drowned zombie"],
    ["Husk", 20, "hostile", "Desert zombie that doesn't burn in sunlight. Its hits make you hungry.", "husks"],
    ["Stray", 20, "hostile", "Snowy-biome skeleton that shoots slowness arrows.", "strays"],
    ["Bogged", 16, "hostile", "Mossy skeleton from swamps and trial chambers that shoots poison arrows.", "bogged skeleton"],
    ["Silverfish", 8, "hostile", "Hides in infested stone blocks in strongholds. Calls its friends when hurt.", "silver fish"],
    ["Blaze", 20, "hostile", "Floats in Nether fortresses and shoots fireballs. Drops blaze rods (for brewing and eyes of ender). Snowballs hurt it! Fire resistance potions help a lot.", "blazes"],
    ["Ghast", 10, "hostile", "Giant floating Nether jellyfish that shoots fireballs. Hit the fireball back at it! Drops ghast tears and gunpowder.", "ghasts|gast"],
    ["Wither Skeleton", 20, "hostile", "Tall black skeleton in Nether fortresses. Its hits give the Wither effect. It rarely drops a wither skeleton skull (you need 3 to summon the Wither). Looting helps.", "wither skeletons"],
    ["Piglin", 16, "neutral", "Leaves you alone if you wear at least one gold armor piece. Throw gold ingots at it to barter for ender pearls, obsidian, fire resistance potions and more. Never open chests near them!", "piglins|pigman|pig man"],
    ["Zombified Piglin", 20, "neutral", "Peaceful until you hit one, then the whole group attacks. Drops gold nuggets and rotten flesh.", "zombie pigman|zombified piglins|zombie piglin"],
    ["Hoglin", 40, "hostile", "Big Nether boar in crimson forests. Warped fungus scares it. Drops porkchops and leather.", "hoglins"],
    ["Piglin Brute", 50, "hostile", "Axe-wielding piglin in bastions. Gold armor doesn't calm it down.", "brute"],
    ["Magma Cube", 16, "hostile", "Nether slime that splits apart. Drops magma cream.", "magma cubes|magma slime"],
    ["Guardian", 30, "hostile", "Lives in ocean monuments and shoots a laser. Drops prismarine and fish.", "guardians"],
    ["Elder Guardian", 80, "hostile", "Three of them guard each ocean monument and give you Mining Fatigue. Drops a wet sponge.", "elder guardians"],
    ["Shulker", 30, "hostile", "Hides in a shell in End cities and shoots bullets that make you float. Drops shulker shells.", "shulkers"],
    ["Evoker", 24, "hostile", "Summons fangs and vexes. Found in woodland mansions and raids. Drops the totem of undying!", "evokers"],
    ["Vindicator", 24, "hostile", "Axe-swinging illager from mansions and raids.", "vindicators"],
    ["Pillager", 24, "hostile", "Crossbow illager from outposts and raids. Killing a captain gives Bad Omen.", "pillagers"],
    ["Ravager", 100, "hostile", "A huge beast that shows up in raids. Hits really hard.", "ravagers"],
    ["Warden", 500, "hostile", "The scariest mob. It lives in the deep dark and is blind but hears every vibration. Sneak, don't trigger sculk shriekers, and run if it shows up. It hits for about 30 damage on Normal and even shoots a sonic boom through walls. If you really want to fight it: full netherite with Protection IV, a Sharpness V sword, strength and regeneration potions and lots of golden apples, or trap it and pillar up. It drops a sculk catalyst (and 5 XP).", "wardens|the warden"],
    ["Breeze", 30, "hostile", "Windy mob from trial chambers that jumps around and shoots wind charges. Drops breeze rods (used for the mace).", "breezes"],
    ["Ender Dragon", 200, "boss", "The final boss in the End. Destroy the end crystals on the obsidian pillars first (some are in cages, so shoot them with arrows or climb up), then hit the dragon when it lands on the portal. Bring a bow, a carved pumpkin, water and lots of food.", "dragon|enderdragon|the ender dragon|the dragon"],
    ["Wither", 300, "boss", "A three-headed boss you summon with soul sand and 3 wither skeleton skulls. It explodes when spawned, shoots skulls and gets armor at half health (arrows stop working then). Use Smite V, strength potions and golden apples. Drops a nether star.", "the wither|wither boss"],
    ["Villager", 20, "passive", "Trades items for emeralds. Their job depends on the workstation next to them (a lectern makes a librarian, for example). Protect them from zombies!", "villagers|testificate"],
    ["Wolf", 8, "neutral", "Tame it with bones and it becomes your loyal dog. Feed it meat to heal it and to breed dogs.", "wolves|dog|dogs|puppy"],
    ["Cat", 10, "passive", "Tame a stray cat with raw cod or raw salmon. Cats scare creepers and phantoms away and sometimes bring gifts.", "cats|kitty|kitten|ocelot"],
    ["Horse", "15 to 30", "passive", "Every horse has different health, speed and jump height. Tame it by getting on it again and again until hearts appear. Then put a saddle on it to ride. Feed golden carrots or golden apples to breed.", "horses|pony"],
    ["Parrot", 6, "passive", "Tame with seeds (never cookies!). It sits on your shoulder and dances to music.", "parrots"],
    ["Fox", 10, "passive", "Sleeps during the day and loves sweet berries. Breed two foxes and the baby trusts you.", "foxes"],
    ["Axolotl", 14, "passive", "Cute pink water buddy from lush caves. Catch it with a bucket of water, feed it tropical fish. It helps you fight underwater. Blue ones are super rare (1 in 1200)!", "axolotls|axolotol"],
    ["Bee", 10, "neutral", "Pollinates crops and makes honey. Don't hit it, the whole hive will sting you.", "bees"],
    ["Allay", 20, "passive", "Give it an item and it collects more of that item for you. Found in pillager outposts and woodland mansions.", "allays"],
    ["Iron Golem", 100, "neutral", "Protects villages. Build one with 4 iron blocks in a T shape and a carved pumpkin on top. Drops iron ingots.", "iron golems|golem"],
    ["Snow Golem", 4, "passive", "Stack 2 snow blocks with a pumpkin on top. Throws snowballs at mobs and leaves a snow trail.", "snowman|snow golems"],
    ["Cow", 10, "passive", "Drops leather and beef. Milk it with a bucket. Breed with wheat.", "cows"],
    ["Pig", 10, "passive", "Drops porkchops. Ride it with a saddle and a carrot on a stick. Breed with carrots, potatoes or beetroots.", "pigs|piggy"],
    ["Sheep", 8, "passive", "Shear it for 1-3 wool, or dye it first to get colored wool. Breed with wheat.", "sheeps"],
    ["Chicken", 4, "passive", "Lays eggs and drops feathers and chicken. Breed with seeds.", "chickens|chicks"],
    ["Turtle", 30, "passive", "Lays eggs on the beach where it hatched. Babies drop scutes when they grow up. Breed with seagrass.", "turtles"],
    ["Dolphin", 10, "neutral", "Swim near one to get Dolphin's Grace (super fast swimming). Feed it raw fish and it leads you to treasure.", "dolphins"],
    ["Sniffer", 14, "passive", "An ancient mob hatched from a sniffer egg (from warm ocean ruins). It digs up rare seeds.", "sniffers"],
    ["Camel", 32, "passive", "Two players can ride it, and it can dash. Breed with cactus.", "camels"],
    ["Armadillo", 12, "passive", "Rolls into a ball when scared. Brush it for scutes to make wolf armor.", "armadillos"],
    ["Frog", 10, "passive", "Eats small slimes and magma cubes. Frogs from different climates make different froglights.", "frogs"],
    ["Panda", 20, "neutral", "Lives in bamboo jungles. Each panda has a personality (lazy, playful, worried...). Breed with bamboo.", "pandas"],
    ["Goat", 10, "neutral", "Lives in mountains and rams you off cliffs! Screaming goats are a thing.", "goats"],
    ["Polar Bear", 30, "neutral", "Gets angry if you're near its cub.", "polar bears"],
    ["Squid", 10, "passive", "Drops ink sacs. Glow squids drop glow ink sacs.", "squids|glow squid"],
  ];

  // ---------- enchantments ----------
  const enchants = [
    ["Mending", 1, "any damageable item", "Repairs the item using the XP orbs you collect. The best enchantment! Get it from librarian villagers, fishing or chests. Can't be combined with Infinity."],
    ["Unbreaking", 3, "tools, weapons, armor", "Makes items last longer (they sometimes don't lose durability)."],
    ["Efficiency", 5, "pickaxe, axe, shovel, hoe, shears", "Mine faster."],
    ["Fortune", 3, "pickaxe, axe, shovel, hoe", "More drops from ores like diamonds, coal, redstone and lapis. Can't be combined with Silk Touch."],
    ["Silk Touch", 1, "pickaxe, axe, shovel, hoe", "Mines the block itself (like grass blocks, glass or ore blocks). Can't be combined with Fortune."],
    ["Sharpness", 5, "sword, axe", "More damage to everything. Can't be combined with Smite or Bane of Arthropods."],
    ["Smite", 5, "sword, axe", "Extra damage to undead mobs (zombies, skeletons, the Wither)."],
    ["Bane of Arthropods", 5, "sword, axe", "Extra damage to spiders, bees, silverfish and endermites."],
    ["Looting", 3, "sword", "Mobs drop more loot."],
    ["Fire Aspect", 2, "sword", "Sets mobs on fire (cooks meat drops too)."],
    ["Knockback", 2, "sword", "Pushes mobs back."],
    ["Sweeping Edge", 3, "sword (Java only)", "Stronger sweep attacks."],
    ["Protection", 4, "armor", "Reduces most damage. Can't be combined with the other protection types."],
    ["Fire Protection", 4, "armor", "Less fire and lava damage."],
    ["Blast Protection", 4, "armor", "Less explosion damage."],
    ["Projectile Protection", 4, "armor", "Less damage from arrows and fireballs."],
    ["Feather Falling", 4, "boots", "Much less fall damage."],
    ["Depth Strider", 3, "boots", "Walk faster underwater. Can't be combined with Frost Walker."],
    ["Frost Walker", 2, "boots", "Freezes water under your feet (treasure enchantment)."],
    ["Soul Speed", 3, "boots", "Faster on soul sand and soul soil (from piglin bartering)."],
    ["Swift Sneak", 3, "leggings", "Sneak faster (only from ancient city chests)."],
    ["Respiration", 3, "helmet", "Breathe longer underwater."],
    ["Aqua Affinity", 1, "helmet", "Mine at normal speed underwater."],
    ["Thorns", 3, "armor", "Hurts mobs that hit you (but uses durability)."],
    ["Power", 5, "bow", "More arrow damage."],
    ["Punch", 2, "bow", "Arrows knock mobs back."],
    ["Flame", 1, "bow", "Arrows set mobs on fire."],
    ["Infinity", 1, "bow", "Shoot forever with just one arrow in your inventory. Can't be combined with Mending."],
    ["Multishot", 1, "crossbow", "Shoots three arrows at once. Can't be combined with Piercing."],
    ["Quick Charge", 3, "crossbow", "Reloads faster."],
    ["Piercing", 4, "crossbow", "Arrows go through several mobs."],
    ["Loyalty", 3, "trident", "The trident flies back to you."],
    ["Riptide", 3, "trident", "Launches you when you throw it in water or rain. Can't be combined with Loyalty or Channeling."],
    ["Channeling", 1, "trident", "Summons lightning during thunderstorms."],
    ["Impaling", 5, "trident", "Extra damage to sea creatures (Java)."],
    ["Luck of the Sea", 3, "fishing rod", "Better treasure while fishing."],
    ["Lure", 3, "fishing rod", "Fish bite faster."],
    ["Density", 5, "mace", "More smash damage per block fallen."],
    ["Breach", 4, "mace", "Hits go through armor."],
    ["Wind Burst", 3, "mace", "Bounces you back up after a smash attack."],
    ["Curse of Vanishing", 1, "anything", "The item disappears when you die."],
    ["Curse of Binding", 1, "armor", "You can't take the armor off until you die."],
  ];
  const bestEnchants = {
    sword: "Sharpness V, Looting III, Unbreaking III, Mending, Fire Aspect II and Sweeping Edge III (Knockback is optional).",
    pickaxe: "Efficiency V, Unbreaking III, Mending, and either Fortune III (more ore) or Silk Touch (the block itself).",
    axe: "Efficiency V, Sharpness V, Unbreaking III, Mending (and Silk Touch or Fortune if you like).",
    shovel: "Efficiency V, Unbreaking III, Mending, and Silk Touch or Fortune.",
    bow: "Power V, Unbreaking III, Punch II, Flame, and either Infinity or Mending (not both).",
    crossbow: "Quick Charge III, Multishot or Piercing IV, Unbreaking III, Mending.",
    helmet: "Protection IV, Respiration III, Aqua Affinity, Unbreaking III, Mending.",
    chestplate: "Protection IV, Unbreaking III, Mending (Thorns is optional).",
    leggings: "Protection IV, Swift Sneak III, Unbreaking III, Mending.",
    boots: "Protection IV, Feather Falling IV, Depth Strider III (or Frost Walker), Soul Speed III, Unbreaking III, Mending.",
    armor: "Protection IV, Unbreaking III and Mending on every piece. Add Feather Falling IV on boots and Respiration + Aqua Affinity on the helmet.",
    trident: "Loyalty III (or Riptide III), Channeling, Impaling V, Unbreaking III, Mending.",
    "fishing rod": "Luck of the Sea III, Lure III, Unbreaking III, Mending.",
    mace: "Density V (or Breach IV), Wind Burst III, Unbreaking III, Mending.",
    elytra: "Unbreaking III and Mending.",
  };

  // ---------- what each animal eats in Minecraft (feeding = breeding and healing) ----------
  const feed = {
    Cow: "wheat", Mooshroom: "wheat", Sheep: "wheat", Goat: "wheat", Pig: "carrots, potatoes or beetroot", Chicken: "seeds (wheat, melon, pumpkin or beetroot seeds)",
    Wolf: "any meat (and bones to tame it first)", Cat: "raw cod or raw salmon", Ocelot: "raw cod or raw salmon", Axolotl: "a bucket of tropical fish", Horse: "golden carrots or golden apples (wheat, sugar, apples and hay heal them)",
    Donkey: "golden carrots or golden apples", Rabbit: "dandelions, carrots or golden carrots", Turtle: "seagrass", Panda: "bamboo", Fox: "sweet berries or glow berries",
    Bee: "any flower", Frog: "slimeballs", Sniffer: "torchflower seeds", Camel: "cactus", Armadillo: "spider eyes", Llama: "hay bales", Parrot: "seeds (NEVER cookies, they're poisonous to parrots!)",
    Strider: "warped fungus", Hoglin: "crimson fungus", "Polar Bear": "nothing, you can't breed polar bears", Dolphin: "raw cod or salmon (it won't breed, but it'll lead you to treasure!)",
  };

  // ---------- potions ----------
  const potions = [
    ["Healing", "Glistering Melon Slice", "Heals you instantly. Add glowstone for Healing II.", "health|instant health|heal", "g"],
    ["Regeneration", "Ghast Tear", "Heals you over time.", "regen", "rg"],
    ["Strength", "Blaze Powder", "More melee damage.", "strenght", "rg"],
    ["Swiftness", "Sugar", "Run faster.", "speed|swift", "rg"],
    ["Fire Resistance", "Magma Cream", "Immune to fire and lava. Perfect for the Nether!", "fire res|fire resist", "r"],
    ["Night Vision", "Golden Carrot", "See in the dark. Add a fermented spider eye to make Invisibility.", "nightvision", "r"],
    ["Invisibility", "Golden Carrot, then Fermented Spider Eye", "Mobs can't see you (armor still shows).", "invisible|invis", "r"],
    ["Water Breathing", "Pufferfish", "Breathe underwater.", "water breath", "r"],
    ["Leaping", "Rabbit's Foot", "Jump higher.", "jump|jump boost", "rg"],
    ["Slow Falling", "Phantom Membrane", "Fall slowly like a feather.", "slowfall", "r"],
    ["Poison", "Spider Eye", "Poisons whoever it hits (make it splash with gunpowder).", "poisen", "rg"],
    ["Weakness", "none: add a Fermented Spider Eye to a Water Bottle (no nether wart)", "Less melee damage. Splash it on a zombie villager, then feed it a golden apple to cure it.", "weak", "r"],
    ["Harming", "Glistering Melon Slice (or Spider Eye), then Fermented Spider Eye", "Instant damage (heals undead mobs instead).", "damage|instant damage|harm", "g"],
    ["Slowness", "Sugar (or Rabbit's Foot), then Fermented Spider Eye", "Slows whoever it hits.", "slow", "rg"],
    ["Turtle Master", "Turtle Shell", "Huge resistance but very slow.", "turtle", "rg"],
    ["Wind Charging", "Breeze Rod", "When you die, you let out a wind burst (1.21).", "", ""],
    ["Oozing", "Slime Block", "When you die, you spawn slimes (1.21).", "", ""],
    ["Weaving", "Cobweb", "When you die, you leave cobwebs (1.21).", "", ""],
    ["Infestation", "Stone", "Silverfish may spawn when you're hit (1.21).", "", ""],
  ];

  // ---------- ores ----------
  const ores = [
    ["Diamond", "Y=-59 (between -64 and 16, more the deeper you go)", "iron pickaxe or better", "Strip mine at Y=-59 or explore deep caves. Fortune III multiplies the drops."],
    ["Iron", "Y=15, and also high up in mountains around Y=232", "stone pickaxe or better", "Very common in caves; mountains are full of it."],
    ["Gold", "Y=-16 (badlands have extra gold up to Y=256)", "iron pickaxe or better", "Nether gold ore drops nuggets and can be mined with any pickaxe."],
    ["Coal", "Y=95 (common everywhere in stone up to Y=256)", "any pickaxe", "The easiest ore to find, look at cliffs and cave walls."],
    ["Redstone", "Y=-59 (below Y=15)", "iron pickaxe or better", "Glows when you touch it."],
    ["Lapis Lazuli", "Y=0 (between -64 and 64)", "stone pickaxe or better", "Needed for enchanting."],
    ["Copper", "Y=48 (dripstone caves have the most)", "stone pickaxe or better", "Used for lightning rods, spyglasses and copper blocks."],
    ["Emerald", "Y=232, only in mountain biomes", "iron pickaxe or better", "The rarest ore. Trading with villagers is an easier way to get emeralds."],
    ["Ancient Debris", "Y=15 in the Nether (between 8 and 22)", "diamond pickaxe or better", "Blast it out with beds or TNT (beds explode in the Nether), it's blast resistant."],
    ["Nether Quartz", "anywhere in the Nether", "any pickaxe", "Gives nice XP too."],
  ];

  // ---------- guides (matched by their questions) ----------
  const guides = [
    { q: ["how to get to the nether", "how do i go to the nether", "nether portal", "how to make a nether portal", "how to build a portal"],
      a: "To get to the Nether: build an obsidian frame at least 4 wide and 5 tall (corners optional, so 10 obsidian), then light it with flint and steel. No diamond pickaxe for obsidian? Pour water on still lava to make obsidian right where you need it, or use a bucket to shape it. Bring food, a sword, gold armor (so piglins are friendly) and blocks to build with!" },
    { q: ["how to get to the end", "how do i find the end", "end portal", "how to find a stronghold", "stronghold", "how to find the end portal"],
      a: "To reach the End: craft Eyes of Ender (ender pearl + blaze powder), throw one and follow it. Where it flies down, dig to find the stronghold. Find the portal room and put eyes into the empty frames (up to 12 in total). Then jump in, but prepare for the Ender Dragon first!" },
    { q: ["how to beat the ender dragon", "how to kill the ender dragon", "ender dragon fight", "how to defeat the dragon", "tips for the ender dragon"],
      a: "Ender Dragon tips: 1) Bring a bow with lots of arrows, blocks, a water bucket, food, golden apples and a carved pumpkin (so endermen ignore you). 2) Destroy the end crystals on top of the obsidian pillars first; the caged ones need climbing. 3) When the dragon perches on the portal in the middle, hit it with your best sword. 4) Avoid the purple breath. Beds explode in the End, so pros use them as bombs, but that's risky!" },
    { q: ["first night", "what should i do first", "how to survive the first night", "beginner tips", "i am new to minecraft", "how do i start", "tips for beginners", "survival tips"],
      a: "First-day plan: 1) Punch a tree for logs, turn them into planks and make a crafting table. 2) Make a wooden pickaxe, mine some cobblestone, then make stone tools. 3) Find coal and craft torches. 4) Kill 3 sheep for wool and make a bed, or dig into a hill and block the entrance. 5) Find food (animals, apples). Sleep through the night and you're set!" },
    { q: ["how to find diamonds", "where are diamonds", "best y level for diamonds", "diamond level", "where do i find diamonds", "what level are diamonds"],
      a: "Diamonds: dig down to around Y=-59 (press F3 on Java to see your Y). Make sure you have an iron pickaxe, then strip-mine in straight tunnels or explore big deep caves. Look out for lava! Fortune III on your pickaxe gives more diamonds per ore." },
    { q: ["how to find a village", "where are villages", "village location"],
      a: "Villages spawn in plains, deserts, savannas, taigas and snowy plains. Explore those biomes, or with cheats on use /locate structure minecraft:village_plains. Villages have beds, food and villagers to trade with!" },
    { q: ["how to trade with villagers", "villager trading", "how do villagers work", "how to get a librarian", "villager jobs"],
      a: "Villager trading: right-click a villager with a job to see its trades (you pay with emeralds). Give a jobless villager a workstation to set its job: lectern = librarian (enchanted books!), composter = farmer, blast furnace = armorer, etc. Trade a few times and it levels up with better offers. Curing a zombie villager gives you huge discounts." },
    { q: ["how to delete a world", "how do i delete my minecraft worlds", "delete old worlds", "how to delete a minecraft world"],
      a: "To delete a world: on Java, go to Singleplayer, click the world once, then click Delete. On Bedrock (phones, consoles, Windows), tap Play, then the pencil icon next to the world, scroll all the way down and pick Delete World. Careful: it can't be undone, so back up anything you love! 💾" },
    { q: ["explain minecraft simply", "what is minecraft", "how do you play minecraft", "explain minecraft for a grandmother", "what do you do in minecraft", "what do you actually do in the game", "what is the point of minecraft", "how does minecraft work"],
      a: "Minecraft is like digital Lego in a huge world made of blocks. You can dig up any block (dirt, stone, wood) and place it somewhere else, so you can build anything: houses, castles, whole cities. There are two main ways to play: in Survival you collect materials, craft tools and stay safe from monsters at night; in Creative you have every block for free and can fly, so it's pure building. Kids love it because there's no single goal: they explore, build and invent. A lovely question to ask your grandchildren: \"Can you show me something you built?\" 😊" },
    { q: ["what is the difference between survival and creative", "survival vs creative", "survival or creative", "what is survival mode", "what is creative mode"],
      a: "Survival mode: you start with nothing, gather wood and stone, craft tools, and have health and hunger, and monsters come out at night. Creative mode: unlimited blocks, you can fly and can't get hurt, so it's all about building. Many kids build in Creative and go on adventures in Survival." },
    { q: ["what is a mob", "what does mob mean", "what is a mob in minecraft", "what are mobs"],
      a: "In Minecraft, a \"mob\" is any creature that moves around: animals like cows and sheep, and monsters like zombies and creepers. (It's short for \"mobile\".) Some are friendly, some only fight back if you hit them, and some attack you." },
    { q: ["what is a creeper", "what are creepers"],
      a: "A creeper is Minecraft's most famous monster: a green, silent creature that sneaks up on you and explodes! 💥 Kids joke about them a lot. They're scared of cats, and they drop gunpowder." },
    { q: ["how to build a house", "how do i build a cozy house", "cozy house ideas", "how to make a house in minecraft", "how to build a cherry wood house", "cherry wood house", "how do i make a cherry house", "how do i build a nice house"],
      a: "Cozy house tips: 🏡 1) Pick a simple shape, like 7×9, and make the frame from logs (stripped cherry logs look great) with planks for the walls. 2) Don't make walls flat: push the windows and doors in or out by one block. 3) Give it a roof with stairs that hangs over the walls by one block. 4) Add a porch, lanterns, flower pots, leaves and a little path. 5) Inside: carpets, bookshelves, a bed and some plants make it cozy!" },
    { q: ["what blocks go with cherry wood", "what blocks look nice with cherry planks", "cherry wood palette", "what goes with cherry planks", "block palette", "what blocks look good together", "blocks that go together"],
      a: "Blocks that look great with cherry: 🌸 white or light gray concrete, calcite, birch planks, stripped cherry logs for beams, deepslate tiles or dark oak for contrast, and pink petals and flowering azalea for decoration. For purple: amethyst blocks, purpur, or purple and magenta stained glass look amazing with cherry! 💜" },
    { q: ["what should i use for the roof", "roof ideas", "how to make a roof", "best roof blocks", "roof for my house"],
      a: "Roof ideas: use stairs so it slopes (deepslate tile, dark oak or spruce stairs look great), let it hang one block past the walls, and add slabs at the top. For a cherry house, dark oak or deepslate tile makes the pink pop. 🏠" },
    { q: ["how to make a pool", "how do i make a pool", "how to build a swimming pool", "swimming pool in minecraft", "pool ideas"],
      a: "Pool time! 🏊 Dig a hole (like 5×8 and 3 deep), line it with smooth quartz, white concrete or prismarine, then fill it with water. Tip: make an infinite water source (2 buckets in a 2×2 hole) so you never run out. Put sea lanterns under the water for a glow, and use slabs or stairs for steps and a diving board!" },
    { q: ["how to get a blue axolotl", "blue axolotl", "how do i get a blue one axolotl", "rarest axolotl"],
      a: "Blue axolotls are super rare! 💙 They never spawn in the wild: you have to breed two axolotls (feed each a bucket of tropical fish), and each baby has a 1 in 1200 chance of being blue. So... lots of breeding! Keep the babies in a pen with water so they don't dry out." },
    { q: ["how to get bees", "how do i get bees", "bee farm", "how to move bees", "how to get honey"],
      a: "Bees live in bee nests on birch, oak and cherry trees, especially in flower forests, plains and meadows. 🐝 Hold a flower and they'll follow you! To move a nest, mine it with a Silk Touch tool while the bees are inside (at night). For honey: put a campfire under the nest so they stay calm, then use a glass bottle (honey) or shears (honeycomb)." },
    { q: ["how to make a map", "how to use a map", "how do maps work"],
      a: "Craft a map with 8 paper around a compass (or 9 paper for an empty map in newer versions), hold it and right-click to start drawing the area around you. 🗺️ Combine it with more paper on a cartography table to zoom out!" },
    { q: ["what is the rarest thing in minecraft", "rarest item", "rarest block", "rarest mob", "what is the rarest"],
      a: "Some of the rarest things in Minecraft: 💎 a blue axolotl (1 in 1200 when breeding), a brown panda, a pink sheep (0.164% of sheep), a skeleton horse trap, the dragon egg (only one per world!), enchanted golden apples, and heavy cores from ominous vaults (for the mace)." },
    { q: ["how to breed animals", "how do you breed animals", "breeding animals", "how to make baby animals"],
      a: "Breeding: feed two adult animals of the same kind their favorite food and they'll make hearts and a baby! 💕 Cows, sheep and goats: wheat. Pigs: carrots, potatoes or beetroot. Chickens: seeds. Horses: golden carrots. Cats: raw fish. Wolves: meat. Rabbits: dandelions or carrots. Axolotls: buckets of tropical fish. Then wait 5 minutes before breeding them again." },
    { q: ["how to hide from mobs", "best way to hide in minecraft", "hide from mobs", "how do i stay safe at night in minecraft", "how to not get attacked by mobs"],
      a: "Hiding from mobs: dig into a hillside and block the entrance behind you (mobs can't dig), light everything up with torches (mobs don't spawn in bright light), use doors (zombies can only break them on Hard), and sleep in a bed to skip the night. Sneaking also makes the Warden and sculk sensors not hear you. 🏠" },
    { q: ["is herobrine real", "herobrine", "who is herobrine"],
      a: "Herobrine is a Minecraft legend! 👻 The story says he's a ghostly Steve with white eyes, but he was never actually in the game. Mojang even jokes about it in the patch notes: \"Removed Herobrine\". If your sister saw him, maybe it was a mod, a skin... or a really good prank! 😄" },
    { q: ["how to get mending", "where to find mending", "mending book", "get mending from a villager", "mending from villager", "librarian mending", "mending villager"],
      a: "Mending: the easiest way is a librarian villager. Place a lectern next to a jobless villager and check its trades; if there's no Mending book, break and replace the lectern (before you trade) until it offers Mending. You can also fish for it or find it in chests." },
    { q: ["how to cure a zombie villager", "cure zombie villager", "zombie villager"],
      a: "To cure a zombie villager: throw a splash potion of Weakness on it, then feed it a golden apple. It shakes for a few minutes (keep it out of sunlight) and turns back into a villager, with big trade discounts for you." },
    { q: ["how to breed animals", "how to breed cows", "breeding", "how to make baby animals", "what do i feed"],
      a: "Breeding: feed two animals of the same kind their favorite food. Cows, sheep and goats: wheat. Pigs: carrots, potatoes or beetroots. Chickens: seeds. Rabbits: carrots or dandelions. Horses: golden carrots or golden apples. Wolves: any meat (tamed only). Cats: raw cod or salmon. Bees: flowers. Turtles: seagrass. Pandas: bamboo. Foxes: sweet berries." },
    { q: ["how to tame a wolf", "how to get a dog", "how to tame a dog", "tame wolf"],
      a: "To tame a wolf: give it bones (right-click) until a red collar and hearts appear. It can take a few bones. Feed it meat to heal it, and sit/stand it with right-click." },
    { q: ["how to tame a cat", "tame cat", "how to get a cat"], a: "To tame a cat: find a stray cat in a village, sneak up slowly holding raw cod or raw salmon, and feed it when it comes close. Cats scare away creepers and phantoms!" },
    { q: ["how to tame a horse", "how to ride a horse", "tame horse"], a: "To tame a horse: get on it with an empty hand over and over; it will throw you off a few times. When hearts appear it's tamed. Then put a saddle on it so you can steer. Feeding it sugar, wheat or apples helps it trust you faster." },
    { q: ["how to make a farm", "how to farm", "wheat farm", "crop farm", "how to grow crops"],
      a: "Basic farm: till dirt with a hoe next to water (water hydrates farmland up to 4 blocks away), plant seeds, and keep it lit so mobs don't trample it. Bone meal makes crops grow instantly. Fence it in so animals stay out!" },
    { q: ["how to make an iron farm", "iron farm"], a: "An iron farm uses villagers that get scared by a zombie, which makes iron golems spawn. You need 3 villagers with beds, a zombie they can see (but can't reach), and a kill chamber with lava blades and hoppers. Look up a design for your version, they change between updates!" },
    { q: ["how to make a beacon", "beacon pyramid", "how to activate a beacon", "beacon levels"],
      a: "Beacon: craft it with 5 glass, 3 obsidian and a nether star (from the Wither). Then place it on a pyramid of iron, gold, emerald, diamond or netherite blocks: 3x3 = level 1 (9 blocks), plus 5x5 = level 2 (34 total), plus 7x7 = level 3 (83), plus 9x9 = level 4 (164). Pay with an ingot, emerald, diamond or netherite ingot to pick a power." },
    { q: ["how to summon the wither", "how to spawn the wither", "how to beat the wither", "how to kill the wither"],
      a: "The Wither: collect 3 wither skeleton skulls (Nether fortresses) and 4 soul sand/soil. Build a T of soul sand and put the skulls on top, the last skull spawns it. Fight it underground or in a closed arena far from home. Use Smite V, Protection IV armor, strength and healing potions, golden apples and milk (to cure the Wither effect). Below half health it gets immune to arrows." },
    { q: ["how to get netherite", "how to make netherite", "netherite gear", "how to upgrade to netherite"],
      a: "Netherite: 1) Mine ancient debris in the Nether around Y=15 (beds or TNT help). 2) Smelt it into netherite scrap. 3) Craft 4 scrap + 4 gold ingots into a netherite ingot. 4) Find a netherite upgrade smithing template in a bastion. 5) At a smithing table, combine the template + diamond gear + netherite ingot. Keeps the enchantments!" },
    { q: ["how to get an elytra", "elytra", "how to fly", "where to find elytra"],
      a: "Elytra: after beating the Ender Dragon, throw an ender pearl into the small gateway portal to reach the outer End islands. Find an End city with a floating End ship; the elytra hangs in an item frame inside. Fly by jumping off something high and pressing jump again. Firework rockets boost you!" },
    { q: ["redstone basics", "how does redstone work", "redstone tutorial", "how to use redstone"],
      a: "Redstone basics: redstone dust carries power up to 15 blocks. Power comes from levers, buttons, pressure plates, redstone torches or a block of redstone. Repeaters extend and delay the signal, comparators read containers, and pistons, doors, lamps and dispensers react to power. Start with a simple piston door!" },
    { q: ["how to make obsidian", "how to get obsidian", "obsidian"], a: "Obsidian forms when water touches a still lava source block. Mine it with a diamond or netherite pickaxe (it takes about 9 seconds). Tip: use a bucket of water on lava pools." },
    { q: ["how to make a potion", "brewing", "how to brew", "potion brewing", "how do potions work"],
      a: "Brewing: craft a brewing stand (blaze rod + 3 cobblestone) and fuel it with blaze powder. Fill glass bottles with water, add Nether Wart to make Awkward Potions, then add an ingredient: sugar = Swiftness, blaze powder = Strength, magma cream = Fire Resistance, glistering melon = Healing, golden carrot = Night Vision, ghast tear = Regeneration... Redstone makes it last longer, glowstone makes it stronger, gunpowder makes it a splash potion." },
    { q: ["how to enchant", "how do i enchant", "enchanting", "how to use the enchanting table"],
      a: "Enchanting: place an enchanting table (book + 2 diamonds + 4 obsidian), put 15 bookshelves around it with a one-block gap, then add your item plus lapis lazuli and pick an enchantment with your XP levels. Level 30 gives the best ones. Combine enchanted books with items on an anvil." },
    { q: ["how to get xp", "xp farm", "how to level up", "how to get experience"], a: "XP: kill mobs, mine coal/diamond/lapis/redstone/quartz ore, smelt things (collect from the furnace), breed animals, fish and trade. A mob spawner farm or an enderman farm in the End is the fastest." },
    { q: ["how to find a nether fortress", "nether fortress", "where are blazes"], a: "Nether fortresses are dark nether-brick buildings. Travel along the X or Z axis in the Nether, they tend to be spread out in strips. Blazes, wither skeletons and nether wart are inside." },
    { q: ["how to find an ancient city", "ancient city", "deep dark"], a: "Ancient cities are in the deep dark biome, deep underground (around Y=-51) usually under mountains. Sneak so sculk sensors don't hear you, and don't trigger the shriekers, or the Warden comes. The loot (Swift Sneak, echo shards, enchanted golden apples) is great!" },
    { q: ["commands", "cheat commands", "useful commands", "minecraft commands", "how to use commands"],
      a: "Useful commands (cheats need to be on): /gamemode creative (or survival), /time set day, /weather clear, /tp <x> <y> <z>, /give @s diamond 64, /locate structure minecraft:village_plains, /gamerule keepInventory true (keep items when you die), /difficulty peaceful, /seed." },
    { q: ["how to find slime", "slime chunk", "where do slimes spawn"], a: "Slimes spawn in swamps at night (more on a full moon) and underground below Y=40 in special 'slime chunks'. Tools like chunkbase can find slime chunks from your seed." },
    { q: ["how to make a nether portal without diamonds", "portal without diamond pickaxe", "bucket portal"],
      a: "Portal without a diamond pickaxe: find a lava pool, build a mold for the frame, and pour water over lava placed in position so each block turns into obsidian where you need it. Or find a ruined portal and finish it with crying obsidian swapped for normal obsidian." },
    { q: ["what is the best food", "best food", "food"], a: "Best foods: golden carrots (great saturation), steak and cooked porkchops (easy to farm), and suspicious stew or golden apples in emergencies. Bread is a good start when you have a wheat farm." },
    { q: ["how to make an automatic farm", "auto farm", "automatic sugar cane farm"], a: "Easy automatic farm: plant sugar cane next to water, put observers facing the cane's second block, with pistons behind them. When cane grows, the observer fires the piston and breaks it; hoppers under a water stream collect the drops." },
    { q: ["what is minecraft", "who made minecraft", "when did minecraft come out", "minecraft history", "who created minecraft"],
      a: "Minecraft was created by Markus 'Notch' Persson and first came out in 2009. The full release was on November 18, 2011. Mojang Studios makes it, and Microsoft bought Mojang in 2014. It's the best-selling video game of all time!" },
    { q: ["how to find a woodland mansion", "woodland mansion", "mansion"], a: "Woodland mansions are huge dark-oak houses in dark forests, very far from spawn. Cartographer villagers sell woodland explorer maps. Inside are evokers (totems of undying!), vindicators and allays." },
    { q: ["how to find an ocean monument", "ocean monument", "how to beat an ocean monument"], a: "Ocean monuments are in deep oceans. Cartographers sell ocean explorer maps. Bring water breathing potions, Depth Strider boots and milk for the Mining Fatigue from elder guardians. There are 8 gold blocks inside and sponges!" },
    { q: ["how to find a bastion", "bastion remnant", "bastion", "what is in a bastion"],
      a: "Bastion remnants are huge blackstone castles in the Nether (never in basalt deltas). They're full of piglins, and piglin brutes, which attack even if you wear gold. Every bastion has a netherite upgrade smithing template in a chest, plus gold blocks and sometimes ancient debris. Bring blocks, food and gold armor!" },
    { q: ["trial chamber", "trial chambers", "how to find a trial chamber", "trial spawner", "vault", "trial key"],
      a: "Trial chambers (1.21) are copper-and-tuff dungeons deep underground, usually around Y=-40 to -20. Trial spawners send waves of mobs; beat them to get a trial key, then open a vault for loot. Breezes drop breeze rods, and ominous vaults (opened with an ominous trial key) can give a heavy core for the mace." },
    { q: ["desert temple", "desert pyramid", "how to loot a desert temple"],
      a: "Desert temples are sandstone pyramids. Under the blue terracotta in the middle is a hidden room with 4 chests, but the pressure plate at the bottom is wired to 9 TNT! Dig down next to it and break the plate first. Loot: gold, diamonds, emeralds, enchanted books, sometimes enchanted golden apples." },
    { q: ["jungle temple", "jungle pyramid"],
      a: "Jungle temples are mossy stone temples hidden in jungles. Watch out for tripwires that shoot arrows, and solve the lever puzzle (usually: left, right, right, left... try the combinations) to open the secret chest." },
    { q: ["pillager outpost", "outpost", "how to start a raid", "raid", "bad omen", "ominous bottle"],
      a: "Pillager outposts are dark-oak towers full of pillagers. Killing the captain (the one with a banner on its head) gives you Bad Omen (in 1.21+ it drops an ominous bottle you drink). Walk into a village with Bad Omen and a raid starts: survive the waves to become Hero of the Village and get discounts. Allays are sometimes caged nearby!" },
    { q: ["ruined portal", "broken portal", "how to fix a ruined portal"],
      a: "Ruined portals are broken Nether portals found everywhere. Their chest has gold items, flint and steel and obsidian. Replace the crying obsidian and fill the gaps with normal obsidian to make the portal work." },
    { q: ["shipwreck", "buried treasure", "treasure map", "how to find buried treasure", "heart of the sea"],
      a: "Shipwrecks have chests with treasure maps. Follow the map to the red X, then dig down right there (the chest is usually buried in sand a few blocks deep). Buried treasure always has a heart of the sea, which you need for a conduit!" },
    { q: ["mob spawner", "spawner", "xp farm with a spawner", "how to make a mob farm", "mob farm", "dungeon"],
      a: "Found a zombie or skeleton spawner? Light it up first so it stops spawning, then build a water stream that pushes mobs into a hole about 22 blocks deep. They land with half a heart left and you finish them with one hit: an easy XP farm!" },
    { q: ["lush cave", "how to find a lush cave", "how to find axolotls", "where do axolotls spawn", "azalea"],
      a: "Look for azalea trees on the surface (bushy trees with pink flowers). A lush cave is usually right below. Axolotls live in its water pools: scoop one up with a bucket of water, and feed it buckets of tropical fish to breed it." },
    { q: ["biomes", "what biomes are there", "list of biomes", "best biome", "rarest biome"],
      a: "Minecraft has 60+ biomes: plains, forests, birch and dark forests, deserts, jungles, taigas, savannas, badlands, swamps, mangrove swamps, snowy plains, cherry groves, meadows, mushroom fields (no hostile mobs ever spawn there!), oceans and caves like lush caves, dripstone caves and the deep dark. The Nether has nether wastes, crimson and warped forests, soul sand valleys and basalt deltas." },
    { q: ["creative mode", "how to switch to creative", "change game mode", "how to fly", "gamemode"],
      a: "To switch game mode, turn on cheats and type /gamemode creative (or survival, adventure, spectator). On Java you can also press F3+F4. In creative, double-tap jump to fly!" },
    { q: ["how to sleep", "how to skip the night", "sleep through the night", "why can't i sleep"],
      a: "Right-click a bed at night or during a thunderstorm to skip to morning (and set your spawn). You can't sleep if monsters are nearby. On servers everyone has to sleep, unless someone changes /gamerule playersSleepingPercentage." },
    { q: ["cherry grove", "cherry blossom", "pink trees", "cherry tree"],
      a: "Cherry groves are the pink tree biomes added in 1.20. They generate in mountain areas, often next to meadows. Cherry wood makes pink planks!" },
    { q: ["sniffer", "how to get a sniffer", "sniffer egg"],
      a: "Sniffers hatch from sniffer eggs. Brush suspicious sand in warm ocean ruins to find one, place it (on moss it hatches twice as fast) and wait. Grown sniffers dig up torchflower seeds and pitcher pods." },
    { q: ["best armor", "what is the best armor", "strongest armor"],
      a: "Netherite armor is the best: the most protection, toughness and knockback resistance, and it doesn't burn in lava. Put Protection IV, Unbreaking III and Mending on every piece." },
    { q: ["best sword", "best weapon", "strongest weapon", "what is the best sword"],
      a: "A netherite sword with Sharpness V, Looting III, Unbreaking III and Mending is the classic best weapon. The mace (1.21) hits even harder if you fall onto enemies, and a bow with Power V is best at range." },
    { q: ["best pickaxe", "what is the best pickaxe"],
      a: "A netherite pickaxe with Efficiency V, Unbreaking III, Mending and Fortune III (or Silk Touch). Many players keep one of each!" },
    { q: ["how many eyes of ender do i need", "how many eyes of ender", "how many ender eyes do i need", "how many eyes for the end portal"],
      a: "Up to 12: each of the 12 frame blocks around the End portal needs an eye, but some frames already have one, so usually you need about 10. Bring a few extra, because thrown eyes can break!" },
    { q: ["how to breed villagers", "villager breeding", "how do villagers breed", "how to get more villagers"],
      a: "Villagers breed when they're willing: they need enough food (3 bread, or 12 carrots, potatoes or beetroots each, just throw it to them) and there must be more free beds than villagers. Then hearts appear and a baby villager pops out!" },
    { q: ["can i feed cookies to my parrot", "can parrots eat cookies", "cookies parrot"],
      a: "No! Cookies are poisonous to parrots in Minecraft (and chocolate is really bad for real parrots too). Tame and feed them with seeds instead. 🦜" },
    { q: ["what is the rarest ore", "rarest ore"],
      a: "Emerald ore is the rarest ore: it only spawns in mountain biomes, one block at a time. Ancient debris in the Nether is also very rare, and diamond ore is rare above the deepslate layer." },
    { q: ["what is a good seed", "best seed", "good seeds", "what seed should i use", "cool seeds"],
      a: "Seeds change between versions, so I can't promise a specific one! Tip: any text works as a seed, so try a word you like (your name, 'glacier', 'axolotl'...). Sites like chunkbase let you preview a seed's villages and biomes before you play." },
    { q: ["how to make a redstone clock", "redstone clock", "observer clock"],
      a: "Easiest redstone clock: put two observers facing each other; they keep triggering each other, super fast. For a slower clock, make a loop of redstone dust with a couple of repeaters (more delay = slower) and start it with one button press." },
    { q: ["how to delete a world", "how do i delete my minecraft worlds", "delete old worlds", "how to delete a minecraft world"],
      a: "To delete a world: on Java, go to Singleplayer, click the world once, then click Delete. On Bedrock (phones, consoles, Windows), tap Play, then the pencil icon next to the world, scroll all the way down and pick Delete World. Careful: it can't be undone, so back up anything you love! 💾" },
    { q: ["explain minecraft simply", "what is minecraft", "how do you play minecraft", "explain minecraft for a grandmother", "what do you do in minecraft", "what do you actually do in the game", "what is the point of minecraft", "how does minecraft work"],
      a: "Minecraft is like digital Lego in a huge world made of blocks. You can dig up any block (dirt, stone, wood) and place it somewhere else, so you can build anything: houses, castles, whole cities. There are two main ways to play: in Survival you collect materials, craft tools and stay safe from monsters at night; in Creative you have every block for free and can fly, so it's pure building. Kids love it because there's no single goal: they explore, build and invent. A lovely question to ask your grandchildren: \"Can you show me something you built?\" 😊" },
    { q: ["what is the difference between survival and creative", "survival vs creative", "survival or creative", "what is survival mode", "what is creative mode"],
      a: "Survival mode: you start with nothing, gather wood and stone, craft tools, and have health and hunger, and monsters come out at night. Creative mode: unlimited blocks, you can fly and can't get hurt, so it's all about building. Many kids build in Creative and go on adventures in Survival." },
    { q: ["what is a mob", "what does mob mean", "what is a mob in minecraft", "what are mobs"],
      a: "In Minecraft, a \"mob\" is any creature that moves around: animals like cows and sheep, and monsters like zombies and creepers. (It's short for \"mobile\".) Some are friendly, some only fight back if you hit them, and some attack you." },
    { q: ["what is a creeper", "what are creepers"],
      a: "A creeper is Minecraft's most famous monster: a green, silent creature that sneaks up on you and explodes! 💥 Kids joke about them a lot. They're scared of cats, and they drop gunpowder." },
    { q: ["how to build a house", "house ideas", "how do i build a good house", "building tips", "how to build better"],
      a: "Building tips: start with a simple rectangle, frame the corners with logs, fill walls with planks or stone bricks, and make a roof with stairs that overhangs by one block. Set walls back one block from the pillars for depth, mix 2-3 materials, add glass panes, flower pots, lanterns and a path. Light it up so mobs can't spawn!" },
    { q: ["what is the best enchantment", "best enchantment", "most useful enchantment"],
      a: "Mending is the best overall: it repairs your gear with the XP you pick up, so it lasts forever. After that: Unbreaking III on everything, Efficiency V on tools, Protection IV on armor and Sharpness V on swords." },
    { q: ["how to repair my elytra", "repair elytra", "fix elytra"],
      a: "Fix an elytra on an anvil with phantom membranes (each one repairs a chunk), or put Mending on it and pick up XP while wearing it. A broken elytra stops working but doesn't disappear!" },
    { q: ["how to repair tools", "how do i repair my sword", "how do i repair my pickaxe", "how to fix tools", "repair armor", "how to repair"],
      a: "Repairing: on an anvil, combine the item with its material (diamonds for diamond gear, iron ingots for iron) or with another copy of the item. A grindstone or crafting grid can merge two damaged copies too (but removes enchantments). Best of all: Mending, which repairs it with XP." },
    { q: ["what is the rarest thing in minecraft", "rarest item", "rarest mob"], a: "Some of the rarest things: a blue axolotl (1 in 1200 when breeding), a pink sheep (0.164% natural spawn), the dragon egg (only one per world), and enchanted golden apples." },
  ];

  P.mcdata = { items, mobs, feed, enchants, bestEnchants, potions, ores, guides };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
