# baixari-backend

```
baixari-backend
├─ README.md
├─ esbuild.config.cjs
├─ package.json
├─ src
│  ├─ app
│  │  ├─ dto
│  │  │  ├─ dto.certificate.ts
│  │  │  └─ dto.protocol.ts
│  │  └─ usecase
│  │     ├─ certificate.file.downloader.usecase.ts
│  │     └─ protocol.file.downloader.usecase.ts
│  ├─ domain
│  │  ├─ entities
│  │  │  ├─ certificate.ts
│  │  │  └─ protocol.ts
│  │  ├─ gateway
│  │  │  ├─ file.existence.checker.ts
│  │  │  └─ zip.services.ts
│  │  └─ valuesobject
│  │     └─ path.ts
│  ├─ infra
│  │  ├─ archiver.zip.services.ts
│  │  └─ fs.file.existence.checker.ts
│  ├─ main.ts
│  └─ presentation
│     ├─ controllers
│     │  ├─ certificate.file.downloader.controller.ts
│     │  └─ protocol.file.downloader.controller.ts
│     └─ routers
│        └─ routers.ts
├─ tsconfig.json
└─ yarn.lock

```