import { parseArgs } from 'util';
import * as fs from 'fs';
import * as path from 'path';

interface Config {
  baseUrl: string;
  apiToken: string;
}

let config: Config = {
  baseUrl: 'https://sample.runbook.jp',
  apiToken: ''
};

export function saveConfig(newConfig: Config) {
  // create directory if it doesn't exist
  if (!fs.existsSync(path.dirname(configFilePath))) {
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  }
  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
}

function upperSnakeToCamel(upperSnake: string) {
  const words = upperSnake.toLowerCase().split('_');
  return (
    words[0] +
    words
      .slice(1)
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  );
}

function kebabToCamel(kebab: string) {
  const words = kebab.toLowerCase().split('-');
  return (
    words[0] +
    words
      .slice(1)
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  );
}

function setConfigFile() {
  if (fs.existsSync(configFilePath)) {
    try {
      const fileContent = fs.readFileSync(configFilePath, 'utf-8');
      const fileConfig = JSON.parse(fileContent);
      config = { ...config, ...fileConfig };
    } catch {
      throw new Error('Failed to parse the config file.');
    }
  }
}

function setEnvironmentVariables() {
  const envVars = ['BASE_URL', 'API_TOKEN'];
  for (const envVar of envVars) {
    if (process.env[envVar]) {
      config = { ...config, [upperSnakeToCamel(envVar)]: process.env[envVar]! };
    }
  }
}

function setCommandlineArguments() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      'api-token': {
        type: 'string',
        short: 'n',
        multiple: false
      },
      'base-url': {
        type: 'string',
        short: 'h',
        multiple: false
      }
    }
  });

  for (const key of Object.keys(values)) {
    const k = key as keyof typeof values;
    const value = values[k];
    if (key && value) {
      config = { ...config, [kebabToCamel(key)]: value };
    }
  }
}

const configFilePath = path.join(__dirname, 'env', 'config.json');

export function loadConfig() {
  setConfigFile();

  setEnvironmentVariables();

  try {
    setCommandlineArguments();
  } catch {
    // Ignore errors
  }
  return config;
}

loadConfig();

export default config;
