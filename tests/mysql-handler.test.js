const MySQLResponseHandler = require('../src/mysql-handler');

describe('MySQLResponseHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new MySQLResponseHandler();
  });

  test('should handle valid JSON data', async () => {
    const data = JSON.stringify({ id: 1, name: 'test' });
    const result = await handler.handleData(data);
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  test('should handle malformed data', async () => {
    const data = 'malformed{json';
    const result = await handler.handleData(data);
    expect(result).toHaveProperty('message');
  });

  // Add more tests as needed
});