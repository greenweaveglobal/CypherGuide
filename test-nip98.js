import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

const sk = generateSecretKey();
const pk = getPublicKey(sk);

const eventTemplate = {
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['u', 'https://nostr.build/api/v2/upload/files'],
    ['method', 'POST']
  ],
  content: '',
};

const signedEvent = finalizeEvent(eventTemplate, sk);
const token = Buffer.from(JSON.stringify(signedEvent)).toString('base64');
console.log(token);
