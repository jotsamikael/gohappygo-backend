import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseConfig } from './firebase.config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private database: admin.database.Database;

  constructor(private firebaseConfig: FirebaseConfig) {}

  onModuleInit() {
    this.database = this.firebaseConfig.getDatabase();
  }

  // Get database reference
  getDatabase(): admin.database.Database {
    return this.database;
  }

  // Get reference to a specific path
  getRef(path: string): admin.database.Reference {
    return this.database.ref(path);
  }

  // Write data to a specific path
  async setData(path: string, data: any): Promise<void> {
    try {
      await this.database.ref(path).set(data);
      console.log(`Data written to ${path}`);
    } catch (error) {
      console.error('Error writing data:', error);
      throw error;
    }
  }

  // Update data at a specific path
  async updateData(path: string, data: any): Promise<void> {
    try {
      await this.database.ref(path).update(data);
      console.log(`Data updated at ${path}`);
    } catch (error) {
      console.error('Error updating data:', error);
      throw error;
    }
  }

  // Get data from a specific path
  async getData(path: string): Promise<any> {
    try {
      const snapshot = await this.database.ref(path).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Error reading data:', error);
      throw error;
    }
  }

  // Push data to a list (generates unique key)
  async pushData(path: string, data: any): Promise<string> {
    try {
      const ref = await this.database.ref(path).push(data);
      console.log(`Data pushed to ${path} with key: ${ref.key}`);
      return ref.key!;
    } catch (error) {
      console.error('Error pushing data:', error);
      throw error;
    }
  }

  // Delete data at a specific path
  async deleteData(path: string): Promise<void> {
    try {
      await this.database.ref(path).remove();
      console.log(`Data deleted at ${path}`);
    } catch (error) {
      console.error('Error deleting data:', error);
      throw error;
    }
  }

  // Listen to real-time changes
  onDataChange(path: string, callback: (data: any) => void): void {
    this.database.ref(path).on('value', (snapshot) => {
      callback(snapshot.val());
    });
  }

  // Listen to child added events
  onChildAdded(path: string, callback: (childSnapshot: admin.database.DataSnapshot) => void): void {
    this.database.ref(path).on('child_added', callback);
  }

  // Listen to child changed events
  onChildChanged(path: string, callback: (childSnapshot: admin.database.DataSnapshot) => void): void {
    this.database.ref(path).on('child_changed', callback);
  }

  // Listen to child removed events
  onChildRemoved(path: string, callback: (childSnapshot: admin.database.DataSnapshot) => void): void {
    this.database.ref(path).on('child_removed', callback);
  }

  // Stop listening to changes
  offDataChange(path: string): void {
    this.database.ref(path).off();
  }
}
