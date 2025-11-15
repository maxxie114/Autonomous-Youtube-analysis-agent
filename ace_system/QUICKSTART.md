# Quick Start Guide

Get ACE-ADK running in 5 minutes.

## 1. Install uv (if needed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 2. Install Dependencies

```bash
uv sync
```

## 3. Configure API Key

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your Google AI API key
# Get your key from: https://aistudio.google.com/app/apikey
```

Edit `.env`:
```env
GOOGLE_API_KEY=your_api_key_here
```

## 4. Run the Application

```bash
uv run main.py
```

## 5. Open in Browser

Navigate to: **http://localhost:8080**

## That's it! 🎉

The agent will:
1. **Generate** answers using the playbook
2. **Reflect** on the output quality
3. **Curate** the playbook with new insights

---

For detailed setup instructions, see [SETUP.md](SETUP.md)
