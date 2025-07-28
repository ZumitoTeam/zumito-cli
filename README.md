<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![npm version](https://img.shields.io/npm/v/zumito-cli?style=for-the-badge)](https://www.npmjs.com/package/zumito-cli)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/ZumitoTeam/zumito-cli">
    <img src="https://media.discordapp.net/attachments/964297459327184906/1066399583896342649/d05ce5c0de25fd9afb4f5492f31f21fe.png" alt="Logo" width="80" height="80"/>
  </a>

  <h3 align="center">Zumito CLI</h3>

  <p align="center">
    Accelerate your Zumito bot development with powerful CLI commands and seamless VS Code integration!
    <br />
    <a href="https://github.com/ZumitoTeam/zumito-bot">Explore Zumito Bot »</a>
    <br />
    <a href="https://github.com/ZumitoTeam/zumito-framework">Explore Zumito Framework »</a>
    <br />
    <br />
    <a href="https://github.com/ZumitoTeam/zumito-cli/issues">Report Bug</a>
    ·
    <a href="https://github.com/ZumitoTeam/zumito-cli/issues">Request Feature</a>
  </p>
</div>


<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#key-features">Key Features</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#support">Support</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>


<!-- ABOUT THE PROJECT -->
## About The Project

`zumito-cli` is a robust Command Line Interface (CLI) tool and a companion VS Code extension meticulously crafted to streamline and accelerate the development of Discord bots powered by the [Zumito Framework](https://github.com/ZumitoTeam/zumito-framework). It aims to abstract away repetitive setup tasks and enforce project conventions, allowing developers to focus on building unique bot functionalities.

By integrating directly into your development workflow, `zumito-cli` ensures consistency, reduces boilerplate, and enhances productivity, making the creation of scalable and maintainable [Zumito bots](https://github.com/ZumitoTeam/zumito-bot) more efficient than ever.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Key Features

*   **Rapid Project Scaffolding:** Quickly initialize new Zumito bot projects with essential configurations and a standardized folder structure.
*   **Module & Component Generation:** Effortlessly create new modules, commands, services, and other core components, maintaining code consistency and organization.
*   **Integrated VS Code Experience:** Enhance your development flow directly within VS Code with intelligent code actions and automations.
*   **Automated Service Injection:** Eliminate boilerplate code. The VS Code extension provides quick fixes to automatically import and inject available services into your command classes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started

This section will guide you through setting up `zumito-cli` for your development environment.

### Prerequisites

Ensure you have the following installed:
*   Node.js (16.x or higher) and npm

### Installation

To install `zumito-cli` globally, use npm:

```bash
npm install -g zumito-cli
```

Alternatively, you can use `npx` to execute commands on-the-fly without global installation:

```bash
npx zumito-cli <command>
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- USAGE EXAMPLES -->
## Usage

### CLI Commands

`zumito-cli` provides a suite of commands to automate common development tasks:

*   **`create project`**: Initializes a new Zumito bot project.
    ```bash
    zumito-cli create project
    ```
    (This command will guide you through a series of prompts to configure your project, including project name, Discord bot token, client ID, client secret, bot prefix, and database type.)

*   **`create module`**: Generates a new module for your bot.
    ```bash
    zumito-cli create module
    ```
    (You will be prompted for the module name and type.)

*   **`create embedBuilder`**: Creates an embed builder service.
    ```bash
    zumito-cli create embedBuilder
    ```
    (You will be prompted for the module name and service name.)

*   **`create actionRowBuilder`**: Creates an action row builder service.
    ```bash
    zumito-cli create actionRowBuilder
    ```
    (You will be prompted for the module name and service name.)

### VS Code Extension

The `zumito-cli` VS Code extension is designed to seamlessly integrate into your development workflow:

**Code Actions for Service Injection:**
When working in a command file (e.g., `src/modules/your-module/commands/your-command.ts`) within a Zumito bot project, place your cursor on the command class definition line. Press `Ctrl+.` (or click the lightbulb icon) to reveal available code actions. You will find options to automatically import and inject available services into your command's `execute` method or constructor.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- LICENSE -->
## License

Distributed under the ISC License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- SUPPORT -->
## Support

Any questions or suggestions? Come to our [Discord server](https://discord.gg/EwEhgKCmSy) and chat with us!

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

We would like to thank the following projects for their inspiration and foundational support:

*   [Zumito Bot](https://github.com/ZumitoTeam/zumito-bot)
*   [Zumito Framework](https://github.com/ZumitoTeam/zumito-framework)

<p align="right">(<a href="#readme-top">back to top</a>)</p>