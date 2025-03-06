# Swickr End-to-End Encryption

This document outlines the end-to-end encryption (E2EE) implementation in Swickr, which ensures that messages can only be read by the intended recipients.

## Overview

Swickr uses a hybrid encryption approach combining asymmetric (RSA) and symmetric (AES) encryption:

1. Each user generates a public-private key pair
2. The public key is shared with the server and other users
3. The private key remains only on the user's device
4. For each message, a unique symmetric key is generated
5. The message is encrypted with this symmetric key
6. The symmetric key is encrypted with each recipient's public key
7. The encrypted message and encrypted keys are sent to the server

This approach provides strong security while maintaining performance for group conversations.

## Key Components

### Client-Side

- **encryptionService.js**: Core encryption functionality
- **messageService.js**: Integration with messaging system
- **socketService.js**: Real-time message handling

### Server-Side

- **Message Model**: Support for storing encrypted messages
- **User Model**: Storage of public keys
- **Database Schema**: Fields for encrypted content, IVs, and recipient keys

## Technical Implementation

### Key Generation

```javascript
// Generate a new key pair
const keyPair = await encryptionService.generateKeyPair();

// Store private key securely (client-side only)
localStorage.setItem('userKeys', JSON.stringify({
  privateKey: keyPair.privateKey,
  publicKey: keyPair.publicKey
}));

// Share public key with server
await api.post('/users/update-public-key', {
  publicKey: keyPair.publicKey
});
```

### Message Encryption

For each message:

1. Generate a random symmetric key (AES-GCM 256-bit)
2. Encrypt the message content with this key
3. Encrypt the symmetric key with each recipient's public key
4. Send the encrypted message and encrypted keys to the server

```javascript
// Encrypt a message for multiple recipients
const encryptedData = await encryptionService.encryptGroupMessage(
  content,
  recipients.map(m => ({ userId: m.userId, publicKey: m.publicKey }))
);

// Message payload with encrypted data
const payload = {
  conversationId,
  content: '',
  encryptedContent: encryptedData.encryptedMessage,
  iv: encryptedData.iv,
  recipientKeys: encryptedData.recipientKeys,
  isEncrypted: true
};
```

### Message Decryption

When receiving a message:

1. Extract the encrypted symmetric key for the current user
2. Decrypt the symmetric key using the user's private key
3. Use the decrypted symmetric key to decrypt the message content

```javascript
// Decrypt a message
const decryptedContent = await encryptionService.decryptGroupMessage(
  {
    encryptedMessage: message.encryptedContent,
    iv: message.iv,
    recipientKeys: message.recipientKeys
  },
  userId,
  privateKey
);
```

## Security Considerations

### Key Storage

Private keys are stored in the browser's localStorage. In a production environment, consider:

- Using more secure storage options (e.g., IndexedDB with encryption)
- Implementing key rotation policies
- Adding passphrase protection for keys

### Forward Secrecy

The current implementation does not provide perfect forward secrecy. Consider implementing:

- Ephemeral keys for each conversation
- Double Ratchet Algorithm (similar to Signal Protocol)

### Metadata Protection

While message content is encrypted, metadata (sender, recipient, timestamp) is not. Consider:

- Minimizing stored metadata
- Implementing secure deletion policies

## User Experience

### Key Management

Users should be prompted to generate encryption keys during account setup. The UI should:

- Guide users through the key generation process
- Explain the importance of device security
- Provide options for key backup (with appropriate warnings)

### Encryption Status Indicators

The UI should clearly indicate:

- When messages are encrypted
- When encryption fails or is unavailable
- Which conversations are fully encrypted

## Future Enhancements

1. **Multi-Device Support**: Implement secure key synchronization across user devices
2. **Key Verification**: Add support for verifying contact keys (e.g., QR codes, safety numbers)
3. **Perfect Forward Secrecy**: Implement the Double Ratchet Algorithm
4. **Secure Group Management**: Improve handling of group membership changes
5. **Encrypted Media**: Extend encryption to media attachments

## API Reference

See the `encryptionService.js` file for detailed documentation on all encryption-related methods.

## Testing

Comprehensive tests for the encryption system should include:

- Unit tests for encryption/decryption functions
- Integration tests for the messaging flow
- Security audits and penetration testing

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [RSA-OAEP](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#rsa-oaep)
- [AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm)
- [Signal Protocol](https://signal.org/docs/)
