import Config from '../config';

describe('Default config', function () {
  it('success', async () => {
    const config = new Config();
    expect(config.apiToken).toBe('');
    expect(config.baseUrl).toBe('https://sample.runbook.jp');
  });
});

describe('Load config from file', function () {
  it('success', async () => {
    const config = new Config();
    config.saveConfig({
      apiToken: 'file_token',
      baseUrl: 'https://filetest.runbook.jp'
    });
    const newConfig = new Config();
    expect(newConfig.apiToken).toBe('file_token');
    expect(newConfig.baseUrl).toBe('https://filetest.runbook.jp');
    config.clearConfig();
  });
});

describe('Load config from environment variables', function () {
  it('success', async () => {
    process.env.RUNBOOK_BASE_URL = 'https://envtest.runbook.jp';
    process.env.RUNBOOK_API_TOKEN = 'env_token';
    const newConfig = new Config();
    expect(newConfig.apiToken).toBe('env_token');
    expect(newConfig.baseUrl).toBe('https://envtest.runbook.jp');
  });
});

describe('Load config from commandline arguments', function () {
  it('success', async () => {
    process.argv.push('--api-token', 'cmd_token');
    process.argv.push('--base-url', 'https://cmdtest.runbook.jp');
    const newConfig = new Config();
    expect(newConfig.apiToken).toBe('cmd_token');
    expect(newConfig.baseUrl).toBe('https://cmdtest.runbook.jp');
  });
});
