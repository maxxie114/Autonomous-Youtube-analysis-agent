#!/usr/bin/env python3
"""Test script to determine the correct message format for Google ADK."""

import requests
import json
from pprint import pprint

BASE_URL = "http://localhost:8081"

def test_message_format():
    """Test different message formats to understand the correct structure."""
    
    # First create a session
    session_response = requests.post(
        f"{BASE_URL}/apps/ace_agent/users/test-user/sessions",
        json={}
    )
    session_data = session_response.json()
    session_id = session_data["id"]
    print(f"Created session: {session_id}")
    
    # Test different message formats
    test_formats = [
        {},
        {"text": "Hello"},
        {"parts": [{"text": "Hello"}]},
        {"role": "user", "parts": [{"text": "Hello"}]},
        {"author": "user", "content": "Hello"},
        {"user_content": "Hello"},
    ]
    
    for i, message_format in enumerate(test_formats):
        print(f"\nTest {i+1}: {message_format}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/run",
                json={
                    "appName": "ace_agent",
                    "userId": "test-user",
                    "sessionId": session_id,
                    "newMessage": message_format
                }
            )
            
            print(f"Status: {response.status_code}")
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    print("Error:", json.dumps(error_data, indent=2))
                except:
                    print("Error:", response.text)
            else:
                print("Success!")
                result = response.json()
                pprint(result)
                break
                
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    test_message_format()