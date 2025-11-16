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
  reasoning?: string[];
  toolsUsed?: string[];
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
  // Use a proxied path in development (`/adk`) so requests go through
  // Vite's dev server proxy and avoid CORS issues. In production this
  // can be set to the real ADK API host.
  private baseUrl = '/adk';

  private async getAppId(): Promise<string> {
    // Avoid calling /apps from the browser (some ADK servers don't expose it
    // or CORS preflights fail). Use the known app id used in test scripts.
    return 'youtube_agent';
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Determine app id and create a session (test_adk.py style uses explicit session id in the path)
      const appId = await this.getAppId();
      const userId = typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `frontend-user-${Date.now()}-${Math.floor(Math.random()*10000)}`;
      const sessionId = `session-${Date.now()}-${Math.floor(Math.random()*10000)}`;

      const createSessionUrl = `${this.baseUrl}/apps/${encodeURIComponent(appId)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`;
      console.debug('[aceService] Creating session', { createSessionUrl });
      const sessionResponse = await fetch(createSessionUrl, { method: 'POST' });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to create session: ${sessionResponse.status}`);
      }

      // Send message to agent. Use the ADK-served `/run_sse` endpoint
      // and snake_case keys (app_name, user_id, session_id, new_message)
      // which match the ADK serving guide / dev-ui patterns. The
      // endpoint streams Server-Sent-Event style data; here we read
      // the stream and pick the last `data:` payload as JSON.
      const runUrl = `${this.baseUrl}/run_sse`;

      // Use the same payload style as `test_adk.py` (camelCase keys and streaming: true)
      // Perform a POST to `/run_sse` with JSON body. We use the Vite
      // dev server proxy (`/adk`) so this is same-origin during
      // development and the browser will not perform a CORS preflight.
      const payload = {
        appName: appId || 'youtube_agent',
        userId,
        sessionId,
        newMessage: { role: 'user', parts: [{ text: request.prompt }] },
        streaming: true,
      };

      console.debug('[aceService] POST /run_sse', { runUrl, payload });

      let runResp: Response;
      try {
        runResp = await fetch(runUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('[aceService] Network error posting to run_sse', err);
        // Return a safe fallback response to avoid crashing the UI
        return { content: 'Network error sending request to agent', channels: [], workflow: [] };
      }

      if (!runResp.ok) {
        throw new Error(`HTTP error! status: ${runResp.status}`);
      }

      // If the server provides a streaming body, read it and extract
      // the last `data:` event (SSE). If no stream, fall back to JSON.
      try {
        const reader: any = runResp.body?.getReader && runResp.body.getReader();
        if (reader) {
          const decoder = new TextDecoder('utf-8');
          let done = false;
          let buffer = '';
          let lastData: string | null = null;
          let lastGood: any | null = null;

          while (!done) {
            // read chunk
            // eslint-disable-next-line no-await-in-loop
            const { value, done: d } = await reader.read();
            done = !!d;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              console.debug('[aceService] received chunk', chunk.slice(0, 200));
              buffer += chunk;

              // SSE events: lines starting with "data:"
              const parts = buffer.split(/\r?\n/);
              // keep the last incomplete line in buffer
              buffer = parts.pop() || '';
              for (const line of parts) {
                if (line.startsWith('data:')) {
                  const payload = line.replace(/^data:\s*/, '');
                  lastData = payload;
                  try {
                    const maybe = JSON.parse(payload);
                    // Heuristic: keep the last meaningful content event, not error/meta
                    const hasAnswer = typeof maybe?.answer === 'string' && maybe.answer.trim().length > 0;
                    const hasChannels = Array.isArray(maybe?.channels) && maybe.channels.length > 0;
                    const hasGenerator = !!maybe?.actions?.stateDelta?.generator_output;
                    const hasContentParts = Array.isArray(maybe?.content?.parts) && maybe.content.parts.length > 0;
                    const isErrorOnly = (!!maybe?.errorCode || !!maybe?.finishReason) && !hasAnswer && !hasChannels && !hasGenerator && !hasContentParts;
                    if (!isErrorOnly && (hasAnswer || hasChannels || hasGenerator || hasContentParts)) {
                      lastGood = maybe;
                    }
                  } catch {
                    // ignore parse error for interim lines
                  }
                }
              }
            }
          }

           // parse lastData if present
           // prefer last meaningful event if available
           if (lastGood) {
             try {
               return this.formatResponse(lastGood);
             } catch (fmtErr) {
               console.error('[aceService] formatResponse error (lastGood)', fmtErr, { lastGood });
               return { content: 'Agent returned unexpected format', channels: [], workflow: [] };
             }
           }
           if (lastData) {
             try {
               const parsed = JSON.parse(lastData);
               // If the last event is only an error/meta frame without content, try full-body JSON below
               const hasAnyContent = typeof parsed?.answer === 'string' || Array.isArray(parsed?.channels) || parsed?.actions?.stateDelta?.generator_output || (Array.isArray(parsed?.content?.parts) && parsed.content.parts.length > 0);
               if (!hasAnyContent && (parsed?.errorCode || parsed?.finishReason)) {
                 // fall through to JSON body read
               } else {
                 try {
                   return this.formatResponse(parsed);
                 } catch (fmtErr) {
                   console.error('[aceService] formatResponse error', fmtErr, { parsed });
                   return { content: 'Agent returned unexpected format', channels: [], workflow: [] };
                 }
               }
             } catch (e) {
               // If parsing fails, fall through to try full-body JSON below
               console.warn('[aceService] Failed to parse SSE data payload, falling back', e);
             }
           }
        }
      } catch (e) {
        // streaming read failure — we'll try to parse JSON normally below
        console.warn('Error reading run_sse stream, falling back to JSON', e);
      }

      // Fallback: try to parse the whole response as JSON
      try {
        const data = await runResp.json();
        try {
          return this.formatResponse(data);
        } catch (fmtErr) {
          console.error('[aceService] formatResponse error on JSON fallback', fmtErr, { data });
          return { content: 'Agent returned unexpected format', channels: [], workflow: [] };
        }
      } catch (err) {
        console.error('[aceService] Failed to parse run_sse response as JSON', err);
        return { content: 'Failed to parse agent response', channels: [], workflow: [] };
      }
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
    
    const extractText = (obj: any): string => {
      if (!obj && obj !== 0) return '';
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

      // If object has `parts` array, join text-like parts
      if (Array.isArray(obj.parts)) {
        return obj.parts.map((p: any) => {
          if (!p) return '';
          if (typeof p === 'string') return p;
          if (typeof p.text === 'string') return p.text;
          if (p.functionResponse && p.functionResponse.response) {
            const resp = p.functionResponse.response;
            if (typeof resp === 'string') return resp;
            if (typeof resp.answer === 'string') return resp.answer;
            return JSON.stringify(resp);
          }
          if (p.functionCall && p.functionCall.args) {
            const args = p.functionCall.args;
            if (typeof args.answer === 'string') return args.answer;
            return JSON.stringify(args);
          }
          return JSON.stringify(p);
        }).join('\n').trim();
      }

      if (typeof obj.content === 'string') return obj.content;
      if (obj.content && typeof obj.content === 'object') return extractText(obj.content);
      if (typeof obj.response === 'string') return obj.response;
      if (obj.response && typeof obj.response === 'object') return extractText(obj.response);
      if (typeof obj.answer === 'string') return obj.answer;
      return JSON.stringify(obj);
    };

    if (generatorEvent) {
      const output = generatorEvent.actions.stateDelta.generator_output;
      // If model provided a top-level `answer`, prefer that (it's already
      // human-readable). Otherwise fall back to extracted text.
      let contentText = '';
      if (output && typeof output === 'object' && typeof output.answer === 'string') {
        contentText = output.answer;
      } else {
        contentText = extractText(output) || '';
      }

      // If the output includes structured channel results, and contentText
      // is empty, try to build a concise human-readable listing.
      if ((!contentText || contentText.trim() === '') && Array.isArray(output.channels) && output.channels.length > 0) {
        contentText = output.channels.map((c: any) => `* ${c.name}: ${c.subscribers || c.subscriberCount || ''}`).join('\n');
      }

      // If the model returned a JSON string inside the text (common when
      // the model serializes structured output into a text part), try to
      // parse it and prefer `answer`/`reasoning` fields from that nested
      // object.
      const tryParseNested = (text: string): { contentText: string; nestedReasoning?: string[] } => {
        if (!text) return { contentText: text };
        const t = text.trim();
        if (!(t.startsWith('{') || t.startsWith('['))) return { contentText: text };
        try {
          const parsedInner = JSON.parse(t);
          // If parsedInner is an object with answer, use it
          if (parsedInner && typeof parsedInner === 'object') {
            if (typeof parsedInner.answer === 'string') {
              const r: string[] | undefined = Array.isArray(parsedInner.reasoning)
                ? parsedInner.reasoning.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x)))
                : undefined;
              return { contentText: parsedInner.answer, nestedReasoning: r };
            }
            // If parsedInner itself looks like the full response object
            // with channels, build a simple listing
            if (Array.isArray(parsedInner.channels) && parsedInner.channels.length > 0) {
              const list = parsedInner.channels.map((c: any) => `* ${c.name}: ${c.subscribers || c.subscriberCount || ''}`).join('\n');
              const r: string[] | undefined = Array.isArray(parsedInner.reasoning)
                ? parsedInner.reasoning.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x)))
                : undefined;
              return { contentText: list, nestedReasoning: r };
            }
          }
        } catch (e) {
          // ignore parse errors
        }
        return { contentText: text };
      };

      const nestedTry = tryParseNested(contentText);
      if (nestedTry.nestedReasoning && nestedTry.nestedReasoning.length) {
        // prepend nested reasoning to reasoningArr
        // but ensure we have reasoningArr available
        if (nestedTry.nestedReasoning.length) {
          // if reasoningArr was empty, set it
        }
      }
      if (nestedTry.contentText && nestedTry.contentText !== contentText) {
        contentText = nestedTry.contentText;
        if (nestedTry.nestedReasoning && nestedTry.nestedReasoning.length) {
          // merge nested reasoning into reasoningArr
          // (we'll include them when returning below)
          // ensure reasoningArr exists in scope by recomputing below
        }
      }

      const reasoningArr: string[] = [];
      const toolsArr: string[] = [];
      if (output && typeof output === 'object') {
        if (Array.isArray(output.reasoning)) {
          for (const r of output.reasoning) {
            if (typeof r === 'string') reasoningArr.push(r);
            else reasoningArr.push(JSON.stringify(r));
          }
        }
        if (!reasoningArr.length && Array.isArray(output.usageReasoning)) {
          for (const r of output.usageReasoning) {
            if (typeof r === 'string') reasoningArr.push(r);
            else reasoningArr.push(JSON.stringify(r));
          }
        }
        // tools used
        if (Array.isArray((output as any).tools_used)) {
          for (const t of (output as any).tools_used) {
            if (typeof t === 'string') toolsArr.push(t);
            else toolsArr.push(JSON.stringify(t));
          }
        } else if (Array.isArray((output as any).toolsUsed)) {
          for (const t of (output as any).toolsUsed) {
            if (typeof t === 'string') toolsArr.push(t);
            else toolsArr.push(JSON.stringify(t));
          }
        }
        // If nested JSON provided additional reasoning, try to parse and merge
        try {
          if (typeof contentText === 'string') {
            const nested = ((): string[] | undefined => {
              const t = contentText.trim();
              if (t.startsWith('{') || t.startsWith('[')) {
                try {
                  const p = JSON.parse(t);
                  if (p && typeof p === 'object' && Array.isArray(p.reasoning)) {
                    return p.reasoning.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x)));
                  }
                } catch (e) {
                  // ignore
                }
              }
              return undefined;
            })();
            if (nested && nested.length) {
              for (const r of nested) reasoningArr.push(r);
            }
            // nested tools
            const nestedTools = ((): string[] | undefined => {
              const t = contentText.trim();
              if (t.startsWith('{') || t.startsWith('[')) {
                try {
                  const p = JSON.parse(t);
                  if (p && typeof p === 'object' && Array.isArray((p as any).tools_used)) {
                    return (p as any).tools_used.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x)));
                  }
                } catch (e) {
                  // ignore
                }
              }
              return undefined;
            })();
            if (nestedTools && nestedTools.length) {
              for (const t of nestedTools) toolsArr.push(t);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // If contentText looks like a bullet list of channels, try to parse
      // it into structured channel objects so the UI can render ChannelCards.
      const parseChannelsFromText = (text: string) => {
        if (!text) return undefined;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const channels: any[] = [];
        for (const line of lines) {
          // match markdown bullets like `* Name: 123.0K subscribers` or `- Name (123.0K)`
          const bulletMatch = line.replace(/^[-*+]+\s*/, '');
          // remove bold markers
          const noBold = bulletMatch.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          // try `Name: COUNT`
          const colonIdx = noBold.indexOf(':');
          if (colonIdx > 0) {
            const name = noBold.slice(0, colonIdx).trim();
            const rest = noBold.slice(colonIdx + 1).trim();
            channels.push({ name, subscribers: rest, totalViews: '', videoCount: 0, channelId: name });
            continue;
          }
          // try `Name (COUNT)`
          const paren = noBold.match(/^(.*?)\s*\(([^)]+)\)$/);
          if (paren) {
            channels.push({ name: paren[1].trim(), subscribers: paren[2].trim(), totalViews: '', videoCount: 0, channelId: paren[1].trim() });
            continue;
          }
          // fallback: if line contains a number, attempt split by last space
          const parts = noBold.split(/\s+-\s+|\s+—\s+|\s+–\s+/);
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const subs = parts.slice(1).join(' - ').trim();
            channels.push({ name, subscribers: subs, totalViews: '', videoCount: 0, channelId: name });
            continue;
          }
        }
        return channels.length ? channels : undefined;
      };

      const parsedChannels = parseChannelsFromText(contentText || '');
      const finalChannels = output.channels && output.channels.length ? output.channels : parsedChannels;

      // If we parsed channels, set a concise header as content
      const finalContent = finalChannels && finalChannels.length ? `${finalChannels.length} channels found:` : (contentText || 'Processing complete');

      return {
        content: finalContent,
        channels: finalChannels || [],
        workflow: [],
        reasoning: reasoningArr.length ? reasoningArr : undefined,
        toolsUsed: toolsArr.length ? toolsArr : undefined,
      };
    }
    
    // Fallback for other response formats
    // Extract top-level reasoning if present
    const topReasoning: string[] | undefined = (() => {
      if (data && typeof data === 'object') {
        if (Array.isArray(data.reasoning)) return data.reasoning.map((r: any) => (typeof r === 'string' ? r : JSON.stringify(r)));
        if (Array.isArray(data.usageReasoning)) return data.usageReasoning.map((r: any) => (typeof r === 'string' ? r : JSON.stringify(r)));
      }
      return undefined;
    })();

    const topTools: string[] | undefined = (() => {
      if (data && typeof data === 'object') {
        if (Array.isArray((data as any).tools_used)) return (data as any).tools_used.map((t: any) => (typeof t === 'string' ? t : JSON.stringify(t)));
        if (Array.isArray((data as any).toolsUsed)) return (data as any).toolsUsed.map((t: any) => (typeof t === 'string' ? t : JSON.stringify(t)));
      }
      return undefined;
    })();

    // If the top-level response includes an `answer` field, prefer it and also
    // try parsing channels from the answer markdown into structured data.
    if (data && typeof data === 'object' && typeof data.answer === 'string') {
      const answerText = data.answer as string;
      const parseChannelsFromText = (text: string) => {
        if (!text) return undefined;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const channels: any[] = [];
        for (const line of lines) {
          if (!/^[-*+]/.test(line)) continue; // only parse bullet lines
          const bullet = line.replace(/^[-*+]+\s*/, '');
          const noBold = bullet.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
          // Pattern: Name (COUNT subscribers): description
          const m1 = noBold.match(/^(.*?)\s*\(([^)]+?)\)\s*:(.*)$/);
          if (m1) {
            const name = m1[1].trim();
            const subs = m1[2].replace(/\s*subscribers?\s*/i, '').trim();
            channels.push({ name, subscribers: subs || m1[2].trim(), totalViews: '', videoCount: 0, channelId: name });
            continue;
          }
          // Pattern: Name (COUNT subscribers)
          const m2 = noBold.match(/^(.*?)\s*\(([^)]+?)\)\s*$/);
          if (m2) {
            const name = m2[1].trim();
            const subs = m2[2].replace(/\s*subscribers?\s*/i, '').trim();
            channels.push({ name, subscribers: subs || m2[2].trim(), totalViews: '', videoCount: 0, channelId: name });
            continue;
          }
          // Pattern: Name: COUNT subscribers
          const colonIdx = noBold.indexOf(':');
          if (colonIdx > 0) {
            const name = noBold.slice(0, colonIdx).trim();
            const rest = noBold.slice(colonIdx + 1).trim();
            const subsOnly = rest.replace(/\s*subscribers?\s*/i, '').trim();
            channels.push({ name, subscribers: subsOnly || rest, totalViews: '', videoCount: 0, channelId: name });
            continue;
          }
        }
        return channels.length ? channels : undefined;
      };

      const parsedChannels = parseChannelsFromText(answerText);
      const finalContent = parsedChannels && parsedChannels.length ? `${parsedChannels.length} channels found:` : answerText;
      return {
        content: finalContent,
        channels: parsedChannels || data.channels || [],
        workflow: data.workflow || [],
        reasoning: topReasoning,
        toolsUsed: topTools,
      };
    }

    // Fallback path: if `data` or extracted text looks like a JSON string, prefer its `answer`
    let fallbackContent = extractText(data) || 'Processing complete';
    let fallbackReasoning = topReasoning;
    let fallbackTools = topTools;
    try {
      const trimmed = typeof fallbackContent === 'string' ? fallbackContent.trim() : '';
      if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.answer === 'string') fallbackContent = parsed.answer;
          if (!fallbackReasoning && Array.isArray(parsed.reasoning)) fallbackReasoning = parsed.reasoning.map((r: any) => (typeof r === 'string' ? r : JSON.stringify(r)));
          if (!fallbackTools && Array.isArray(parsed.tools_used)) fallbackTools = parsed.tools_used.map((t: any) => (typeof t === 'string' ? t : JSON.stringify(t)));
        }
      }
    } catch {}

    // Try to derive channels from fallbackContent as well
    const parseChannelsFromText2 = (text: string) => {
      if (!text) return undefined;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const channels: any[] = [];
      for (const line of lines) {
        if (!/^[-*+]/.test(line)) continue;
        const bullet = line.replace(/^[-*+]+\s*/, '');
        const noBold = bullet.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        const m1 = noBold.match(/^(.*?)\s*\(([^)]+?)\)\s*:(.*)$/);
        if (m1) {
          const name = m1[1].trim();
          const subs = m1[2].replace(/\s*subscribers?\s*/i, '').trim();
          channels.push({ name, subscribers: subs || m1[2].trim(), totalViews: '', videoCount: 0, channelId: name });
          continue;
        }
        const m2 = noBold.match(/^(.*?)\s*\(([^)]+?)\)\s*$/);
        if (m2) {
          const name = m2[1].trim();
          const subs = m2[2].replace(/\s*subscribers?\s*/i, '').trim();
          channels.push({ name, subscribers: subs || m2[2].trim(), totalViews: '', videoCount: 0, channelId: name });
          continue;
        }
        const colonIdx = noBold.indexOf(':');
        if (colonIdx > 0) {
          const name = noBold.slice(0, colonIdx).trim();
          const rest = noBold.slice(colonIdx + 1).trim();
          const subsOnly = rest.replace(/\s*subscribers?\s*/i, '').trim();
          channels.push({ name, subscribers: subsOnly || rest, totalViews: '', videoCount: 0, channelId: name });
          continue;
        }
      }
      return channels.length ? channels : undefined;
    };

    const parsedChannels2 = parseChannelsFromText2(fallbackContent);
    const finalContent2 = parsedChannels2 && parsedChannels2.length ? `${parsedChannels2.length} channels found:` : fallbackContent;

    return {
      content: finalContent2,
      channels: parsedChannels2 || data.channels || [],
      workflow: data.workflow || [],
      reasoning: fallbackReasoning,
      toolsUsed: fallbackTools,
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