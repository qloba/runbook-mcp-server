import fs from 'fs';
import path from 'path';

interface Config {
  baseUrl: string;
  apiToken: string;
}

const configFilePath = path.join(__dirname, 'env', 'config.json');

let config: Config;

if (fs.existsSync(configFilePath)) {
  try {
    const fileContent = fs.readFileSync(configFilePath, 'utf-8');
    config = JSON.parse(fileContent);
  } catch {
    throw new Error('Failed to parse the config file.');
  }
} else {
  config = {
    baseUrl: process.env.BASE_URL!,
    apiToken: process.env.API_TOKEN!
  };
}

export function saveConfig(newConfig: Config) {
  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
}

export default config;
