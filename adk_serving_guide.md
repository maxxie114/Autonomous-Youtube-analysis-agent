To connect your JavaScript frontend to the ADK agent system, you'll be interacting with the **REST API** that your ADK server exposes.

The `adk web` command you're running bundles a developer UI *and* a backend API server. For your custom frontend, you just need to connect to that API server.

Here are the two main ways to do this, from the direct "do-it-yourself" method to the recommended, easier framework method.

-----

### 1\. The Direct API Method (The "How it Works")

Your ADK backend is a FastAPI server. You can connect to its API endpoints directly from your JavaScript frontend using `fetch` or any HTTP client.

1.  **Run the API Server:** Instead of `adk web`, you can run just the API server. In your terminal, run:

    ```bash
    adk api_server
    ```

    This will start the server, typically on `http://localhost:8000`.

2.  **Find the API Docs:** While the server is running, you can see all available API endpoints and test them by visiting:

      * **`http://localhost:8000/docs`**

3.  **Key Endpoints to Use:**

      * **`/run_sse` (Recommended for Chat):** This is the most important endpoint for a conversational UI. You make a `POST` request to it, and it streams back the agent's response as **Server-Sent Events (SSE)**. This is how you get the real-time, token-by-token streaming effect.
      * **`/run`:** A simpler `POST` endpoint for single, non-streaming requests and responses.
      * **`/sessions`:** A set of endpoints (`POST`, `GET`, etc.) to create and manage conversation sessions so the agent remembers the chat history.

**Example: Connecting with `EventSource` (for SSE)**

Here is a simplified JavaScript example of how you might connect to the streaming endpoint:

```javascript
// This is a conceptual example. You'll need to manage session_id, etc.
const question = "What is this video about?";
const agentName = "YouTubeAssistant"; // The 'name' from your youtube_agent.py
const sessionId = "some-unique-session-id";
const userId = "some-unique-user-id";

// Use EventSource to connect to the Server-Sent Events (SSE) stream
const eventSource = new EventSource(
  `http://localhost:8000/run_sse?app_name=${agentName}&session_id=${sessionId}&user_id=${userId}&new_message=${encodeURIComponent(
    question
  )}`
);

// Listen for messages
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // 'content' will contain the streamed text chunks
  if (data.content && data.content.parts) {
    console.log("Chunk:", data.content.parts[0].text);
    // You would append this chunk to your UI here
  }
};

// Handle errors and completion
eventSource.onerror = (err) => {
  console.error("EventSource failed:", err);
  eventSource.close();
};
```

-----

### 2\. The Recommended Method (The "Easier Way")

The community and official examples *strongly* recommend **not** doing the above manually. Instead, you should use libraries designed to handle all the complexity of streaming, state, and UI binding for you.

The recommended stack is **CopilotKit** + **AG-UI**.

  * **CopilotKit:** A frontend, open-source framework for building in-app AI chatbots and agents. It gives you React components (like `useChat`) that handle all the frontend logic.
  * **AG-UI:** A protocol that acts as the "bridge" between CopilotKit and your ADK backend, ensuring they speak the same language.

**How to get started with this stack:**

The easiest way is to use the official starter template. This will create a new full-stack project with the ADK backend and a Next.js (React) frontend already connected.

1.  **Run the CLI command:** In your terminal, run this command:
    ```bash
    npx copilotkit@latest create -f adk
    ```
2.  **Follow the prompts:** It will ask for a project name and set up a complete, working example.
3.  **Inspect the code:** You can then look at the frontend code (likely in `frontend/src/app/page.tsx`) to see how the `useChat` hook is used, and copy that logic into your existing JavaScript frontend.

This recommended path saves you from manually handling API calls, parsing SSE streams, and managing conversational state.

Would you like me to find a more detailed example of using the `useChat` hook from CopilotKit?