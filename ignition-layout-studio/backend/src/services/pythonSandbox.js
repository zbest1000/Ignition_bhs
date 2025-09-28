const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./loggerService');
const errorService = require('./errorService');

class PythonSandbox {
  constructor(options = {}) {
    this.maxExecutionTime = options.maxExecutionTime || 30000; // 30 seconds
    this.maxMemoryUsage = options.maxMemoryUsage || 512; // 512MB
    this.maxCpuUsage = options.maxCpuUsage || 80; // 80% CPU
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxOutputSize = options.maxOutputSize || 1024 * 1024; // 1MB
    this.sandboxDir = options.sandboxDir || path.join(__dirname, '../sandbox');
    this.pythonPath = options.pythonPath || 'python3';
    
    // Ensure sandbox directory exists
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }
    
    // Restricted imports - only allow safe modules
    this.allowedModules = new Set([
      'math', 'random', 'datetime', 'json', 'csv', 'itertools',
      'collections', 'functools', 'operator', 'string', 'textwrap',
      'unicodedata', 'stringprep', 'fpformat', 'struct', 'codecs',
      'encodings', 'base64', 'binascii', 'quopri', 'uu', 'html',
      'xml.etree.ElementTree', 're', 'difflib', 'hashlib', 'hmac',
      'secrets', 'statistics', 'fractions', 'decimal', 'numbers',
      'cmath', 'bisect', 'heapq', 'array', 'weakref', 'types',
      'copy', 'pprint', 'reprlib', 'enum', 'graphlib'
    ]);
    
