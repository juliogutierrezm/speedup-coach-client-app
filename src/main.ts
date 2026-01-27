import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { AppComponent }        from './app/app.component';
import { appConfig } from './app/app.config';
import { awsExports } from './aws-exports';

// Configure Amplify once at bootstrap
Amplify.configure(awsExports);

bootstrapApplication(AppComponent, appConfig)
.catch(err => console.error(err));
