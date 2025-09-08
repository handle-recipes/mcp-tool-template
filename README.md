# mcp-tool-template

Run locally to set up deployment:
```
brew install koyeb/tap/koyeb
npm run setup           # pastes token & picks group, writes .koyeb.env

```

Then deploy by running:
```
npm run deploy
# or deploy under a different group just this time:
npm run deploy -- group-07
```