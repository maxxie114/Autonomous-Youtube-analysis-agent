
#!/usr/bin/env python3
"""
An example of an ADK agent that analyzes YouTube video transcripts to provide strategic advice.
"""
import os
import json
from youtube_transcript_api import YouTubeTranscriptApi

from google_adk import (
    Tool,
    Agent,
    Stdio,
)



def get_youtube_transcript(video_id: str) -> str:
    """
    Fetches the transcript for a given YouTube video ID.

    :param video_id: The ID of the YouTube video (e.g., "X-h8-Hn3j8o").
    :return: The full transcript as a single string, or an error message.
    """
    print(f"Fetching transcript for video ID: {video_id}...")
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([item['text'] for item in transcript_list])
        print("Transcript fetched successfully.")
        return transcript
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return f"Error: Could not fetch transcript. {e}"



# --- Agent Setup ---

def main():
    """
    Main function to run the interactive YouTube generator.
    """
    if not os.getenv("OPENAI_API_KEY"):
        print("Please set OPENAI_API_KEY in your .env file to run this example.")
        return

    print("Initializing YouTube Analysis Agent...")

    # System prompt defining the agent's persona, goal, and interaction style.
    system_prompt_text = (
        "You are 'YT-Strategist', an expert YouTube content analyst. "
        "Your goal is to help creators improve their content by analyzing video transcripts. "
        "When given a transcript, you will provide a structured analysis covering: "
        "1. Content Summary, 2. Engagement Hooks, 3. Clarity & Pacing, and 4. Key Strengths & Weaknesses. "
        "Finally, you will offer 3-5 concrete, actionable recommendations for the creator's next video. "
        "Always ask for a YouTube video ID to begin your analysis."
    )

    # Define the tools the agent can use.
    tools = [
        Tool(
            name="get_youtube_transcript",
            description="Fetches the text transcript of a YouTube video using its video ID.",
            func=get_youtube_transcript,
        )
    ]

    agent = Agent(
        "YT-Strategist",
        system_prompt=system_prompt_text,
        tools=tools,
        model="gpt-4o",
    )

    # --- Interactive Loop ---
    print("\nAgent is ready. Type 'exit' to quit.")
    
    # Initialize messages with the system prompt
    interface = Stdio(agent)
    interface.start()

if __name__ == "__main__":
    main()
