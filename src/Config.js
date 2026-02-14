// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { Platform } from 'react-native';

import { MixinLimit, MixinLimits, Daemon } from 'kryptokrona-wallet-backend-js';

import {
    derivePublicKey,
    underivePublicKey,
    generateKeyDerivation,
    generateRingSignatures,
    deriveSecretKey,
    generateKeyImage,
    checkRingSignature,
    secretKeyToPublicKey,
    cnFastHash,
    scReduce32,
    checkKey,
    hashToEllipticCurve,
    generateSignature,
    checkSignature,
    hashToScalar,
    generateKeys
} from './NativeCode';

const Config = new function() {
    /**
     * If you can't figure this one out, I don't have high hopes
     */
    this.coinName = 'mevaCoin';

    /**
     * Prefix for URI encoded addresses
     */
    this.uriPrefix = 'mevacoin://';

    /**
     * How often to save the wallet, in milliseconds
     */
    this.walletSaveFrequency = 60 * 1000;

    /**
     * The amount of decimal places your coin has
     */
    this.decimalPlaces = 5;

    /**
     * The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
     */
    this.addressPrefix = 18511;

    /**
     * Request timeout for daemon operations in milliseconds
     */
    this.requestTimeout = 10 * 1000;

    /**
     * The block time of your coin, in seconds
     */
    this.blockTargetTime = 30;

    /**
     * How often to process blocks, in milliseconds
     */
    this.syncThreadInterval = 4;

    /**
     * How often to update the daemon info, in milliseconds
     */
    this.daemonUpdateInterval = 10 * 1000;

    /**
     * How often to check on locked transactions
     */
    this.lockedTransactionsCheckInterval = 10 * 3000;

    /**
     * The amount of blocks to process per 'tick' of the mainloop. Note: too
     * high a value will cause the event loop to be blocked, and your interaction
     * to be laggy.
     */
    this.blocksPerTick = 100;

    /**
     * Your coins 'ticker'
     */
    this.ticker = 'TRTL';

    /**
     * Whether to scan coinbase transactions
     */
    this.scanCoinbaseTransactions = true;

    /**
     * The minimum fee allowed for transactions, in ATOMIC units
     */
    this.minimumFee = 10;

    /**
     * Mapping of height to mixin maximum and mixin minimum
     */
    this.mixinLimits = new MixinLimits([
        /* Height: 440,000, minMixin: 0, maxMixin: 100, defaultMixin: 3 */
        new MixinLimit(440000, 0, 100, 3),

        /* At height of 620000, static mixin of 7 */
        new MixinLimit(620000, 7),

        /* At height of 800000, static mixin of 3 */
        new MixinLimit(800000, 3),
    ], 3 /* Default mixin of 3 before block 440,000 */);

    /**
     * Address lengths
     */
    this.standardAddressLength = 98;
    this.integratedAddressLength = 98 + ((64 * 11) / 8);

    /**
     * Use native functions where available (fallback a undefined se vuoi gestire JS fallback altrove)
     *
     * Nota: su iOS qui era originariamente impostato a undefined — mantengo la condizione
     * così puoi scegliere se fornire un binding iOS o un fallback JS separato.
     */
    const useNative = Platform.OS !== 'ios';

    this.derivePublicKey        = useNative ? derivePublicKey        : undefined;
    this.underivePublicKey      = useNative ? underivePublicKey      : undefined;
    this.generateKeyDerivation  = useNative ? generateKeyDerivation  : undefined;
    this.generateRingSignatures = useNative ? generateRingSignatures : undefined;
    this.deriveSecretKey        = useNative ? deriveSecretKey        : undefined;
    this.generateKeyImage       = useNative ? generateKeyImage       : undefined;
    // Il nome della proprietà nel config originale è checkRingSignatures (plurale)
    // ma l'import è checkRingSignature (singolare). Mantengo la proprietà come nell'originale.
    this.checkRingSignatures    = useNative ? checkRingSignature     : undefined;
    this.secretKeyToPublicKey   = useNative ? secretKeyToPublicKey   : undefined;
    this.cnFastHash             = useNative ? cnFastHash             : undefined;
    this.scReduce32             = useNative ? scReduce32             : undefined;
    this.checkKey               = useNative ? checkKey               : undefined;
    this.hashToEllipticCurve    = useNative ? hashToEllipticCurve    : undefined;
    this.generateSignature      = useNative ? generateSignature      : undefined;
    this.checkSignature         = useNative ? checkSignature         : undefined;
    this.hashToScalar           = useNative ? hashToScalar           : undefined;
    this.generateKeys           = useNative ? generateKeys           : undefined;

    /**
     * Memory to use for storing downloaded blocks - 3MB
     */
    this.blockStoreMemoryLimit = 1024 * 1024 * 3;

    /**
     * Amount of blocks to request from the daemon at once
     */
    this.blocksPerDaemonRequest = 100;

    /**
     * Unix timestamp of the time your chain was launched.
     *
     * If necessario, regola questo valore per allineare l'altezza con il tempo di chain.
     */
    this.chainLaunchTimestamp = new Date(1000 * 1513031505);

    /**
     * Fee to take on all transactions, in percentage
     */
    this.devFeePercentage = 0.5;

    /**
     * Address to send dev fee to
     */
    this.devFeeAddress = '';

    /**
     * Base url for price API
     */
    this.priceApiLink = 'https://api.coingecko.com/api/v3/simple/price';

    /**
     * Default daemon to use.
     */
    this.defaultDaemon = new Daemon('82.165.218.56', 17081, undefined, false);

    /**
     * A link to where a bug can be reported for your wallet.
     */
    this.repoLink = 'https://github.com/turtlecoin/turtlecoin-mobile-wallet/issues';

    /**
     * This only controls the name in the settings screen.
     */
    this.appName = 'TonChan';

    /**
     * Slogan phrase during wallet CreateScreen
     */
    this.sloganCreateScreen = 'Fast. Safe. Easy.';

    /**
     * Displayed in the settings screen
     */
    this.appVersion = 'v1.2.3';

    /**
     * Explorer base URL
     */
    this.explorerBaseURL = 'https://explorer.turtlecoin.lol/?search=';

    /**
     * App store links
     */
    this.appStoreLink = '';
    this.googlePlayLink = 'https://play.google.com/store/apps/details?id=com.tonchan';

    /**
     * Node list URL (turtlepay format)
     */
    this.nodeListURL = 'https://blockapi.turtlepay.io/node/list/available';
};

module.exports = Config;