    // Dangerous patterns to block
    this.dangerousPatterns = [
      /import\s+os(?:\s|$|\.)/,
      /import\s+sys(?:\s|$|\.)/,
      /import\s+subprocess(?:\s|$|\.)/,
      /import\s+socket(?:\s|$|\.)/,
      /import\s+urllib(?:\s|$|\.)/,
      /import\s+requests(?:\s|$|\.)/,
      /import\s+http(?:\s|$|\.)/,
      /import\s+ftplib(?:\s|$|\.)/,
      /import\s+telnetlib(?:\s|$|\.)/,
      /import\s+smtplib(?:\s|$|\.)/,
      /import\s+imaplib(?:\s|$|\.)/,
      /import\s+poplib(?:\s|$|\.)/,
      /import\s+threading(?:\s|$|\.)/,
      /import\s+multiprocessing(?:\s|$|\.)/,
      /import\s+asyncio(?:\s|$|\.)/,
      /import\s+ctypes(?:\s|$|\.)/,
      /import\s+pickle(?:\s|$|\.)/,
      /import\s+marshal(?:\s|$|\.)/,
      /import\s+shelve(?:\s|$|\.)/,
      /import\s+dbm(?:\s|$|\.)/,
      /import\s+sqlite3(?:\s|$|\.)/,
      /import\s+tempfile(?:\s|$|\.)/,
      /import\s+shutil(?:\s|$|\.)/,
      /import\s+glob(?:\s|$|\.)/,
      /import\s+pathlib(?:\s|$|\.)/,
      /from\s+os\s+import/,
      /from\s+sys\s+import/,
      /from\s+subprocess\s+import/,
      /\b__import__\s*\(/,
      /\beval\s*\(/,
      /\bexec\s*\(/,
      /\bcompile\s*\(/,
      /\bopen\s*\(/,
      /\bfile\s*\(/,
      /\binput\s*\(/,
      /\braw_input\s*\(/,
      /\b__builtins__/,
      /\b__globals__/,
      /\b__locals__/,
      /\bgetattr\s*\(/,
      /\bsetattr\s*\(/,
      /\bdelattr\s*\(/,
      /\bhasattr\s*\(/,
      /\bdir\s*\(/,
      /\bvars\s*\(/,
      /\blocals\s*\(/,
      /\bglobals\s*\(/,
      /\bbreakpoint\s*\(/,
      /\bquit\s*\(/,
      /\bexit\s*\(/,
      /\bhelp\s*\(/,
      /\blicense\s*\(/,
      /\bcopyright\s*\(/,
      /\bcredits\s*\(/,
      /while\s+True\s*:/,
      /for\s+.*\s+in\s+.*:\s*while\s+True/,
      /\bclass\s+\w+\s*\(/,
      /\bdef\s+__\w+__\s*\(/
    ];
  }

  // Validate Python code for security
  validateCode(code) {
    const errors = [];
    
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }
    
    // Check for allowed imports
    const importMatches = code.match(/^(?:from\s+(\w+(?:\.\w+)*)\s+import|import\s+(\w+(?:\.\w+)*))/gm);
    if (importMatches) {
      for (const match of importMatches) {
        const moduleMatch = match.match(/(?:from\s+(\w+(?:\.\w+)*)\s+import|import\s+(\w+(?:\.\w+)*))/);
        const moduleName = moduleMatch[1] || moduleMatch[2];
        
        if (moduleName && !this.allowedModules.has(moduleName)) {
          errors.push(`Module '${moduleName}' is not allowed`);
        }
      }
    }
    
    // Check code length
    if (code.length > 50000) {
      errors.push('Code is too long (maximum 50KB)');
    }
    
    // Check for excessive loops
    const loopCount = (code.match(/\b(for|while)\b/g) || []).length;
    if (loopCount > 10) {
      errors.push('Too many loops detected (maximum 10)');
    }
    
    return errors;
  }

  // Create secure Python script wrapper
  createSecureScript(userCode, sessionId) {
    const secureWrapper = `
import sys
import signal
import resource
import time
import traceback
import json
from io import StringIO

# Set resource limits
try:
    # Memory limit: ${this.maxMemoryUsage}MB
    resource.setrlimit(resource.RLIMIT_AS, (${this.maxMemoryUsage * 1024 * 1024}, ${this.maxMemoryUsage * 1024 * 1024}))
    
    # CPU time limit: ${Math.floor(this.maxExecutionTime / 1000)} seconds
    resource.setrlimit(resource.RLIMIT_CPU, (${Math.floor(this.maxExecutionTime / 1000)}, ${Math.floor(this.maxExecutionTime / 1000)}))
    
    # File size limit: ${this.maxFileSize} bytes
    resource.setrlimit(resource.RLIMIT_FSIZE, (${this.maxFileSize}, ${this.maxFileSize}))
    
    # Process limit: 1 (no subprocesses)
    resource.setrlimit(resource.RLIMIT_NPROC, (1, 1))
except:
    pass

# Timeout handler
def timeout_handler(signum, frame):
    raise TimeoutError("Code execution timed out")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(${Math.floor(this.maxExecutionTime / 1000)})

# Capture stdout and stderr
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

# Restricted builtins
safe_builtins = {
    'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'callable',
    'chr', 'classmethod', 'complex', 'dict', 'divmod', 'enumerate', 'filter',
    'float', 'format', 'frozenset', 'hex', 'id', 'int', 'isinstance',
    'issubclass', 'iter', 'len', 'list', 'map', 'max', 'min', 'next',
    'object', 'oct', 'ord', 'pow', 'print', 'property', 'range', 'repr',
    'reversed', 'round', 'set', 'slice', 'sorted', 'staticmethod', 'str',
    'sum', 'super', 'tuple', 'type', 'zip', '__name__', '__doc__'
}

# Remove dangerous builtins
import builtins
for name in list(builtins.__dict__.keys()):
    if name not in safe_builtins:
        delattr(builtins, name)

start_time = time.time()
result = {
    'success': False,
    'output': '',
    'error': '',
    'execution_time': 0,
    'memory_usage': 0
}

try:
    # Execute user code
    exec("""${userCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
    
    result['success'] = True
    result['output'] = sys.stdout.getvalue()
    
except Exception as e:
    result['error'] = str(e)
    result['traceback'] = traceback.format_exc()
    
except TimeoutError as e:
    result['error'] = 'Execution timed out'
    
finally:
    # Restore stdout/stderr
    sys.stdout = old_stdout
    sys.stderr = old_stderr
    
    # Calculate execution time
    result['execution_time'] = time.time() - start_time
    
    # Get memory usage
    try:
        result['memory_usage'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    except:
        result['memory_usage'] = 0
    
    # Cancel alarm
    signal.alarm(0)
    
    # Output result as JSON
    print(json.dumps(result))
`;

    const scriptPath = path.join(this.sandboxDir, `script_${sessionId}.py`);
    fs.writeFileSync(scriptPath, secureWrapper);
    
    return scriptPath;
  }

  // Execute Python code securely
  async executeCode(code, sessionId = null) {
    const executionId = sessionId || crypto.randomUUID();
    
    try {
      // Validate code
      const validationErrors = this.validateCode(code);
      if (validationErrors.length > 0) {
        throw errorService.createError(
          'VALIDATION_ERROR',
          'Code validation failed',
          null,
          { errors: validationErrors }
        );
      }

      // Create secure script
      const scriptPath = this.createSecureScript(code, executionId);
      
      logger.info('Executing Python code', { 
        executionId, 
        codeLength: code.length,
        sessionId 
      });

      // Execute with timeout and resource limits
      const result = await this.runPythonScript(scriptPath, executionId);
      
      // Cleanup
      this.cleanup(scriptPath);
      
      return result;
      
    } catch (error) {
      logger.error('Python execution failed', { 
        executionId, 
        error: error.message,
        sessionId 
      });
      
      throw error;
    }
  }

  // Run Python script with process monitoring
  runPythonScript(scriptPath, executionId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let isResolved = false;
      
      const pythonProcess = spawn(this.pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.maxExecutionTime,
        killSignal: 'SIGKILL'
      });

      // Timeout handler
      const timeoutHandler = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          pythonProcess.kill('SIGKILL');
          reject(errorService.createError(
            'TIMEOUT_ERROR',
            'Code execution timed out',
            null,
            { executionId, timeout: this.maxExecutionTime }
          ));
        }
      }, this.maxExecutionTime);

      // Collect stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Check output size limit
        if (stdout.length > this.maxOutputSize) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutHandler);
            pythonProcess.kill('SIGKILL');
            reject(errorService.createError(
              'OUTPUT_TOO_LARGE',
              'Output size exceeded limit',
              null,
              { executionId, maxSize: this.maxOutputSize }
            ));
          }
        }
      });

      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      pythonProcess.on('close', (code, signal) => {
        if (isResolved) return;
        
        isResolved = true;
        clearTimeout(timeoutHandler);
        
        const executionTime = Date.now() - startTime;
        
        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          reject(errorService.createError(
            'EXECUTION_KILLED',
            'Code execution was terminated',
            null,
            { executionId, signal, executionTime }
          ));
          return;
        }
        
        try {
          // Parse result from stdout
          const result = JSON.parse(stdout);
          
          resolve({
            success: result.success,
            output: result.output || '',
            error: result.error || '',
            traceback: result.traceback || '',
            executionTime: result.execution_time * 1000, // Convert to ms
            memoryUsage: result.memory_usage,
            processExecutionTime: executionTime,
            exitCode: code,
            executionId
          });
          
        } catch (parseError) {
          // If JSON parsing fails, return raw output
          resolve({
            success: code === 0,
            output: stdout,
            error: stderr,
            traceback: '',
            executionTime: executionTime,
            memoryUsage: 0,
            processExecutionTime: executionTime,
            exitCode: code,
            executionId
          });
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        if (isResolved) return;
        
        isResolved = true;
        clearTimeout(timeoutHandler);
        
        reject(errorService.createError(
          'EXECUTION_ERROR',
          'Failed to execute Python code',
          null,
          { executionId, error: error.message }
        ));
      });
    });
  }

  // Cleanup temporary files
  cleanup(scriptPath) {
    try {
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    } catch (error) {
      logger.warn('Failed to cleanup script file', { 
        scriptPath, 
        error: error.message 
      });
    }
  }

  // Get sandbox statistics
  getStats() {
    return {
      maxExecutionTime: this.maxExecutionTime,
      maxMemoryUsage: this.maxMemoryUsage,
      maxCpuUsage: this.maxCpuUsage,
      maxFileSize: this.maxFileSize,
      maxOutputSize: this.maxOutputSize,
      allowedModulesCount: this.allowedModules.size,
      dangerousPatternsCount: this.dangerousPatterns.length,
      sandboxDir: this.sandboxDir
    };
  }

  // Update security settings
  updateSettings(settings) {
    if (settings.maxExecutionTime) this.maxExecutionTime = settings.maxExecutionTime;
    if (settings.maxMemoryUsage) this.maxMemoryUsage = settings.maxMemoryUsage;
    if (settings.maxCpuUsage) this.maxCpuUsage = settings.maxCpuUsage;
    if (settings.maxFileSize) this.maxFileSize = settings.maxFileSize;
    if (settings.maxOutputSize) this.maxOutputSize = settings.maxOutputSize;
    
    logger.info('Python sandbox settings updated', settings);
  }
}

// Export singleton instance
module.exports = new PythonSandbox(); 