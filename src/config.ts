import { parseArgs } from 'util';
import * as fs from 'fs';
import * as path from 'path';

interface ConfigData {
  baseUrl: string;
  apiToken: string;
  prefix?: string;
}

class Config {
  private config: ConfigData;
  private configFilePath: string;

  constructor() {
    this.configFilePath = path.join(__dirname, 'env', 'config.json');
    this.config = {
      baseUrl: 'https://sample.runbook.jp',
      apiToken: ''
    };
    this.loadConfig();
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get apiToken(): string {
    return this.config.apiToken;
  }

  get prefix(): string | undefined {
    return this.config.prefix;
  }

  saveConfig(newConfig: ConfigData): void {
    if (!fs.existsSync(path.dirname(this.configFilePath))) {
      fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(newConfig, null, 2));
    this.config = { ...this.config, ...newConfig };
  }

  clearConfig(): void {
    if (fs.existsSync(this.configFilePath)) {
      fs.unlinkSync(this.configFilePath);
    }
    this.config = {
      baseUrl: 'https://sample.runbook.jp',
      apiToken: ''
    };
  }

  private upperSnakeToCamel(upperSnake: string): string {
    const words = upperSnake.toLowerCase().split('_');
    return (
      words[0] +
      words
        .slice(1)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
    );
  }

  private kebabToCamel(kebab: string): string {
    const words = kebab.toLowerCase().split('-');
    return (
      words[0] +
      words
        .slice(1)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
    );
  }

  private setConfigFile(): void {
    if (fs.existsSync(this.configFilePath)) {
      try {
        const fileContent = fs.readFileSync(this.configFilePath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = { ...this.config, ...fileConfig };
      } catch {
        throw new Error('Failed to parse the config file.');
      }
    }
  }

  private setEnvironmentVariables(): void {
    const envVars = ['BASE_URL', 'API_TOKEN', 'PREFIX'];
    for (const envVar of envVars) {
      const envName = `RUNBOOK_${envVar}`;
      if (process.env[envName]) {
        this.config = {
          ...this.config,
          [this.upperSnakeToCamel(envVar)]: process.env[envName]!
        };
      }
    }
  }

  private setCommandlineArguments(): void {
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
        },
        prefix: {
          type: 'string',
          short: 'p',
          multiple: false
        }
      }
    });

    for (const key of Object.keys(values)) {
      const k = key as keyof typeof values;
      const value = values[k];
      if (key && value) {
        this.config = { ...this.config, [this.kebabToCamel(key)]: value };
      }
    }
  }

  private loadConfig(): void {
    this.setConfigFile();
    this.setEnvironmentVariables();

    try {
      this.setCommandlineArguments();
    } catch {
      // Ignore errors
    }
  }
}

export default Config;
