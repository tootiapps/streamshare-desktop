import { X509Certificate, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import forge from 'node-forge';

export interface TlsIdentity {
  certificate: string;
  privateKey: string;
  fingerprint: string;
}

export async function loadOrCreateTlsIdentity(path: string): Promise<TlsIdentity> {
  try {
    const stored = JSON.parse(await readFile(path, 'utf8')) as Pick<TlsIdentity, 'certificate' | 'privateKey'>;
    return withFingerprint(stored);
  } catch {
    const identity = createIdentity();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({
      certificate: identity.certificate,
      privateKey: identity.privateKey
    }), { mode: 0o600 });
    return identity;
  }
}

function createIdentity(): TlsIdentity {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32);
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date();
  certificate.validity.notAfter.setFullYear(certificate.validity.notAfter.getFullYear() + 10);
  const attributes = [{ name: 'commonName', value: 'Streamshare TV Client' }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'streamshare-tv.local' }] }
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return withFingerprint({
    certificate: forge.pki.certificateToPem(certificate),
    privateKey: forge.pki.privateKeyToPem(keys.privateKey)
  });
}

function withFingerprint(identity: Pick<TlsIdentity, 'certificate' | 'privateKey'>): TlsIdentity {
  const x509 = new X509Certificate(identity.certificate);
  return {
    ...identity,
    fingerprint: createHash('sha256').update(x509.raw).digest('hex')
  };
}
