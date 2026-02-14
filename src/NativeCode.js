// Copyright (C) 2018-2019, Zpalmtree
//
// Please see the included LICENSE file for more information.

'use strict';

import { NativeModules } from 'react-native';
import { TransactionInput } from 'kryptokrona-wallet-backend-js';

/**
 * NativeCode.js
 *
 * Wrapper JS per NativeModules.TurtleCoin.
 * - Fornisce le funzioni crittografiche già presenti
 * - Aggiunge wrapper per secretKey <-> public e letture spendKey/publicSpendKey
 *
 * NOTE: le funzioni realmente crittografiche vengono eseguite nel modulo native.
 * Se un metodo non è presente in NativeModules.TurtleCoin il wrapper solleverà
 * un errore leggibile (o restituirà null dove indicato).
 */

/* ------------------------------------------------------
   Helper: verifica esistenza metodo native e invoke
   ------------------------------------------------------ */
function assertNativeMethod(name) {
    if (!NativeModules || !NativeModules.TurtleCoin || typeof NativeModules.TurtleCoin[name] !== 'function') {
        throw new Error(`Metodo native mancante: TurtleCoin.${name} — implementalo nel modulo native`);
    }
}

/* -----------------------
   Crypto / key wrappers
   ----------------------- */

export async function generateKeyImage(publicEphemeral, privateEphemeral) {
    assertNativeMethod('generateKeyImage');
    return NativeModules.TurtleCoin.generateKeyImage(publicEphemeral, privateEphemeral);
}

export async function deriveSecretKey(derivation, outputIndex, privateSpendKey) {
    assertNativeMethod('deriveSecretKey');
    return NativeModules.TurtleCoin.deriveSecretKey(derivation, { outputIndex }, privateSpendKey);
}

export async function derivePublicKey(derivation, outputIndex, publicSpendKey) {
    assertNativeMethod('derivePublicKey');
    return NativeModules.TurtleCoin.derivePublicKey(derivation, { outputIndex }, publicSpendKey);
}

export async function generateKeyDerivation(transactionPublicKey, privateViewKey) {
    assertNativeMethod('generateKeyDerivation');
    return NativeModules.TurtleCoin.generateKeyDerivation(transactionPublicKey, privateViewKey);
}

export async function generateRingSignatures(transactionPrefixHash, keyImage, inputKeys, privateKey, realIndex) {
    assertNativeMethod('generateRingSignatures');
    return NativeModules.TurtleCoin.generateRingSignatures(
        transactionPrefixHash, keyImage, inputKeys, privateKey, { realIndex }
    );
}

export async function checkRingSignature(transactionPrefixHash, keyImage, publicKeys, signatures) {
    assertNativeMethod('checkRingSignature');
    return NativeModules.TurtleCoin.checkRingSignature(transactionPrefixHash, keyImage, publicKeys, signatures);
}

/* -----------------------
   New: secretKey <-> public wrappers
   ----------------------- */

/**
 * Deriva la public key (hex) dalla private key (hex) tramite native.
 * Lancia errore se il metodo native non è disponibile.
 */
export async function secretKeyToPublicKey(privateSpendKey) {
    assertNativeMethod('secretKeyToPublicKey');
    return NativeModules.TurtleCoin.secretKeyToPublicKey(privateSpendKey);
}

/**
 * Legge direttamente la public spend key dal wallet native (se il native la espone).
 * Ritorna la chiave (string hex) o lancia errore se il metodo non esiste.
 */
export async function getPublicSpendKey() {
    assertNativeMethod('getPublicSpendKey');
    return NativeModules.TurtleCoin.getPublicSpendKey();
}

/**
 * Legge la private spend key dal wallet native (se esposta).
 * ATTENZIONE: operazione sensibile per sicurezza; implementala solo se necessaria.
 */
export async function getPrivateSpendKey() {
    assertNativeMethod('getPrivateSpendKey');
    return NativeModules.TurtleCoin.getPrivateSpendKey();
}

