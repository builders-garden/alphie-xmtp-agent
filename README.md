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

3. Set up environment variables, copy and fill all the variables `.env.example` to `.env`

```bash
cp .env.example .env
vi .env
```

4. Generate wallet keys and encryption key:

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

## Testing

To run the copy trade webhook tests, start the server first and then just run this on your terminal:

```bash
# sell 1 $USDC for $ZORA on Base Mainnet
curl -X POST http://localhost:3001/api/v1/copy-trade \
  -H "x-api-secret: $API_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user": {"fid": 189636, "username": "bianc8.eth"}, "transaction": {"chainId": 8453, "transactionHash": "0x3d4d44b40b5bbbd659c64ce16277f5a0ef2390afc9126b4932de7bb320769649", "buyToken": "0x1111111111166b7FE7bd91427724B487980aFc69", "sellToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "sellAmount": "1"}}'
```

or use the bash script:

```bash
bash tests/test-webhook.sh
```