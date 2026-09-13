import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import crypto from 'crypto';
import fs from 'fs';

const sk = generateSecretKey();
const pk = getPublicKey(sk);

const fileBuffer = fs.readFileSync('test.png');
const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

const eventTemplate = {
  kind: 27235,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['u', 'https://nostr.build/api/v2/upload/files'],
    ['method', 'POST'],
    ['payload', payloadHash]
  ],
  content: '',
};

const signedEvent = finalizeEvent(eventTemplate, sk);
const token = Buffer.from(JSON.stringify(signedEvent)).toString('base64');
console.log(token);