/**
 * Fallback generico: getSpendKey (alcune implementazioni forniscono solo questo).
 */
export async function getSpendKey() {
    assertNativeMethod('getSpendKey');
    return NativeModules.TurtleCoin.getSpendKey();
}

/* -----------------------
   Daemon / sync / block processing
   ----------------------- */

export async function makePostRequest(endpoint, body) {
    if (endpoint !== '/sync') {
        return this.makeRequest(endpoint, 'POST', body);
    }

    const {
        count,
        checkpoints,
        skipCoinbaseTransactions,
        height,
        timestamp,
    } = body;

    const protocol = this.sslDetermined ? (this.ssl ? 'https' : 'http') : 'https';
    const url = `${protocol}://${this.host}:${this.port}/sync`;

    /* Questo è eseguito all'interno della classe Daemon, quindi `this` è disponibile */
    assertNativeMethod('getWalletSyncData');
    let data = await NativeModules.TurtleCoin.getWalletSyncData(
        count,
        checkpoints,
        skipCoinbaseTransactions,
        height,
        timestamp,
        url
    );

    if (data.error) {
        if (this.sslDetermined) {
            throw new Error(data.error);
        }

        /* Ssl failed, try http */
        data = await NativeModules.TurtleCoin.getWalletSyncData(
            count,
            checkpoints,
            skipCoinbaseTransactions,
            height,
            timestamp,
            `http://${this.host}:${this.port}/sync`,
        );

        if (data.error) {
            throw new Error(data.error);
        }

        try {
            data = JSON.parse(data);
            this.ssl = false;
            this.sslDetermined = true;
            return [data, 200];
        } catch (err) {
            throw new Error(err);
        }
    }

    try {
        data = JSON.parse(data);
    } catch (err) {
        throw new Error(err);
    }

    return [data, 200];
}

export async function processBlockOutputs(
    block,
    privateViewKey,
    spendKeys,
    isViewWallet,
    processCoinbaseTransactions
) {
    // Protezione overflow
    capIntToSafeValue(block);

    // Mappiamo in oggetto compatibile con native
    const javaSpendKeys = spendKeys.map(([publicKey, privateKey]) => ({
        publicKey,
        privateKey,
    }));

    assertNativeMethod('processBlockOutputs');
    let inputs = await NativeModules.TurtleCoin.processBlockOutputs(
        block, privateViewKey, javaSpendKeys, isViewWallet, processCoinbaseTransactions
    );

    // inputs: array di oggetti { input: { ... }, publicSpendKey: 'hex' }
    if (!Array.isArray(inputs)) inputs = [];

    const jsInputs = inputs.map((data) => {
        const parentHash = data.input && data.input.parentTransactionHash;
        let tx = block.transactions.find((t) => t.hash === parentHash);

        if (!tx) tx = block.coinbaseTransaction || { transactionPublicKey: undefined, unlockTime: 0, transactions: [] };

        const spendHeight = 0;
        const globalIndex = (data.input && data.input.globalOutputIndex === -1) ? undefined : (data.input && data.input.globalOutputIndex);

        const input = new TransactionInput(
            data.input && data.input.keyImage,
            data.input && data.input.amount,
            block.blockHeight,
            tx.transactionPublicKey,
            data.input && data.input.transactionIndex,
            globalIndex,
            data.input && data.input.key,
            spendHeight,
            tx.unlockTime,
            parentHash,
        );

        // Se native non restituisce publicSpendKey, qui avremo undefined — handler a valle deve gestirlo
        return [data.publicSpendKey, input];
    });

    return jsInputs;
}

/* Protezione numerica per evitare overflow in native */
function capIntToSafeValue(object) {
    if (!object || typeof object !== 'object') return;
    Object.keys(object).forEach(function (element) {
        if (object[element] && typeof object[element] === 'object') {
            capIntToSafeValue(object[element]);
        } else if (typeof object[element] === 'number' && object[element] > Number.MAX_SAFE_INTEGER) {
            object[element] = Number.MAX_SAFE_INTEGER;
        }
    });
}