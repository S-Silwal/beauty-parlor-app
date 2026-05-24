#!/usr/bin/env node

// Read the JSON input that Claude Code sends via stdin
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolInput = data.tool_input || {};

    // The file path lives in different fields depending on the tool
    const filePath =
      toolInput.file_path || toolInput.path || toolInput.target_file || "";

    // Block anything touching .env files
    if (filePath.match(/\.env(\.|$)/)) {
      console.error(
        `Blocked: ${filePath} is an environment file and may contain secrets. Ask the user directly if you need this information.`
      );
      process.exit(2); // Exit code 2 = block the tool, send stderr back to Claude
    }

    // Otherwise, allow the tool to run
    process.exit(0);
  } catch (err) {
    // Don't break Claude on hook errors — just let the action through
    console.error(`Hook error: ${err.message}`);
    process.exit(0);
  }
});