import { JWT } from 'google-auth-library';
import axios, { AxiosInstance } from 'axios';

export interface AuthConfig {
  gcpServiceAccountJson: string;
  functionBaseUrl: string;
}

export class GoogleAuthClient {
  private jwt: JWT;
  private client: AxiosInstance;

  constructor(config: AuthConfig) {
    const serviceAccount = JSON.parse(config.gcpServiceAccountJson);
    
    this.jwt = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      keyId: serviceAccount.private_key_id,
      scopes: [],
    });

    this.client = axios.create({
      baseURL: config.functionBaseUrl,
    });

    this.client.interceptors.request.use(async (requestConfig) => {
      const idToken = await this.jwt.fetchIdToken(config.functionBaseUrl);
      requestConfig.headers.Authorization = `Bearer ${idToken}`;
      return requestConfig;
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}