import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

async function doBootstrap() {
  try {
    const appRef = await bootstrapApplication(App, appConfig);
    return appRef;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// HMR support: avoid full page reloads when module.hot is available
declare const module: any;
if (module && module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // Angular handles cleanup; nothing explicit required here for standalone bootstrap
  });
  // initial bootstrap
  doBootstrap();
} else {
  doBootstrap();
}
