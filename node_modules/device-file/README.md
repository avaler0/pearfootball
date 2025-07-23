# device-file

Device only file

```
npm install device-file
```

Stores some metadata about the device and complains if it thinks its been modified

## Usage

``` js
const { create, resume } = require('device-file')

await create('DEVICE', { appId: 'my-app-id' }) // pass whatever unique data you have for the device/app

// throws if DEVICE was modified or user data doesnt match or if it looks like an unsafe backup
await resume('DEVICE', { appId: 'my-app-id' })
```

## License

Apache-2.0
