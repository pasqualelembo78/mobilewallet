"use strict";

const axios = require("axios");
const { generateKeyDerivation, underivePublicKey } = require("./CryptoWrapper");
const { isInputUnlocked } = require("./Utilities");
const { Config } = require("./Config");

async function calculateOnChainBalance(wallet) {
    const PRIVATE_VIEW_KEY = wallet.privateViewKey;
    const PUBLIC_SPEND_KEY = wallet.publicSpendKey;

    const response = await axios.post(
        "http://127.0.0.1:17081/getwalletsyncdata",
        {
            blockCount: 100,
            blockHashCheckpoints: [],
            skipCoinbaseTransactions: false,
            startHeight: 0,
            startTimestamp: 0
        }
    );

    let unlocked = 0;
    let locked = 0;
    const config = new Config();

    for (const block of response.data.items) {
        const txs = [];
        if (block.coinbaseTX) txs.push(block.coinbaseTX);
        if (block.transactions) txs.push(...block.transactions);

        for (const tx of txs) {
            const derivation = await generateKeyDerivation(
                tx.txPublicKey,
                PRIVATE_VIEW_KEY,
                config
            );

            for (let i = 0; i < tx.outputs.length; i++) {
                const output = tx.outputs[i];

                const recovered = await underivePublicKey(
                    derivation,
                    i,
                    output.key,
                    config
                );

                if (recovered === PUBLIC_SPEND_KEY) {
                    const unlockedNow = isInputUnlocked(
                        tx.unlockTime,
                        block.blockHeight
                    );

                    if (unlockedNow) unlocked += output.amount;
                    else locked += output.amount;
                }
            }
        }
    }

    return [unlocked, locked];
}

module.exports = { calculateOnChainBalance };
