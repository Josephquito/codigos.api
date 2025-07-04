// src/auth/auth.service.ts
interface OAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { Credentials } from 'google-auth-library';

@Injectable()
export class AuthService {
  private SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
  private credentialsPath = path.join(
    process.cwd(),
    'src',
    'auth',
    'credentials.json',
  );
  private tokenDir = path.join(process.cwd(), 'src', 'auth', 'tokens');

  constructor() {
    if (!fs.existsSync(this.tokenDir)) {
      fs.mkdirSync(this.tokenDir);
    }
  }

  getOAuthClient() {
    const content = fs.readFileSync(this.credentialsPath, 'utf8');
    const credentials = JSON.parse(content) as { web: OAuthCredentials };
    const { client_id, client_secret, redirect_uris } = credentials.web;

    return new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0], // http://localhost:3000/auth/google/callback
    );
  }

  generateAuthUrl(email: string) {
    const oauth2Client = this.getOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      state: email, // Para saber qué correo está autorizando
    });
  }

  async getTokenFromCode(code: string, email: string) {
    const oauth2Client = this.getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    this.saveToken(email, tokens);
    return tokens;
  }

  saveToken(email: string, tokens: any) {
    const file = path.join(this.tokenDir, `${email}.json`);
    fs.writeFileSync(file, JSON.stringify(tokens));
  }

  loadToken(email: string) {
    const file = path.join(this.tokenDir, `${email}.json`);
    if (!fs.existsSync(file)) return null;

    const oauth2Client = this.getOAuthClient();
    const tokens = JSON.parse(fs.readFileSync(file, 'utf8')) as Credentials;
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }
}
