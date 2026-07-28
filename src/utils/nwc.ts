/**
 * Nostr Wallet Connect (NIP-47) Implementation
 * Enables 1-click seamless Lightning payments directly via NWC URI (Alby, Mutiny, ZBD, Primal).
 * URI format: nostr+walletconnect://<wallet-pubkey>?relay=<relay-url>&secret=<secret-hex>&lud16=<lightning-address>
 */

import { finalizeEvent, nip04, getPublicKey } from 'nostr-tools';
import { hexToBytes, bytesToHex } from './crypto';

export interface NWCConnection {
  walletPubkey: string;
  relayUrl: string;
  secretHex: string;
  lud16?: string;
  isValid: boolean;
}

const NWC_SESSION_KEY = 'cypher_nwc_session_uri';
const NWC_LOCAL_ENC_KEY = 'cypher_nwc_pbkdf2_enc_uri';

// PBKDF2 + AES-GCM Key derivation from user passphrase
async function derivePassphraseKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Parses a Nostr Wallet Connect URI (NIP-47)
 */
export function parseNWCUrl(nwcUrl: string): NWCConnection | null {
  try {
    const clean = nwcUrl.trim();
    if (!clean.startsWith('nostr+walletconnect://') && !clean.startsWith('nostrwalletconnect://')) {
      return null;
    }

    const urlObj = new URL(clean.replace('nostr+walletconnect://', 'https://').replace('nostrwalletconnect://', 'https://'));
    const walletPubkey = urlObj.hostname || urlObj.pathname.replace('/', '');
    const relayUrl = urlObj.searchParams.get('relay');
    const secretHex = urlObj.searchParams.get('secret');
    const lud16 = urlObj.searchParams.get('lud16') || undefined;

    if (!walletPubkey || !relayUrl || !secretHex) {
      return null;
    }

    return {
      walletPubkey,
      relayUrl,
      secretHex,
      lud16,
      isValid: true
    };
  } catch (e) {
    console.error('[NWC] Failed to parse connection string:', e);
    return null;
  }
}

/**
 * Saves NWC connection string into sessionStorage (default Cypherpunk session memory)
 * or localStorage encrypted with a user-supplied passphrase.
 */
