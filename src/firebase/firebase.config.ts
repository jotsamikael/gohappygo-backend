import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig {
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  /** This method initializes the Firebase Admin SDK */
  private initializeFirebase() {
    try {
      // Use environment variables for production
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
        databaseURL: this.configService.get<string>('FIREBASE_DATABASE_URL'),
      });

      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
    }
  }

  getApp(): admin.app.App {
    return this.firebaseApp;
  }

  /** This method returns the Firebase Auth instance */
  getAuth(): admin.auth.Auth {
    return this.firebaseApp.auth();
  }

  /** This method returns the Firebase Database instance */
  getDatabase(): admin.database.Database {
    return this.firebaseApp.database();
  }

  /** This method returns the Firebase Messaging instance */
  getMessaging(): admin.messaging.Messaging {
    return this.firebaseApp.messaging();
  }
}