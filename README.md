# Alphie XMTP Agent 🦊

Alphie XMTP Agent, a chatbot that can help you copy trade on as XMTP groupchat.

## Setup

1. Clone the repository:

```bash
git clone <repository-url> alphie-xmtp-agent
cd alphie-xmtp-agent
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables, copy and fill `.env.example` to `.env`

```bash
cp .env.example .env
vi .env
```

4. Generate keys:

```bash
pnpm run gen:keys
```

5. Run the server:

```bash
pnpm run start
```

## Development

Run the development server

```bash
pnpm run dev
```
