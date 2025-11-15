# ACE-ADK Setup Guide

Complete guide to set up and run the ACE-ADK (Agentic Context Engineering - Agent Development Kit) application.

## Prerequisites

- **Python 3.13+** (check with `python --version`)
- **uv** package manager (recommended) or pip
- **Google AI API Key** (get from https://aistudio.google.com/app/apikey)

## Installation

### Option 1: Using uv (Recommended)

1. **Install uv** (if not already installed):
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or using pip
pip install uv
```

2. **Clone and navigate to the project**:
```bash
cd ace-adk
```

3. **Install dependencies**:
```bash
uv sync
```

### Option 2: Using pip

1. **Create a virtual environment**:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

## Configuration

1. **Create environment file**:
```bash
cp .env.example .env
```

2. **Edit `.env` and add your API key**:
```bash
# Open .env in your editor
nano .env  # or vim, code, etc.
```

3. **Set your Google AI API Key**:
```env
GOOGLE_API_KEY=your_actual_api_key_here
GOOGLE_GENAI_USE_VERTEXAI=False
```

### Optional Configuration

You can customize models and server settings in `.env`:

```env
# Model Configuration (optional)
GENERATOR_MODEL=gemini-2.0-flash-exp
REFLECTOR_MODEL=gemini-2.0-flash-exp
CURATOR_MODEL=gemini-2.0-flash-exp

# Server Configuration (optional)
SERVE_WEB_INTERFACE=True
RELOAD_AGENTS=True
```

## Running the Application

### Using uv:
```bash
uv run main.py
```

### Using Python directly:
```bash
# Make sure virtual environment is activated
python main.py
```

### Expected Output:
```
INFO - Starting ACE-ADK server on http://0.0.0.0:8080
INFO - Agent directory: /path/to/agents
INFO - Web interface: True
INFO - Reload agents: True
```

## Accessing the Application

Once running, open your browser and navigate to:
- **Web UI**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

## Testing the Agent

1. Open the web interface at http://localhost:8080
2. Enter a query in the chat interface
3. The agent will execute the ACE cycle:
   - **Generator**: Creates an answer using the playbook
   - **Reflector**: Analyzes the output and tags bullets
   - **Curator**: Updates the playbook with new insights

## Troubleshooting

### Issue: "Module not found" errors
**Solution**: Ensure dependencies are installed:
```bash
uv sync  # or pip install -r requirements.txt
```

### Issue: "API key not found" error
**Solution**: 
1. Check that `.env` file exists
2. Verify `GOOGLE_API_KEY` is set correctly
3. Ensure no extra spaces around the key

### Issue: Port 8080 already in use
**Solution**: Change the port in `main.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8081)  # Use different port
```

### Issue: Python version mismatch
**Solution**: 
1. Check Python version: `python --version`
2. Install Python 3.13+ from https://www.python.org/downloads/
3. Recreate virtual environment with correct version

## Development

### Running with auto-reload:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Code formatting:
```bash
uv run ruff format .
```

### Code linting:
```bash
uv run ruff check .
```

## Project Structure

```
ace-adk/
├── agents/
│   └── ace_agent/
│       ├── agent.py           # Main agent orchestration
│       ├── schemas/           # Data models
│       │   ├── delta.py       # Delta operations
│       │   └── playbook.py    # Playbook structure
│       └── sub_agents/        # Sub-agent implementations
│           ├── generator.py   # Answer generation
│           ├── reflector.py   # Output reflection
│           └── curator.py     # Playbook curation
├── config.py                  # Configuration management
├── main.py                    # Application entry point
├── pyproject.toml            # Project metadata
├── requirements.txt          # Dependencies
├── .env                      # Environment variables (create this)
└── .env.example             # Environment template
```

## Next Steps

- Read the [README.md](README.md) for architecture details
- Check [CHANGELOG.md](CHANGELOG.md) for recent updates
- Explore the agent implementations in `agents/ace_agent/`
- Customize prompts and models in the sub-agent files

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the README.md for architecture details
3. Check Google ADK documentation: https://github.com/google/adk

## License

MIT License - See LICENSE file for details
