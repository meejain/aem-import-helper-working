# AEM Import Builder

Powerful AI capabilities to simplify AEM import script development.

## Usage

Accessing the AEM Import Builder is achieved by using the `ImportBuilderFactory` to create an `ImportBuilder` instance.

Visit the [aem-import-helper](https://github.com/adobe/aem-import-helper/blob/main/src/assistant/assistant-helper.js) for a full example of how to use the AEM Import Builder.

### Import Builder Factory

The `ImportBuilderFactory` is responsible for managing authentication and emitting events during builder operations.

**Options**

- `baseUrl`: URL containing a `/tools/importer` path.
- `apiKey`: Import API key.
- `environment`: Assistant service environment (stage or prod).

The `create` method of the factory returns an `ImportBuilder` instance that can be used to build an AEM import script.
An `ImportBuilder` must be given a sample HTML document and screenshot to operate against. A set of existing import rules
can also be provided when building on top of an existing project.

```typescript
import {ImportBuilderFactory} from 'aem-import-builder';
import {FactoryOptions} from './importBuilderFactory';

const options: FactoryOptions = {
  baseUrl: 'https://localhost:3001',
  apiKey: 'import-api-key',
  environment: 'prod',
};

const factory = ImportBuilderFactory(options);
factory.on('start', (msg) => {
  // start message
});
factory.on('progress', (msg) => {
  // progress message
});
factory.on('complete', () => {
  // complete message
});

// rules is in import rules JSON object
// page is array containing an HTML document string and a Base64 encoded screenshot string
const builder = factory.create({mode: 'script', rules, page});
```

**Templates**

The `ImportBuilderFactory` uses templates to generate import scripts and AI prompts. The [templates](./src/templates) folder must be copied to a `/tools/importer`
path that is accessible by the `baseUrl` provided to the factory.

### Import Builder

An `ImportBuilder` consists of several asynchronous builder functions that all return a manifest of builder file items.
The `BuilderManifest` is a list of files that can be used to create an AEM import script.

```typescript
export type BuilderFileItem = {
  name: string;
  type?: 'parser' | 'transformer';
  contents: string;
}
```

### Build Project

Build a new import project that includes an initial import script and a set of import rules.

```typescript
const manifest = await builder.buildProject();
```

### Cleanup

Add cleanup rules to the import rules that will remove unnecessary elements from the document being imported.

```typescript
const manifest = await builder.addCleanup('breadcrumbs');
```

### Blocks

Add block rules to the import rules that will identify and extract blocks of content from the document being imported.

```typescript
const manifest = await builder.addBlock('block-name', 'block description');
```

### Block Cells

Add a block cell parser script to the import project that will add content to a block.

```typescript
const manifest = await builder.addCellParser('block-name', 'description of cell content');
```

### Page Transformation

Add a page transformation script to the import project that will transform the document content.

```typescript
const manifest = await builder.addPageTransformer('transformer-name', 'description of page transformation');
```

## Developer Guide

Ensure you understand the [architecture](https://github.com/arumsey/aem-import-builder/wiki).

### Install

Install all the dependencies.

```
npm i
```

### Build

This is a Typescript project so a build step is required to generate the final Javascript.

```
npm run build
```

### Lint

Run eslint to ensure code quality and consistency.

```
npm run lint
```

### Test

Run all the units tests using Mocha.

```
npm run test
```

### Environment

Since this project makes Open AI requests you must be authenticated.

The following environment variables must be defined before making requests to Azure Open AI.

```
IMS_CLIENT_SECRET
IMS_AUTH_CODE
```

### Templates

Handlebars templates are used extensively by the import builder to generate scripts and AI prompts. Script templates are stored as publicly accessible GitHib gists.

- https://gist.github.com/arumsey/a66e25a5292afcc0f34be48a84c8c548
