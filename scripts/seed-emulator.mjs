import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const DEV_CODE = 'devdevdevdevdevdevdevdevde';
const env = await initializeTestEnvironment({ projectId: 'demo-home-inventory', firestore: { host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), `households/${DEV_CODE}`), { name: '개발용 집', allowedNetworks: [], createdAt: Date.now() });
});
await env.cleanup();
console.log(`seeded households/${DEV_CODE}`);
