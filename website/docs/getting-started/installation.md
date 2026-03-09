# Installation

## Installing Markee

Start from the directory where you want to create your Markee project, then run the create command through your favorite package manager:

:::tab[Yarn]
```bash
yarn create markee
```
:::
:::tab[PNPM]
```bash
pnpm create markee
```
:::
:::tab[NPM]
```bash
npm create markee
```
:::

The initializer will guide you interactively, generate your `package.json`, and write your `markee.yaml` configuration.
When it finishes, run the dependency installation command it prints.

If you already installed `@markee/cli` manually, you can also run `markee init` directly instead of using `create`.

## Running Markee

Once dependencies are installed, you can run Markee through the `markee` command:

:::tab[Yarn]
```bash
yarn markee
```
:::
:::tab[PNPM]
```bash
pnpm markee
```
:::
:::tab[NPM]
```bash
npx markee
```
:::

This should produce the following output:

```bash
Markee CLI

  Build & develop Markdown-based websites with ease 

Commands

  dev (develop, start)   Run development server  
  build                  Build the website       
  serve (preview)        Serve the built website 

Options

  -h, --host string               Specify the host, defaults to 127.0.0.1       
  -p, --port number               Specify the port, defaults to 8000            
  -o, --outDir string             Specify the output folder, defaults to site   
  -m, --mode production|preview   Specify the mode. If set to production, draft 
                                  files are excluded. Defaults to production    
  --help                          Display this usage guide                      
  --skipLinkValidation            Do not stop build if missing links are        
                                  detected, just report them in the console and 
                                  continue the build  
```

### Launching the development server

Use the `markee dev` command to start the development server. By default, it will run on `http://localhost:8000`.
You can personalize the host and port through command line options, or via your `markee.yaml` configuration file.

The development server will automatically watch changes made to your files and refresh the relevant portions of your
pages as you edit your content.

:::note
If you access the dev server with an empty Markee configuration, you will be greeted with a temporary screen
explaining how to configure your sources. This is described in the [next page of this getting started](./sources.md).
:::

### Building your website

Once you're ready to publish your website to production, you can use the `markee build` command. In build mode, Markee
will check your files for invalid syntaxes as well as dead links between your source files. It will then output a
static website you can publish to any hosting provider, as long as it supports Single-Page Applications.
By default, the output is located in the `site` folder.

### Previsualizing your website

You can test your built website by using the `markee serve` command. This command will start a very simple SPA server
serving the output folder. It will also use `http://localhost:8000` by default.

## Manual setup

If you prefer not to use the create command, you can initialize a project manually by installing `@markee/cli` first.

:::tab[Yarn]
```bash
yarn add @markee/cli
yarn markee init
```
:::
:::tab[PNPM]
```bash
pnpm add @markee/cli
pnpm markee init
```
:::
:::tab[NPM]
```bash
npm add @markee/cli
npx markee init
```
:::

This runs the same interactive initializer and produces the same `package.json` and `markee.yaml` files as the create flow.
