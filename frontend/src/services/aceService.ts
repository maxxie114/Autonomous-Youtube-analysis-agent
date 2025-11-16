export interface AgentRequest {
  prompt: string;
  image?: string;
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "active" | "complete";
  description?: string;
}

export interface AgentResponse {
  content: string;
  channels?: Array<{
    name: string;
    subscribers: string;
    totalViews: string;
    videoCount: number;
    channelId: string;
  }>;
  workflow?: WorkflowStep[];
}

class AceService {
  private baseUrl = 'http://localhost:8082';

  private async getAppId(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/apps`);
      if (!res.ok) {
        throw new Error(`Failed to list apps: ${res.status}`);
      }

      const apps = await res.json();
      if (!Array.isArray(apps) || apps.length === 0) {
        throw new Error('No apps found on ADK server');
      }

      // Prefer a youtube or ace app if present
      const preferred = apps.find((a: any) => {
        const id = String(a.id || '').toLowerCase();
        const name = String(a.name || '').toLowerCase();
        return id.includes('youtube') || name.includes('youtube') || id.includes('ace') || name.includes('ace');
      });

      if (preferred) return preferred.id || preferred.name;

      // fallback to the first app id
      return apps[0].id || apps[0].name;
    } catch (err) {
      console.warn('Could not auto-detect app id, falling back to "ace_agent"', err);
      return 'ace_agent';
    }
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Determine app id and create a session
      const appId = await this.getAppId();
      // First create a session
      const sessionResponse = await fetch(`${this.baseUrl}/apps/${encodeURIComponent(appId)}/users/frontend-user/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to create session: ${sessionResponse.status}`);
      }

      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.id;

      // Send message to agent using correct Google ADK format
      const response = await fetch(`${this.baseUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appName: appId || 'ace_agent',
          userId: 'frontend-user',
          sessionId: sessionId,
          newMessage: {
            parts: [
              {
                text: request.prompt
              }
            ]
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.formatResponse(data);
    } catch (error) {
      console.error('Error calling ACE agent:', error);
      throw new Error('Failed to get response from ACE agent');
    }
  }

  private formatResponse(data: any): AgentResponse {
    // Format the response from ACE system to match our frontend expectations
    // ACE returns an array of events, we need to find the Generator output
    const events = Array.isArray(data) ? data : [data];
    
    // Find the Generator event with the actual response
    const generatorEvent = events.find(event => 
      event.author === 'Generator' && 
      event.actions?.stateDelta?.generator_output
    );
    
    if (generatorEvent) {
      const output = generatorEvent.actions.stateDelta.generator_output;
      return {
        content: output.content || "Processing complete",
        channels: output.channels || [],
        workflow: []
      };
    }
    
    // Fallback for other response formats
    return {
      content: data.content || data.response || "Processing complete",
      channels: data.channels || [],
      workflow: data.workflow || []
    };
  }

  async streamRequest(
    request: AgentRequest, 
    onWorkflowUpdate?: (workflow: WorkflowStep[]) => void
  ): Promise<AgentResponse> {
    // For now, simulate streaming with the regular request
    // This can be enhanced later with actual streaming support
    const workflow: WorkflowStep[] = [
      { id: "1", label: "Analyzing query", status: "pending" },
      { id: "2", label: "Calling YouTube tools", status: "pending" },
      { id: "3", label: "Processing results", status: "pending" },
      { id: "4", label: "Formatting response", status: "pending" },
    ];

    if (onWorkflowUpdate) {
      onWorkflowUpdate(workflow);
    }

    // Simulate workflow progression
    for (let i = 0; i < workflow.length; i++) {
      workflow[i].status = "active";
      if (onWorkflowUpdate) {
        onWorkflowUpdate([...workflow]);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      workflow[i].status = "complete";
      workflow[i].description = "Completed successfully";
      if (onWorkflowUpdate) {
        onWorkflowUpdate([...workflow]);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const response = await this.sendRequest(request);
    return {
      ...response,
      workflow
    };
  }
}

export const aceService = new AceService();