import { Keypair, rpc } from '@stellar/stellar-sdk';

const sponsor = Keypair.random();
await fetch(`https://friendbot.stellar.org/?addr=${sponsor.publicKey()}`);
const server = new rpc.Server('https://soroban-testnet.stellar.org');
let funded = false;
for (let i = 0; i < 30 && !funded; i++) {
  try {
    await server.getAccount(sponsor.publicKey());
    funded = true;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!funded) throw new Error('sponsor funded but not visible on the Soroban RPC after 30s');
const sourceSecret = sponsor.secret();

// --- added by the agent (not in the skill file): print + persist the sponsor so later scripts can reuse it ---
import { writeFileSync } from "node:fs";
console.log("sponsor public key:", sponsor.publicKey());
writeFileSync("sponsor.json", JSON.stringify({ publicKey: sponsor.publicKey(), secret: sourceSecret }, null, 2));
console.log("funded:", funded, "| wrote sponsor.json");