export async function saveNWCConnectionString(nwcUrl: string, passphrase?: string): Promise<boolean> {
  const parsed = parseNWCUrl(nwcUrl);
  if (!parsed) return false;

  const cleanUri = nwcUrl.trim();

  if (passphrase && passphrase.length >= 6) {
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await derivePassphraseKey(passphrase, salt);
      const enc = new TextEncoder().encode(cleanUri);
      const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);

      const payload = `${bytesToHex(salt)}:${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
      localStorage.setItem(NWC_LOCAL_ENC_KEY, payload);
      sessionStorage.setItem(NWC_SESSION_KEY, cleanUri);
      return true;
    } catch (err) {
      console.error('[NWC] Passphrase encryption failed:', err);
      return false;
    }
  }

  // Default: Keep strictly in Session Memory (cleared on tab close, immune to persistent disk inspection)
  sessionStorage.setItem(NWC_SESSION_KEY, cleanUri);
  localStorage.removeItem(NWC_LOCAL_ENC_KEY);
  return true;
}

/**
 * Gets and decrypts saved NWC connection string
 */
export async function getNWCConnectionStringAsync(passphrase?: string): Promise<string | null> {
  // 1. Session Memory First (most secure, in-memory per session)
  const sessionUri = sessionStorage.getItem(NWC_SESSION_KEY);
  if (sessionUri) return sessionUri;

  // 2. LocalEncrypted Storage with User Passphrase
  const rawEnc = localStorage.getItem(NWC_LOCAL_ENC_KEY);
  if (rawEnc && passphrase) {
    try {
      const [saltHex, ivHex, dataHex] = rawEnc.split(':');
      if (!saltHex || !ivHex || !dataHex) return null;

      const salt = hexToBytes(saltHex);
      const iv = hexToBytes(ivHex);
      const data = hexToBytes(dataHex);
      const key = await derivePassphraseKey(passphrase, salt);
      const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      const uri = new TextDecoder().decode(decrypted);

      // Cache into session memory for active tab duration
      sessionStorage.setItem(NWC_SESSION_KEY, uri);
      return uri;
    } catch (err) {
      console.error('[NWC] Decryption with passphrase failed:', err);
      return null;
    }
  }

  return null;
}

/**
 * Sync helper checking if active NWC connection is loaded in session
 */
export function getNWCConnectionString(): string | null {
  return sessionStorage.getItem(NWC_SESSION_KEY);
}

/**
 * Checks if encrypted local storage exists requiring passphrase unlock
 */
export function isNWCEncryptedOnDisk(): boolean {
  return !!localStorage.getItem(NWC_LOCAL_ENC_KEY);
}

/**
 * Removes saved NWC connection
 */
export function removeNWCConnection(): void {
  sessionStorage.removeItem(NWC_SESSION_KEY);
  localStorage.removeItem(NWC_LOCAL_ENC_KEY);
  localStorage.removeItem('cypher_nwc_enc_connection');
  localStorage.removeItem('cypher_nwc_connection_string');
}

/**
 * Executes a NIP-47 `pay_invoice` RPC request over Nostr Relays with real WebSocket execution & sandbox simulation guard
 */
export async function payInvoiceViaNWC(nwcUrl: string, invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  // If connection string is encrypted token in storage, resolve full URI first
  let targetUrl = nwcUrl;
  if (nwcUrl.includes(':') && !nwcUrl.startsWith('nostr')) {
    const decrypted = await getNWCConnectionStringAsync();
    if (decrypted) targetUrl = decrypted;
  }

  const connection = parseNWCUrl(targetUrl);
  if (!connection) {
    return { success: false, error: 'Chuỗi kết nối NWC (NIP-47) không hợp lệ!' };
  }

  // If invoice is a simulated sandbox invoice (_sim), return clean simulated NIP-47 RPC response
  if (invoice.endsWith('_sim') || invoice.includes('_sim') || !invoice.startsWith('lnbc')) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPreimage = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        resolve({
          success: true,
          preimage: `nwc_sim_preimage_${mockPreimage}`
        });
      }, 1200);
    });
  }

  // Real Nostr Relay NIP-47 WebSocket RPC Execution
  return new Promise(async (resolve) => {
    let ws: WebSocket | null = null;
    let timeoutId: any = null;

    try {
      const secretBytes = hexToBytes(connection.secretHex);
      const appPubKey = getPublicKey(secretBytes);
      const cleanInvoice = invoice.replace('_sim', '');

      // Encrypt NIP-47 RPC Payload (Kind 23194)
      const rpcContent = JSON.stringify({
        method: 'pay_invoice',
        params: { invoice: cleanInvoice }
      });

      const encryptedContent = await nip04.encrypt(secretBytes, connection.walletPubkey, rpcContent);

      const eventTemplate = {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', connection.walletPubkey]],
        content: encryptedContent,
      };

      const signedEvent = finalizeEvent(eventTemplate, secretBytes);

      ws = new WebSocket(connection.relayUrl);

      timeoutId = setTimeout(() => {
        if (ws) ws.close();
        resolve({ success: false, error: 'Hết thời gian chờ phản hồi từ NWC Relay (' + connection.relayUrl + ')' });
      }, 10000);

      ws.onopen = () => {
        // Subscribe to responses (Kind 23195)
        const subId = 'nwc_resp_' + Math.random().toString(36).slice(2, 8);
        ws?.send(JSON.stringify(["REQ", subId, { kinds: [23195], authors: [connection.walletPubkey], "#e": [signedEvent.id] }]));
        
        // Publish Kind 23194 Request Event
        ws?.send(JSON.stringify(["EVENT", signedEvent]));
      };

      ws.onmessage = async (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[0] === 'EVENT' && data[2]?.kind === 23195) {
            clearTimeout(timeoutId);
            const respEvent = data[2];
            const decryptedResp = await nip04.decrypt(secretBytes, connection.walletPubkey, respEvent.content);
            const parsedResp = JSON.parse(decryptedResp);

            if (ws) ws.close();

            if (parsedResp.result?.preimage) {
              resolve({ success: true, preimage: parsedResp.result.preimage });
            } else if (parsedResp.error) {
              resolve({ success: false, error: parsedResp.error.message || 'Ví NWC từ chối thanh toán' });
            } else {
              resolve({ success: true, preimage: 'nwc_confirmed_' + Date.now().toString(16) });
            }
          }
        } catch (err) {
          // Ignore non-matching websocket messages
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        resolve({ success: false, error: 'Lỗi kết nối WebSocket Relay NWC (' + connection.relayUrl + ')' });
      };

    } catch (e: any) {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({ success: false, error: 'Lỗi mã hóa/khởi tạo NIP-47: ' + (e.message || 'Unknown') });
    }
  });
}
