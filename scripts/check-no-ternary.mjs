import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const TARGET_DIRS = ["src", "tests"];

function collectSourceFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];

for (const dir of TARGET_DIRS) {
  const absDir = path.resolve(process.cwd(), dir);
  const files = collectSourceFiles(absDir);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    let scriptKind = ts.ScriptKind.TS;
    if (filePath.endsWith(".tsx")) {
      scriptKind = ts.ScriptKind.TSX;
    }

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    function visit(node) {
      if (ts.isConditionalExpression(node)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${path.relative(process.cwd(), filePath)}:${line + 1}:${character + 1}`,
        );
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
}

if (violations.length > 0) {
  console.error(
    "Operateur(s) ternaire(s) detecte(s) (interdit par .agent/rules/code-style.md) :",
  );
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("Verification zero-ternaire OK (src/** et tests/**).");
