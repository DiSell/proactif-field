const fs = require("fs");
const path = require("path");

fs.writeFileSync(
  path.join(__dirname, "dist", "esm", "package.json"),
  JSON.stringify({ type: "module" }, null, 2)
);
