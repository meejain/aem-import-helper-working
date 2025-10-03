# AEM Import Rules

Accelerate your AEM import script development!

The AEM Import Rules library allows you to spend less time writing repetitive [transformations](https://github.com/adobe/helix-importer-ui/blob/main/importer-guidelines.md#importjs-transformation-file) during `import.js` script development and more time focusing on the actual content on a source site and its relationship with Edge Delivery [blocks](https://www.aem.live/developer/markup-sections-blocks#blocks).

## Usage

### Transformer

The `transform` method of the `Transformer` class is the main entry point for an import script. A rules JSON just needs to be provided and the source document will be transformed according to the rules that were defined. 
Since the `Transformer` needs to run within the context of an import it does need to be included with the `WebImporter` global object. You can see an example of this in [fixtures.ts](./test/fixtures.ts).

```typescript
import {
  DOMUtils,
  FileUtils,
  Blocks,
} from '@adobe/helix-importer';
import {
  Transformer,
  CellUtils
} from 'aem-import-rules';

global.WebImporter = {
  Transformer,
  CellUtils,
  Blocks,
  DOMUtils,
  FileUtils
};
```
