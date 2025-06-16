# Zumito CLI VSCode Extension

This extension exposes basic Zumito CLI commands inside VS Code.

## Features
- `Zumito: Create Project` – run the CLI to scaffold a new project.
- `Zumito: Create Module` – generate a module using the CLI.

Each command opens a terminal and executes the corresponding CLI command so you can continue interacting with it.

When you run `Zumito: Create Project`, the extension prompts for the project name, Discord credentials and other configuration values before invoking the CLI. `Zumito: Create Module` asks for the module name and type.

## Building the VSIX

Install dependencies and run the package script:

```bash
npm install
npm run package
```

This generates a `zumito-extension-0.0.1.vsix` file in the extension folder.
