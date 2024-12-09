const EventEmitter = require('events');
const WebSocket = require('ws');
const MySQLResponseHandler = require('./mysql-handler');
const Logger = require('./logger');

class ConnectionManager extends EventEmitter {
  constructor(serverName, options = {}) {
    super();
    this.serverName = serverName;
    this.options = {
      maxRetries: options.maxRetries || 5,
      timeout: options.timeout || 5000,
      retryDelay: options.retryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 30000,
      logLevel: options.logLevel || 'info'
    };
    this.connected = false;
    this.retryCount = 0;
    this.mysqlHandler = serverName === 'mysql-mcp-server' ? new MySQLResponseHandler() : null;
    this.errorCount = 0;
    this.lastErrorTime = null;
    this.logger = new Logger({ logLevel: this.options.logLevel });
  }

  async connect() {
    while (this.retryCount < this.options.maxRetries) {
      try {
        await this._attemptConnection();
        this.connected = true;
        this.retryCount = 0;
        this.emit('connected');
        this.logger.info(`Successfully connected to ${this.serverName}`);
        return true;
      } catch (error) {
        this.retryCount++;
        const delay = this._calculateRetryDelay();
        this._logError('Connection failed', error);
        this.emit('connectionFailed', error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    const error = new Error(`Failed to connect to ${this.serverName} after ${this.options.maxRetries} attempts`);
    this.emit('maxRetriesExceeded', error);
    throw error;
  }

  async _attemptConnection() {
    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(`ws://localhost:${this._getPortForServer()}`);
        
        const timeoutId = setTimeout(() => {
          socket.close();
          reject(new Error(`Connection timeout for ${this.serverName}`));
        }, this.options.timeout);

        socket.onopen = () => {
          clearTimeout(timeoutId);
          this.socket = socket;
          this._setupSocketHandlers();
          resolve();
        };

        socket.onerror = (error) => {
          clearTimeout(timeoutId);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  _setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.onmessage = async (event) => {
      try {
        let data = event.data;
        
        if (this.mysqlHandler) {
          data = await this.mysqlHandler.handleData(data);
          if (!data) return; // Skip if no complete data yet
        }

        this.emit('data', data);
      } catch (error) {
        this._logError('Message handling error', error);
        this.emit('error', error);
      }
    };

    this.socket.onclose = () => {
      this.connected = false;
      this.emit('disconnected');
      this._handleDisconnection();
    };

    this.socket.onerror = (error) => {
      this._logError('Socket error', error);
      this.emit('error', error);
    };
  }

  async send(data) {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.socket.send(payload, (error) => {
          if (error) {
            if (error.code === 'EPIPE') {
              this.connected = false;
              this._handleDisconnection()
                .then(() => this.send(data))
                .then(resolve)
                .catch(reject);
            } else {
              this._logError('Send error', error);
              reject(error);
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        this._logError('Send error', error);
        reject(error);
      }
    });
  }

  _getPortForServer() {
    const portMap = {
      'fetch': 3000,
      'mysql-mcp-server': 3306
    };
    return portMap[this.serverName] || 3000;
  }

  _calculateRetryDelay() {
    return Math.min(
      this.options.retryDelay * Math.pow(2, this.retryCount - 1),
      this.options.maxRetryDelay
    );
  }

  _logError(context, error) {
    this.errorCount++;
    this.lastErrorTime = Date.now();
    this.logger.error(`[${this.serverName}] ${context}:`, { error: error.message });
    
    if (this.errorCount >= 5) {
      this.emit('errorThreshold', {
        server: this.serverName,
        errorCount: this.errorCount,
        lastError: error
      });
    }
  }

  async _handleDisconnection() {
    if (!this.connected) {
      this.logger.info(`Attempting to reconnect to ${this.serverName}...`);
      this.retryCount = 0;
      try {
        await this.connect();
      } catch (error) {
        this._logError('Reconnection failed', error);
      }
    }
  }

  _resetErrorCount() {
    this.errorCount = 0;
    this.lastErrorTime = null;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this.connected = false;
    this.emit('disconnected');
    this.logger.info(`Disconnected from ${this.serverName}`);
  }

  getStatus() {
    return {
      serverName: this.serverName,
      connected: this.connected,
      retryCount: this.retryCount,
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime
    };
  }
}

module.exports = ConnectionManager;