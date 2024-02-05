# casa-sapo-scrapper

This library exposes a runner that simplifies the process of scrapping data from https://casa.sapo.pt if you're interested
in portugal real-estate data.
Keep in mind the website contains dynamic data (it is built with Next.js) and some data might be hard to extract (or susceptive to transient failures).
**Note** It is important to note that this library is framework agnostic but should always run on a node environment

Available in npm registry:
https://www.npmjs.com/package/casa-sapo-scrapper

## Getting started

PNPM

```sh
pnpm add casa-sapo-scrapper
```

NPM

```sh
npm i casa-sapo-scrapper
```

Yarn

```sh
yarn i casa-sapo-scrapper
```

## Example

```typescript
import { CasaSapoScrapper } from 'casa-sapo-scrapper';

const scrapper = new CasaSapoScrapper((row) => {
  console.log('I have a new row', row);
});

try {
  await scrapper.start();
} catch (ex) {
  // handle me
}
```

## Logging

By default we inject a [pino](https://github.com/pinojs/pino) instance without any customization but you're able to pass your instance
