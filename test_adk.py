import requests
import json
import uuid

# --- Configuration ---
APP_NAME = "youtube_agent"
USER_ID = f"test-user-{uuid.uuid4()}"
SESSION_ID = f"test-session-{uuid.uuid4()}"
QUESTION = "Search for the 5 most popular minecraft youtube channel with more than 1M sub"

BASE_URL = "http://localhost:8000"
CREATE_SESSION_URL = f"{BASE_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{SESSION_ID}"
RUN_SSE_URL = f"{BASE_URL}/run_sse"

run_response = None  # Define at the top level
try:
    # -----------------------------------------------------------------
    # STEP 1: CREATE THE SESSION (Same as before)
    # -----------------------------------------------------------------

    print(f"--- Step 1: Creating session ---")
    print(f"URL: {CREATE_SESSION_URL}")

    session_payload = {"key1": "value1", "key2": 42} 
    
    response = requests.post(CREATE_SESSION_URL, json=session_payload)
    response.raise_for_status() 
    print(f"Session created successfully: {SESSION_ID}\n")
    
    # -----------------------------------------------------------------
    # STEP 2: RUN THE AGENT (The Corrected Streaming Way)
    # -----------------------------------------------------------------

    print(f"--- Step 2: Querying agent (streaming) ---")
    print(f"URL: {RUN_SSE_URL}")
    print(f"Question: {QUESTION}\n")

    run_payload = {
        "appName": APP_NAME,
        "userId": USER_ID,
        "sessionId": SESSION_ID,
        "newMessage": {
            "role": "user",
            "parts": [
                {
                    "text": QUESTION
                }
            ]
        },
        "streaming": True  # <-- We must set this to True!
    }
    
    print(f"Sending payload: {json.dumps(run_payload, indent=2)}\n")
    print("--- Agent Stream (raw SSE events) ---")

    # Use a 'with' statement to handle the streaming connection
    with requests.post(RUN_SSE_URL, json=run_payload, stream=True) as run_response:
        run_response.raise_for_status()
        
        # Loop over the response line by line as it arrives
        for line in run_response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                
                # We only care about the lines that are data
                if line_str.startswith('data:'):
                    print(line_str)
                    
                    # Optional: Parse the JSON from the data chunk
                    # data_chunk = line_str[5:].strip()
                    # if data_chunk:
                    #     try:
                    #         json_data = json.loads(data_chunk)
                    #         # you can inspect json_data here
                    #     except:
                    #         pass # Not all data chunks are JSON

    print("\n--- Stream finished ---")

# --- Error Handling ---
except requests.exceptions.HTTPError as http_err:
    print(f"\nHTTP error occurred: {http_err}")
    if http_err.response is not None:
        print("Response body:", http_err.response.text)
        
except requests.exceptions.ConnectionError as conn_err:
    print(f"\nConnection error: Is the 'adk api_server' running?")

except Exception as err:
    print(f"\nAn (other) error occurred: {err}")