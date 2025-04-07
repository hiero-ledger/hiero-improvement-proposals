const fs = require('fs');
const https = require('https');

/**
 * Validates a HIP file by sending it to the Vertesia API endpoint.
 * 
 * @async
 * @function validateHIP
 * @param {string} hipPath - Path to the HIP file.
 */
async function validateHIP(hipPath) {
  try {
    const hip = hipPath || process.argv[2];
    
    // Skip validation for hipstable files
    if (hip.includes('hipstable')) {
      console.log("Great Success");
      return;
    }
    
    console.log(`Validating ${hip}`);
    
    // Read the HIP file content
    const draftHip = fs.readFileSync(hip, 'utf8');
    
    // Prepare the request data
    const requestData = JSON.stringify({
      interaction: "Evaluate_HIP_Format",
      data: {
        hip_spec: ".",
        draft_hip: draftHip
      }
    });

    // Send request to the Vertesia API using native https
    const result = await makeRequest(requestData);
    
    if (result.is_valid) {
      console.log("Great Success");
      return;
    } else {
      // If validation fails, collect all issues
      const errs = result.issues.map(issue => 
        new Error(`${issue.field}: ${issue.issue}. Suggestion: ${issue.suggestion}`)
      );
      
      throw errs;
    }
  } catch (error) {
    if (Array.isArray(error)) {
      console.log('You must correct the following header errors to pass validation: ', error);
    } else {
      console.log('Error:', error.message || error);
    }
    process.exit(1);
  }
}

/**
 * Makes an HTTPS request to the Vertesia API.
 * 
 * @async
 * @function makeRequest
 * @param {string} data - The request payload.
 * @returns {Promise<Object>} The parsed response.
 */
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'studio-server-production.api.vertesia.io',
      port: 443,
      path: '/api/v1/execute/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Bearer sk-10d0ff210ff2e3b58ef67cf2b2889476'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.result) {
            resolve(parsedData.result);
          } else {
            reject(new Error('Invalid API response format'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Execute the validation function
validateHIP().catch(error => {
  console.log(error);
  process.exit(1);
});